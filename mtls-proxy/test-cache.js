
const https = require("https");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const certDir = path.join(root, "certs");

const options = {
    key: fs.readFileSync(path.join(certDir, "gateway.key")),
    cert: fs.readFileSync(path.join(certDir, "gateway.crt")),
    ca: fs.readFileSync(path.join(certDir, "ca.crt")),
    rejectUnauthorized: true
};

function request(port, endpoint) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            ...options,
            hostname: "localhost",
            port,
            path: endpoint,
            method: "GET"
        }, (res) => {
            let body = "";

            res.on("data", chunk => body += chunk);

            res.on("end", () => {
                resolve({
                    status: res.statusCode,
                    cache: res.headers["x-cache"] || "Not applicable",
                    body
                });
            });
        });

        req.on("error", reject);
        req.end();
    });
}

async function test() {
    for (const service of [
        { name: "Book", port: 4101, endpoint: "/books" },
        { name: "Member", port: 4103, endpoint: "/members" }
    ]) {
        console.log(`\nTesting ${service.name} cache`);

        for (let i = 1; i <= 2; i++) {
            const result = await request(
                service.port,
                service.endpoint
            );

            console.log(`Request ${i}: HTTP ${result.status}`);
            console.log(`X-Cache: ${result.cache}`);
            console.log(`Response: ${result.body}`);
        }
    }
}

test().catch(console.error);
