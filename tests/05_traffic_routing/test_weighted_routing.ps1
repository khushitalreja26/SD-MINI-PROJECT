$headers = @{ Authorization = "Bearer mesh-demo-token" }
$counts = @{}

Write-Host "Testing Book GET weighted routing..."

for ($i = 1; $i -le 30; $i++) {
    try {
        $url = "http://localhost:5000/api/books/1?routeTest=$i"
        $response = Invoke-WebRequest -Uri $url -Headers $headers
        $backend = $response.Headers["X-Backend"]

        if (!$counts.ContainsKey($backend)) {
            $counts[$backend] = 0
        }

        $counts[$backend]++
    }
    catch {
        Write-Host "Request $i failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nRouting distribution:"
$counts.GetEnumerator() | Format-Table Name, Value

Write-Host "Expected: approximately 70% primary and 30% replica."
