Write-Host "Testing Borrow Service..."
try {
    $health = Invoke-RestMethod "http://localhost:3002/health"
    $data = Invoke-RestMethod "http://localhost:3002/borrows"
    Write-Host "PASS: Borrow health and GET API" -ForegroundColor Green
    $data | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
