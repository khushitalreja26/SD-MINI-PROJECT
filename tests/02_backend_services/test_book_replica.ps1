try {
    $response = Invoke-RestMethod "http://localhost:3011/books/1"
    Write-Host "PASS: Book replica backend"
    $response | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "FAIL: Book replica backend - $($_.Exception.Message)"
}