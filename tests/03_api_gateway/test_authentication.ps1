$tests = @(
    @{Name="Invalid token"; Headers=@{Authorization="Bearer wrong-token"}},
    @{Name="Missing token"; Headers=@{}}
)

foreach ($test in $tests) {
    try {
        Invoke-RestMethod `
            -Uri "http://localhost:5000/api/books/1" `
            -Headers $test.Headers

        Write-Host "FAIL: $($test.Name) was accepted" -ForegroundColor Red
    }
    catch {
        $status = [int]$_.Exception.Response.StatusCode

        if ($status -eq 401) {
            Write-Host "PASS: $($test.Name) rejected with 401" -ForegroundColor Green
        }
        else {
            Write-Host "CHECK: $($test.Name), HTTP $status" -ForegroundColor Yellow
        }
    }
}