$ports = 3001,3002,3003,3004,3011,
         4001,4002,4003,4004,4005,
         4101,4102,4103,4104,5000,5001

$results = foreach ($port in $ports) {
    $check = Test-NetConnection localhost -Port $port -WarningAction SilentlyContinue

    [PSCustomObject]@{
        Port = $port
        Status = if ($check.TcpTestSucceeded) {"PASS"} else {"FAIL"}
    }
}

$results | Format-Table -AutoSize

New-Item -ItemType Directory -Force ".\tests\results" | Out-Null
$results | Export-Csv ".\tests\results\port_results.csv" -NoTypeInformation