const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');

function createSecureProxy({
  port,
  serviceName,
  upstreamUrl,
  certName,
  requestTimeoutMs = 15000
}) {
  const certDir = path.join(__dirname, 'certs');
  const caCert = fs.readFileSync(path.join(certDir, 'ca.crt'));
  const serverKey = fs.readFileSync(path.join(certDir, `${certName}-sidecar.key`));
  const serverCert = fs.readFileSync(path.join(certDir, `${certName}-sidecar.crt`));
  const clientKey = fs.readFileSync(path.join(certDir, `${certName}-sidecar.key`));
  const clientCert = fs.readFileSync(path.join(certDir, `${certName}-sidecar.crt`));

  const app = express();
  app.use(express.json());

  function verifyClientCertificate(req, res, next) {
    const cert = req.socket.getPeerCertificate();
    if (!req.socket.authorized || !cert || !cert.subject) {
      return res.status(401).json({
        error: 'mTLS client certificate required',
        service: serviceName
      });
    }
    return next();
  }

  app.get('/health', verifyClientCertificate, (req, res) => {
    res.json({
      service: `${serviceName} secure sidecar`,
      status: 'healthy',
      mtls: true,
      clientSubject: req.socket.getPeerCertificate().subject
    });
  });

  app.use(async (req, res) => {
    try {
      const url = new URL(req.originalUrl, upstreamUrl);
      const proxyHeaders = { ...req.headers };
      delete proxyHeaders.host;

      const proxyRequest = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method: req.method,
          headers: proxyHeaders,
          ca: caCert,
          cert: clientCert,
          key: clientKey,
          rejectUnauthorized: true,
          timeout: requestTimeoutMs
        },
        (proxyResponse) => {
          res.status(proxyResponse.statusCode || 502);
          proxyResponse.on('data', (chunk) => res.write(chunk));
          proxyResponse.on('end', () => res.end());
        }
      );

      proxyRequest.on('error', (error) => {
        res.status(503).json({
          error: `Upstream request failed for ${serviceName}`,
          details: error.message
        });
      });

      if (!['GET', 'HEAD'].includes(req.method)) {
        proxyRequest.write(JSON.stringify(req.body || {}));
      }

      proxyRequest.end();
    } catch (error) {
      res.status(500).json({
        error: 'Secure proxy failed',
        details: error.message
      });
    }
  });

  const server = https.createServer(
    {
      key: serverKey,
      cert: serverCert,
      ca: caCert,
      requestCert: true,
      rejectUnauthorized: true
    },
    app
  );

  server.listen(port, () => {
    console.log(`${serviceName} mTLS proxy listening on https://localhost:${port}`);
  });

  return server;
}

if (require.main === module) {
  createSecureProxy({
    port: 4001,
    serviceName: 'Book Sidecar',
    upstreamUrl: 'https://localhost:3001',
    certName: 'book'
  });
}

module.exports = { createSecureProxy };
