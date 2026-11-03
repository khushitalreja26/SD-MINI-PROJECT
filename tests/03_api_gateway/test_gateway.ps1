$headers = @{
    Authorization = "Bearer mesh-demo-token"
}

try {
    $response = Invoke-RestMethod `
        -Uri "http://localhost:5000/api/books/1" `
        -Headers $headers

    Write-Host "PASS: API Gateway Book request" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "FAIL: Gateway request - $($_.Exception.Message)" -ForegroundColor Red
}