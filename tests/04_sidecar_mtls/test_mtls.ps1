Write-Host "Running mTLS certificate tests..."

node .\mtls-proxy\test-client.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "mTLS test script completed."
}
else {
    Write-Host "mTLS test script reported failure."
}