const https = require("https");
const fs = require("fs");

const options = {
    hostname: "localhost",
    path: "/health",
    ca: fs.readFileSync("certs/ca.crt"),
    cert: fs.readFileSync("certs/gateway.crt"),
    key: fs.readFileSync("certs/gateway.key"),
    rejectUnauthorized: true
};

const ports = [4101, 4102, 4103, 4104];

function testPort(port) {
    return new Promise((resolve) => {
        const req = https.get({ ...options, port }, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                console.log(`Port ${port}: HTTP ${res.statusCode}`);
                console.log(body);
                resolve();
            });
        });

        req.on("error", error => {
            console.log(`Port ${port}: ${error.message}`);
            resolve();
        });

        req.setTimeout(5000, () => req.destroy(new Error("Timeout")));
    });
}

async function run() {
    console.log("Testing with Gateway certificate...");
    for (const port of ports) await testPort(port);

    console.log("\nTesting without client certificate...");
    const req = https.get({
        hostname: "localhost",
        port: 4101,
        path: "/health",
        ca: fs.readFileSync("certs/ca.crt"),
        rejectUnauthorized: true
    }, (res) => {
        console.log("Unexpected response:", res.statusCode);
        res.resume();
    });

    req.on("error", error => {
        console.log("Expected rejection:", error.message);
    });
}

run();
