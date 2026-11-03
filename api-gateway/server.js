
const express = require("express");
const morgan = require("morgan");
const https = require("https");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5000;

// 1. Middleware
app.use(express.json());
app.use(morgan("combined"));

// 2. Authentication token
const API_TOKEN = process.env.API_TOKEN || "mesh-demo-token";

// 3. Load mTLS certificates
const certPath = path.join(__dirname, "..", "certs");

const mtlsAgent = new https.Agent({
    key: fs.readFileSync(path.join(certPath, "gateway.key")),
    cert: fs.readFileSync(path.join(certPath, "gateway.crt")),
    ca: fs.readFileSync(path.join(certPath, "ca.crt")),
    rejectUnauthorized: true
});

// 4. Service registry
const services = {
    books: "https://localhost:4101",
    borrow: "https://localhost:4102",
    members: "https://localhost:4103",
    notifications: "https://localhost:4104"
};

// 5. Authentication
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader !== `Bearer ${API_TOKEN}`) {
        return res.status(401).json({
            error: "Unauthorized",
            message: "Missing or invalid authentication token"
        });
    }

    next();
}

// 6. Gateway health
app.get("/health", (req, res) => {
    res.status(200).json({
        service: "API Gateway",
        status: "healthy"
    });
});

// 7. Forward requests to mTLS proxy
function forwardRequest(req, res, serviceURL, defaultPath) {
    try {
        const incomingURL = new URL(req.url, "http://gateway.local");

        // Restore the service prefix removed by Express.
        const remainingPath = incomingURL.pathname;
        const upstreamPath =
            defaultPath + (remainingPath === "/" ? "" : remainingPath);

        const targetURL = new URL(
            upstreamPath + incomingURL.search,
            serviceURL
        );

        const headers = { ...req.headers };

        delete headers.host;
        delete headers.authorization;
        delete headers.connection;
        delete headers["content-length"];
        delete headers["accept-encoding"];

        const proxyRequest = https.request({
            hostname: targetURL.hostname,
            port: Number(targetURL.port),
            path: targetURL.pathname + targetURL.search,
            method: req.method,
            headers,
            agent: mtlsAgent
        }, (proxyResponse) => {
            res.status(proxyResponse.statusCode);

            Object.entries(proxyResponse.headers).forEach(
                ([name, value]) => {
                    if (
                        value !== undefined &&
                        ![
                            "connection",
                            "transfer-encoding",
                            "keep-alive",
                            "upgrade"
                        ].includes(name.toLowerCase())
                    ) {
                        res.setHeader(name, value);
                    }
                }
            );

            proxyResponse.pipe(res);
        });

        proxyRequest.setTimeout(10000, () => {
            proxyRequest.destroy(new Error("Upstream request timed out"));
        });

        proxyRequest.on("error", (error) => {
            console.error("[Gateway] Routing error:", error.message);

            if (!res.headersSent) {
                res.status(502).json({
                    error: "Bad Gateway",
                    message: "Unable to connect to the requested service"
                });
            }
        });

        if (
            ["POST", "PUT", "PATCH"].includes(req.method) &&
            req.body !== undefined
        ) {
            proxyRequest.write(JSON.stringify(req.body));
        }

        proxyRequest.end();

    } catch (error) {
        console.error("[Gateway] Forwarding exception:", error.message);

        if (!res.headersSent) {
            res.status(502).json({
                error: "Bad Gateway",
                message: "Unable to forward the request"
            });
        }
    }
}

// 8. Book routing
app.use("/api/books", authenticate, (req, res) => {
    forwardRequest(req, res, services.books, "/books");
});

// 9. Borrow routing
app.use("/api/borrow", authenticate, (req, res) => {
    forwardRequest(req, res, services.borrow, "/borrows");
});

// 10. Member routing
app.use("/api/members", authenticate, (req, res) => {
    forwardRequest(req, res, services.members, "/members");
});

// 11. Notification routing
app.use("/api/notifications", authenticate, (req, res) => {
    forwardRequest(req, res, services.notifications, "/notifications");
});

// 12. Unknown routes
app.use((req, res) => {
    res.status(404).json({
        error: "Route not found"
    });
});

// 13. Error handler
app.use((error, req, res, next) => {
    console.error("[Gateway] Application error:", error);

    if (!res.headersSent) {
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

// 14. Start Gateway
app.listen(PORT, () => {
    console.log(`API Gateway running at http://localhost:${PORT}`);
    console.log("Authentication enabled");
    console.log("Request logging enabled");
    console.log("mTLS proxy connections configured");
});
