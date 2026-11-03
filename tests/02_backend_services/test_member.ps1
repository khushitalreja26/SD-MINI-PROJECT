Write-Host "Testing Member Service..."
try {
    $health = Invoke-RestMethod "http://localhost:3003/health"
    $data = Invoke-RestMethod "http://localhost:3003/members"
    Write-Host "PASS: Member health and GET API" -ForegroundColor Green
    $data | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
