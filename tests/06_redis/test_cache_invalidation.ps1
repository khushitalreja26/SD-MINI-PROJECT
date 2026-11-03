Write-Host "Checking Redis cache keys..."

docker exec multicloud-redis redis-cli KEYS "multicloud:*"

Write-Host "Perform a successful Book update using the actual project endpoint."
Write-Host "Then run the GET request again and verify the old cached response is not returned."