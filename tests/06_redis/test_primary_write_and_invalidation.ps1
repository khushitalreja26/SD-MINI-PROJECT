$headers = @{ Authorization = "Bearer mesh-demo-token" }

# Generate a new test book ID
$newId = Get-Random -Minimum 900000 -Maximum 999999

Write-Host "Testing with Book ID: $newId"

# Populate/check cache before write
$before = Invoke-WebRequest `
    -Uri "http://localhost:5000/api/books" `
    -Headers $headers

Write-Host "Before write: $($before.Headers['X-Cache'])"

# Create book
$body = @{
    id = $newId
    title = "Mesh Routing Test Book"
    author = "System Test"
    available = $true
} | ConvertTo-Json

try {
    $write = Invoke-WebRequest `
        -Uri "http://localhost:5000/api/books" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $body

    Write-Host "Write status: $($write.StatusCode)"
    Write-Host "Write backend: $($write.Headers['X-Backend'])"
}
catch {
    Write-Host "Write failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

Start-Sleep -Seconds 2

# Check refreshed list
$after = Invoke-WebRequest `
    -Uri "http://localhost:5000/api/books" `
    -Headers $headers

$books = $after.Content | ConvertFrom-Json
$found = @($books | Where-Object { [int]$_.id -eq $newId }).Count -gt 0

Write-Host "After write: $($after.Headers['X-Cache'])"

if ($write.StatusCode -eq 201 -and $write.Headers['X-Backend'] -eq "book-service") {
    Write-Host "PASS: Book write reached primary backend" -ForegroundColor Green
}

if ($found) {
    Write-Host "PASS: New book found in refreshed list" -ForegroundColor Green
} else {
    Write-Host "FAIL: New book not found" -ForegroundColor Red
}

if ($after.Headers['X-Cache'] -eq "MISS") {
    Write-Host "PASS: Redis cache invalidated" -ForegroundColor Green
} else {
    Write-Host "CHECK: Expected cache MISS after write" -ForegroundColor Yellow
}
