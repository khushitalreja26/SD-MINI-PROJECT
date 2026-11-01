const fs = require('fs');
const https = require('https');
const path = require('path');

const certDir = path.join(__dirname, 'certs');
const ca = fs.readFileSync(path.join(certDir, 'ca.crt'));
const validKey = fs.readFileSync(path.join(certDir, 'book-sidecar.key'));
const validCert = fs.readFileSync(path.join(certDir, 'book-sidecar.crt'));

function requestHttps({ cert, key, caCert, pathName, expectStatus = 200 }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'localhost',
        port: 4001,
        path: pathName,
        method: 'GET',
        rejectUnauthorized: true,
        ca: caCert,
        cert,
        key
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString();
        });
        res.on('end', () => {
          if (res.statusCode === expectStatus) {
            resolve({ statusCode: res.statusCode, body });
          } else {
            reject(new Error(`Expected ${expectStatus}, got ${res.statusCode}: ${body}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function runChecks() {
  console.log('Testing valid certificate...');
  const validResult = await requestHttps({
    cert: validCert,
    key: validKey,
    caCert: ca,
    pathName: '/health',
    expectStatus: 200
  });
  console.log('Valid cert succeeded:', validResult.statusCode, validResult.body);

  console.log('Testing missing certificate...');
  try {
    await requestHttps({
      cert: undefined,
      key: undefined,
      caCert: ca,
      pathName: '/health',
      expectStatus: 401
    });
    throw new Error('Missing certificate unexpectedly succeeded');
  } catch (error) {
    console.log('Missing cert rejected as expected:', error.message);
  }

  console.log('Testing invalid certificate...');
  const invalidKey = fs.readFileSync(path.join(certDir, 'borrow-sidecar.key'));
  const invalidCert = fs.readFileSync(path.join(certDir, 'borrow-sidecar.crt'));

  try {
    await requestHttps({
      cert: invalidCert,
      key: invalidKey,
      caCert: ca,
      pathName: '/health',
      expectStatus: 200
    });
    throw new Error('Invalid certificate unexpectedly succeeded');
  } catch (error) {
    console.log('Invalid cert rejected as expected:', error.message);
  }
}

runChecks().catch((error) => {
  console.error('mTLS validation failed:', error.message);
  process.exit(1);
});
