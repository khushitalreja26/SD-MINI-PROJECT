Write-Host "Testing Redis..."

$result = docker exec multicloud-redis redis-cli ping

if ($result -eq "PONG") {
    Write-Host "PASS: Redis is working" -ForegroundColor Green
}
else {
    Write-Host "FAIL: Redis is not responding" -ForegroundColor Red
}

$result | Out-File ".\tests\results\redis_result.txt"