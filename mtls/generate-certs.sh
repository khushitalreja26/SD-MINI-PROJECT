#!/usr/bin/env bash
set -euo pipefail

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}/certs"
mkdir -p "${CERT_DIR}"
rm -f "${CERT_DIR}"/*.pem "${CERT_DIR}"/*.crt "${CERT_DIR}"/*.key "${CERT_DIR}"/*.csr "${CERT_DIR}"/*.srl

# Root CA for the multi-cloud mesh
openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes \
  -keyout "${CERT_DIR}/ca.key" \
  -out "${CERT_DIR}/ca.crt" \
  -subj "/CN=MultiCloudMesh-Root-CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign,digitalSignature" \
  -addext "subjectKeyIdentifier=hash"

# Sidecar certs signed by the mesh CA
for name in book borrow member notification; do
  key="${CERT_DIR}/${name}-sidecar.key"
  csr="${CERT_DIR}/${name}-sidecar.csr"
  crt="${CERT_DIR}/${name}-sidecar.crt"

  openssl req -new -newkey rsa:2048 -nodes \
    -keyout "${key}" \
    -out "${csr}" \
    -subj "/CN=${name}-sidecar"

  openssl x509 -req -in "${csr}" -CA "${CERT_DIR}/ca.crt" -CAkey "${CERT_DIR}/ca.key" \
    -CAcreateserial -out "${crt}" -days 365 -sha256 \
    -extfile <(printf "subjectAltName=DNS:localhost,DNS:${name}-sidecar,DNS:${name},IP:127.0.0.1\nextendedKeyUsage=serverAuth,clientAuth\nkeyUsage=digitalSignature,keyEncipherment\nbasicConstraints=CA:FALSE\n")

  rm -f "${csr}"
done

# Rogue certs for rejection testing
openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes \
  -keyout "${CERT_DIR}/rogue-ca.key" \
  -out "${CERT_DIR}/rogue-ca.crt" \
  -subj "/CN=Rogue-CA"

openssl req -new -newkey rsa:2048 -nodes \
  -keyout "${CERT_DIR}/rogue-sidecar.key" \
  -out "${CERT_DIR}/rogue-sidecar.csr" \
  -subj "/CN=rogue-sidecar"

openssl x509 -req -in "${CERT_DIR}/rogue-sidecar.csr" \
  -CA "${CERT_DIR}/rogue-ca.crt" -CAkey "${CERT_DIR}/rogue-ca.key" \
  -CAcreateserial -out "${CERT_DIR}/rogue-sidecar.crt" -days 365 -sha256 \
  -extfile <(printf "subjectAltName=DNS:localhost,DNS:rogue-sidecar,IP:127.0.0.1\nextendedKeyUsage=serverAuth,clientAuth\nkeyUsage=digitalSignature,keyEncipherment\nbasicConstraints=CA:FALSE\n")

rm -f "${CERT_DIR}/rogue-sidecar.csr"

printf "Generated mesh CA, valid sidecar certs, and rogue certs in %s\n" "${CERT_DIR}"
