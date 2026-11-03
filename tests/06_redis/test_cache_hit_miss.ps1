$headers = @{
    Authorization = "Bearer mesh-demo-token"
}

$r1 = Invoke-WebRequest `
    -Uri "http://localhost:5000/api/books/1" `
    -Headers $headers `
    -UseBasicParsing

Write-Host "First request: $($r1.Headers['X-Cache'])"

$r2 = Invoke-WebRequest `
    -Uri "http://localhost:5000/api/books/1" `
    -Headers $headers `
    -UseBasicParsing

Write-Host "Second request: $($r2.Headers['X-Cache'])"