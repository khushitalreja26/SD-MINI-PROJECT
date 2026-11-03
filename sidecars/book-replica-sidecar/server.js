
const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = 4005;
const CONTROL_PLANE_URL = "http://localhost:5001";

let SERVICE_URL = null;

// Fetch configuration from Control Plane
async function loadConfiguration() {
    try {
        const response = await fetch(
            `${CONTROL_PLANE_URL}/config`
        );

        if (!response.ok) {
            throw new Error("Configuration request failed");
        }

        const data = await response.json();

        const bookConfig = data.services.find(
            service => service.id === "bookReplica"
        );

        if (!bookConfig) {
            throw new Error("Book configuration not found");
        }

        SERVICE_URL = bookConfig.serviceURL;

        console.log("Book Sidecar configuration loaded");
        console.log("Service URL:", SERVICE_URL);

    } catch (error) {
        console.error(
            "Unable to load Control Plane configuration:",
            error.message
        );
    }
}

// Sidecar health
app.get("/health", (req, res) => {
    res.json({
        service: "Book Sidecar",
        status: "healthy",
        serviceURL: SERVICE_URL
    });
});

// Check backend service health
app.get("/service-health", async (req, res) => {
    if (!SERVICE_URL) {
        return res.status(503).json({
            error: "Service configuration not loaded"
        });
    }

    try {
        const response = await fetch(
            `${SERVICE_URL}/health`
        );

        const data = await response.json();

        res.status(response.status).json(data);

    } catch (error) {
        res.status(503).json({
            error: "Book Service unavailable"
        });
    }
});

// Forward Book Service requests
app.use("/books", async (req, res) => {
    if (!SERVICE_URL) {
        return res.status(503).json({
            error: "Service configuration not loaded"
        });
    }

    try {
        const options = {
            method: req.method,
            headers: {
                "Content-Type": "application/json"
            }
        };

        if (!["GET", "HEAD"].includes(req.method)) {
            options.body = JSON.stringify(req.body);
        }

        const response = await fetch(
            `${SERVICE_URL}${req.originalUrl}`,
            options
        );

        const responseText = await response.text();

        res.status(response.status).send(responseText);

    } catch (error) {
        res.status(503).json({
            error: "Unable to reach Book Service"
        });
    }
});

// Load configuration before starting server
async function startServer() {
    await loadConfiguration();

    app.listen(PORT, () => {
        console.log(`Book Sidecar running on port ${PORT}`);
    });

    const certDir = path.resolve(__dirname, '..', '..', 'certs');
    const tlsServer = https.createServer({
        key: fs.readFileSync(path.join(certDir, 'book-sidecar.key')) ,
        cert: fs.readFileSync(path.join(certDir, 'book-sidecar.crt')) ,
        ca: fs.readFileSync(path.join(certDir, 'ca.crt')) ,
        requestCert: true,
        rejectUnauthorized: true
    }, app);
    tlsServer.listen(4405, () => {
        console.log('book Sidecar HTTPS mTLS running on port 4405');
    });
}

startServer();


