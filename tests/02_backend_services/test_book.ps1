try {
    $response = Invoke-RestMethod "http://localhost:3001/books/1"
    Write-Host "PASS: Book primary backend"
    $response | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "FAIL: Book primary backend - $($_.Exception.Message)"
}