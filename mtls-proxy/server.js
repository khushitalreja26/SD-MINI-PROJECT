const https = require("https");
const fs = require("fs");
const path = require("path");
const { createClient } = require("redis");

const certDir = path.resolve(__dirname, "..", "certs");

const CACHE_TTL = 30;
const CONTROL_PLANE_URL =
    "http://localhost:5001/traffic-weights";

const redisClient = createClient({
    url: "redis://localhost:6380"
});

redisClient.on("error", (error) => {
    console.error("Redis error:", error.message);
});


// ==========================================
// SERVICE CONFIGURATION
// ==========================================

const services = [
    {
        name: "book",
        httpsPort: 4101,
        sidecarHttpsPort: 4401,
        replicaSidecarHttpsPort: 4405,
        certName: "book"
    },
    {
        name: "borrow",
        httpsPort: 4102,
        sidecarHttpsPort: 4402,
        certName: "borrow"
    },
    {
        name: "member",
        httpsPort: 4103,
        sidecarHttpsPort: 4403,
        certName: "member"
    },
    {
        name: "notification",
        httpsPort: 4104,
        sidecarHttpsPort: 4404,
        certName: "notification"
    }
];


// ==========================================
// TRAFFIC WEIGHTS
// ==========================================

let trafficWeights = {
    book: 70,
    bookReplica: 30
};

let weightsExpiry = 0;


// ==========================================
// FETCH WEIGHTS FROM CONTROL PLANE
// ==========================================

async function getTrafficWeights() {

    if (Date.now() < weightsExpiry) {
        return trafficWeights;
    }

    try {

        const response = await fetch(
            CONTROL_PLANE_URL,
            {
                signal: AbortSignal.timeout(1500)
            }
        );

        if (!response.ok) {
            throw new Error(
                `Control Plane HTTP ${response.status}`
            );
        }

        const weights = await response.json();

        const primary = Number(weights.book);
        const replica = Number(weights.bookReplica);

        if (
            Number.isFinite(primary) &&
            Number.isFinite(replica) &&
            primary >= 0 &&
            replica >= 0 &&
            primary + replica > 0
        ) {

            trafficWeights = {
                book: primary,
                bookReplica: replica
            };

        }

        weightsExpiry = Date.now() + 5000;

        console.log(
            `[WEIGHTS] Primary: ${trafficWeights.book}% | Replica: ${trafficWeights.bookReplica}%`
        );

    } catch (error) {

        console.error(
            "Could not fetch traffic weights; using last known weights:",
            error.message
        );

        weightsExpiry = Date.now() + 2000;

    }

    return trafficWeights;
}


// ==========================================
// WEIGHTED BOOK BACKEND SELECTION
// ==========================================

async function selectBookBackend(service) {

    const weights = await getTrafficWeights();

    const totalWeight =
        weights.book + weights.bookReplica;

    const randomValue =
        Math.random() * totalWeight;

    if (randomValue < weights.book) {

        return {
            port: service.sidecarHttpsPort,
            name: "primary-book-service"
        };

    }

    return {
        port: service.replicaSidecarHttpsPort,
        name: "book-replica"
    };

}


// ==========================================
// CHECK BOOK GET REQUEST
// ==========================================

// Supports:
// /books
// /books/1
// /books?test=1
// /books/1?test=1

function isBookRead(req) {

    return (
        req.method === "GET" &&
        /^\/books(?:\/|\?|$)/.test(req.url)
    );

}


// ==========================================
// REDIS CACHE ELIGIBILITY
// ==========================================

function isCacheable(service, req) {

    if (req.method !== "GET") {
        return false;
    }

    if (service.name === "book") {

        return /^\/books(?:\/|\?|$)/.test(req.url);

    }

    if (service.name === "member") {

        return /^\/members(?:\/|\?|$)/.test(req.url);

    }

    return false;

}


// ==========================================
// CACHE INVALIDATION
// ==========================================

async function invalidateCache(serviceName) {

    if (!redisClient.isReady) {
        return;
    }

    const prefix =
        `multicloud:${serviceName}:`;

    try {

        const keys = [];

        for await (
            const key of redisClient.scanIterator({
                MATCH: `${prefix}*`,
                COUNT: 100
            })
        ) {

            keys.push(key);

        }

        if (keys.length > 0) {

            await redisClient.del(...keys);

        }

        console.log(
            `${serviceName} cache invalidated`
        );

    } catch (error) {

        console.error(
            "Cache invalidation error:",
            error.message
        );

    }

}


// ==========================================
// START HTTPS mTLS PROXIES
// ==========================================

function startProxy() {

    for (const service of services) {

        const options = {

            key: fs.readFileSync(
                path.join(
                    certDir,
                    `${service.certName}-sidecar.key`
                )
            ),

            cert: fs.readFileSync(
                path.join(
                    certDir,
                    `${service.certName}-sidecar.crt`
                )
            ),

            ca: fs.readFileSync(
                path.join(certDir, "ca.crt")
            ),

            requestCert: true,
            rejectUnauthorized: true

        };


        // ==================================
        // CREATE HTTPS SERVER
        // ==================================

        const server = https.createServer(
            options,
            (req, res) => {

                const cacheable =
                    isCacheable(service, req);

                const cacheKey =
                    `multicloud:${service.name}:${req.url}`;


                // ==================================
                // FORWARD REQUEST TO SIDECAR
                // ==================================

                async function forwardRequest() {

                    try {

                        let target;

                        console.log(
                            `[DEBUG] Service: ${service.name} | Method: ${req.method} | URL: ${req.url} | BookRead: ${isBookRead(req)}`
                        );


                        // Book GET requests use weighted routing.
                        // Book POST, PUT, PATCH and DELETE
                        // always go to the primary backend.

                        if (
                            service.name === "book" &&
                            isBookRead(req)
                        ) {

                            target =
                                await selectBookBackend(service);

                        } else {

                            target = {
                                port: service.sidecarHttpsPort,
                                name: `${service.name}-service`
                            };

                        }


                        console.log(
                            `[ROUTING] ${service.name} -> ${target.name} (port ${target.port})`
                        );


                        // ==================================
                        // PREPARE REQUEST HEADERS
                        // ==================================

                        const headers = {
                            ...req.headers
                        };

                        headers.host =
                            `localhost:${target.port}`;

                        delete headers.connection;


                        // ==================================
                        // HTTPS REQUEST TO SIDECAR
                        // ==================================

                        const proxyReq = https.request({

                            hostname: "localhost",

                            port: target.port,

                            key: fs.readFileSync(
                                path.join(
                                    certDir,
                                    "gateway.key"
                                )
                            ),

                            cert: fs.readFileSync(
                                path.join(
                                    certDir,
                                    "gateway.crt"
                                )
                            ),

                            ca: fs.readFileSync(
                                path.join(
                                    certDir,
                                    "ca.crt"
                                )
                            ),

                            servername: "localhost",

                            rejectUnauthorized: true,

                            path: req.url,

                            method: req.method,

                            headers

                        }, (proxyRes) => {


                            // ==================================
                            // CACHEABLE RESPONSE
                            // ==================================

                            if (cacheable) {

                                const chunks = [];

                                proxyRes.on(
                                    "data",
                                    (chunk) => {
                                        chunks.push(chunk);
                                    }
                                );


                                proxyRes.on(
                                    "end",
                                    async () => {

                                        const body =
                                            Buffer.concat(chunks);

                                        const responseHeaders = {
                                            ...proxyRes.headers,
                                            "X-Backend": target.name
                                        };


                                        // Save successful responses
                                        // in Redis.

                                        if (
                                            proxyRes.statusCode === 200 &&
                                            redisClient.isReady
                                        ) {

                                            try {

                                                await redisClient.set(

                                                    cacheKey,

                                                    JSON.stringify({

                                                        statusCode:
                                                            proxyRes.statusCode,

                                                        headers:
                                                            responseHeaders,

                                                        body:
                                                            body.toString("base64")

                                                    }),

                                                    {
                                                        EX: CACHE_TTL
                                                    }

                                                );

                                            } catch (error) {

                                                console.error(
                                                    "Cache write error:",
                                                    error.message
                                                );

                                            }

                                        }


                                        res.writeHead(
                                            proxyRes.statusCode,
                                            {
                                                ...responseHeaders,
                                                "X-Cache": "MISS"
                                            }
                                        );

                                        res.end(body);

                                    }
                                );

                                return;

                            }


                            // ==================================
                            // CACHE INVALIDATION AFTER MUTATIONS
                            // ==================================

                            const isMutation = [
                                "POST",
                                "PUT",
                                "PATCH",
                                "DELETE"
                            ].includes(req.method);


                            if (
                                isMutation &&
                                proxyRes.statusCode >= 200 &&
                                proxyRes.statusCode < 300 &&
                                ["book", "member"].includes(
                                    service.name
                                )
                            ) {

                                proxyRes.on("end", () => {

                                    invalidateCache(
                                        service.name
                                    );

                                });

                            }


                            // ==================================
                            // SEND RESPONSE TO CLIENT
                            // ==================================

                            res.writeHead(
                                proxyRes.statusCode,
                                {
                                    ...proxyRes.headers,
                                    "X-Backend": target.name
                                }
                            );

                            proxyRes.pipe(res);

                        });


                        // ==================================
                        // PROXY ERROR HANDLING
                        // ==================================

                        proxyReq.on("error", (error) => {

                            console.error(
                                `${service.name} proxy error:`,
                                error.message
                            );

                            if (!res.headersSent) {

                                res.writeHead(
                                    502,
                                    {
                                        "Content-Type":
                                            "text/plain"
                                    }
                                );

                                res.end(
                                    "Sidecar unavailable"
                                );

                            }

                        });


                        req.pipe(proxyReq);

                    } catch (error) {

                        console.error(
                            "Routing error:",
                            error.message
                        );

                        if (!res.headersSent) {

                            res.writeHead(502);

                            res.end(
                                "Unable to route request"
                            );

                        }

                    }

                }


                // ==================================
                // REDIS CACHE LOOKUP
                // ==================================

                if (
                    cacheable &&
                    redisClient.isReady
                ) {

                    redisClient.get(cacheKey)

                        .then((cached) => {

                            if (cached) {

                                const entry =
                                    JSON.parse(cached);

                                console.log(
                                    `${service.name} CACHE HIT: ${req.url}`
                                );


                                res.writeHead(
                                    entry.statusCode,
                                    {
                                        ...entry.headers,
                                        "X-Cache": "HIT"
                                    }
                                );

                                res.end(
                                    Buffer.from(
                                        entry.body,
                                        "base64"
                                    )
                                );

                            } else {

                                console.log(
                                    `${service.name} CACHE MISS: ${req.url}`
                                );

                                forwardRequest();

                            }

                        })

                        .catch((error) => {

                            console.error(
                                "Cache read error:",
                                error.message
                            );

                            forwardRequest();

                        });

                    return;

                }


                if (cacheable) {

                    console.log(
                        `${service.name} CACHE MISS: ${req.url}`
                    );

                }

                forwardRequest();

            }
        );


        // ==================================
        // START LISTENING
        // ==================================

        server.listen(
            service.httpsPort,
            () => {

                console.log(
                    `${service.name} mTLS proxy listening on port ${service.httpsPort}`
                );

            }
        );


        // ==================================
        // mTLS CERTIFICATE ERROR
        // ==================================

        server.on(
            "tlsClientError",
            (error) => {

                console.log(
                    `${service.name}: rejected TLS client - ${error.message}`
                );

            }
        );

    }

}


// ==========================================
// MAIN FUNCTION
// ==========================================

async function main() {

    try {

        await redisClient.connect();

        console.log(
            "Redis connected successfully"
        );

    } catch (error) {

        console.error(
            "Redis unavailable. Proxy will run without caching:",
            error.message
        );

    }

    startProxy();

}

main();
