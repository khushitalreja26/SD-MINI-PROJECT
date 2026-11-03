
const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = 4003;
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

        const memberConfig = data.services.find(
            service => service.id === "member"
        );

        if (!memberConfig) {
            throw new Error("Member configuration not found");
        }

        SERVICE_URL = memberConfig.serviceURL;

        console.log("Member Sidecar configuration loaded");
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
        service: "Member Sidecar",
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
            error: "Member Service unavailable"
        });
    }
});

// Forward Member Service requests
app.use("/members", async (req, res) => {
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
            error: "Unable to reach Member Service"
        });
    }
});

// Load configuration before starting server
async function startServer() {
    await loadConfiguration();

    app.listen(PORT, () => {
        console.log(`Member Sidecar running on port ${PORT}`);
    });

    const certDir = path.resolve(__dirname, '..', '..', 'certs');
    const tlsServer = https.createServer({
        key: fs.readFileSync(path.join(certDir, 'member-sidecar.key')) ,
        cert: fs.readFileSync(path.join(certDir, 'member-sidecar.crt')) ,
        ca: fs.readFileSync(path.join(certDir, 'ca.crt')) ,
        requestCert: true,
        rejectUnauthorized: true
    }, app);
    tlsServer.listen(4403, () => {
        console.log('member Sidecar HTTPS mTLS running on port 4403');
    });
}

startServer();

