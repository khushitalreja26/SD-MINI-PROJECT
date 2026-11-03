
const express = require("express");

const app = express();
app.use(express.json());

const PORT = 5001;

// Service Registry
const services = {
    book: {
        name: "Book Service",
        cloud: "Azure",
        serviceURL: "http://localhost:3001",
        sidecarURL: "http://localhost:4001",
        trafficWeight: 70,
        healthStatus: "unknown",
        lastChecked: null
    },

    borrow: {
        name: "Borrow Service",
        cloud: "Azure",
        serviceURL: "http://localhost:3002",
        sidecarURL: "http://localhost:4002",
        trafficWeight: 100,
        healthStatus: "unknown",
        lastChecked: null
    },

    member: {
        name: "Member Service",
        cloud: "Render",
        serviceURL: "http://localhost:3003",
        sidecarURL: "http://localhost:4003",
        trafficWeight: 100,
        healthStatus: "unknown",
        lastChecked: null
    },

    notification: {
        name: "Notification Service",
        cloud: "Render",
        serviceURL: "http://localhost:3004",
        sidecarURL: "http://localhost:4004",
        trafficWeight: 100,
        healthStatus: "unknown",
        lastChecked: null
    },
    bookReplica: {
  name: "Book Service Replica",
  cloud: "Azure",
  serviceURL: "http://localhost:3011",
  sidecarURL: "http://localhost:4005",
  trafficWeight: 30,
  healthStatus: "unknown",
  lastChecked: null
},
};

// 1. Check the health of one service
async function checkServiceHealth(service) {
    try {
        const response = await fetch(
            `${service.serviceURL}/health`
        );

        service.healthStatus = response.ok
            ? "healthy"
            : "unhealthy";

    } catch (error) {
        service.healthStatus = "unavailable";
    }

    service.lastChecked = new Date().toISOString();
}

// 2. Check all registered services
async function checkAllServices() {
    const checks = Object.values(services).map(
        service => checkServiceHealth(service)
    );

    await Promise.all(checks);
}

// 3. Automatically check services every 10 seconds
setInterval(() => {
    checkAllServices();
}, 10000);

// Perform the first health check immediately
checkAllServices();

// 4. Control Plane health
app.get("/health", (req, res) => {
    res.json({
        service: "Control Plane",
        status: "healthy"
    });
});

// 5. Get all registered services
app.get("/services", (req, res) => {
    res.json(services);
});

// 6. Get details of one service
app.get("/services/:name", (req, res) => {
    const service = services[req.params.name];

    if (!service) {
        return res.status(404).json({
            error: "Service not found"
        });
    }

    res.json(service);
});

// 7. Manually check one service's health
app.get("/services/:name/health", async (req, res) => {
    const service = services[req.params.name];

    if (!service) {
        return res.status(404).json({
            error: "Service not found"
        });
    }

    await checkServiceHealth(service);

    res.json({
        service: service.name,
        cloud: service.cloud,
        status: service.healthStatus,
        lastChecked: service.lastChecked
    });
});

// 8. Get sidecar configuration
app.get("/config", (req, res) => {
    const configuration = Object.entries(services).map(
        ([id, service]) => ({
            id,
            cloud: service.cloud,
            serviceURL: service.serviceURL,
            sidecarURL: service.sidecarURL
        })
    );

    res.json({
        controlPlane: "Multi-Cloud Service Mesh",
        services: configuration
    });
});

// 9. Get traffic weights
app.get("/traffic-weights", (req, res) => {
    const weights = {};

    for (const [id, service] of Object.entries(services)) {
        weights[id] = service.trafficWeight;
    }

    res.json(weights);
});

// 10. Update traffic weight
app.put("/traffic-weights/:name", (req, res) => {
    const service = services[req.params.name];
    const weight = req.body.weight;

    if (!service) {
        return res.status(404).json({
            error: "Service not found"
        });
    }

    if (
        typeof weight !== "number" ||
        !Number.isInteger(weight) ||
        weight < 0 ||
        weight > 100
    ) {
        return res.status(400).json({
            error: "Weight must be an integer from 0 to 100"
        });
    }

    service.trafficWeight = weight;

    res.json({
        message: "Traffic weight updated successfully",
        service: service.name,
        trafficWeight: service.trafficWeight
    });
});

// 11. Get automatic health monitoring results
app.get("/health-status", (req, res) => {
    const status = {};

    for (const [id, service] of Object.entries(services)) {
        status[id] = {
            name: service.name,
            cloud: service.cloud,
            status: service.healthStatus,
            lastChecked: service.lastChecked
        };
    }

    res.json(status);
});

// Start Control Plane
app.listen(PORT, () => {
    console.log(`Control Plane running on port ${PORT}`);
});
