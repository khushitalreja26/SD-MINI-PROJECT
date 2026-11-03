Write-Host "Testing Notification Service..."
try {
    $health = Invoke-RestMethod "http://localhost:3004/health"
    $data = Invoke-RestMethod "http://localhost:3004/notifications"
    Write-Host "PASS: Notification health and GET API" -ForegroundColor Green
    $data | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
