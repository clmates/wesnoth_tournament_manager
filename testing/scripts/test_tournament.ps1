# Login para obtener token válido
$loginBody = @{
    nickname = "admin"
    password = "test123"
} | ConvertTo-Json

Write-Host "Intentando login..." -ForegroundColor Cyan

try {
    $loginResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $loginBody `
        -ErrorAction Stop

    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.token
    
    Write-Host "Token obtenido:" -ForegroundColor Green
    Write-Host $token -ForegroundColor White
    Write-Host ""
    
    # Ahora crear torneo con el token válido
    Write-Host "Creando torneo..." -ForegroundColor Cyan
    
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $token"
    }

    $body = @{
        name = "prueba eliminacion"
        description = "torneo de eliminacion"
        tournament_type = "elimination"
        max_participants = 10
        round_duration_days = 7
        auto_advance_round = $true
        general_rounds = 3
        general_rounds_format = "bo3"
        final_rounds = 1
        final_rounds_format = "bo5"
    } | ConvertTo-Json

    Write-Host "Payload enviado:" -ForegroundColor Green
    Write-Host $body -ForegroundColor White
    Write-Host ""

    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/tournaments" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop

    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json | Write-Host
}
catch {
    Write-Host "Error:" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        
        $errorResponse = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorResponse)
        $errorBody = $reader.ReadToEnd()
        $reader.Close()
        
        Write-Host "Error Response:" -ForegroundColor Red
        Write-Host $errorBody -ForegroundColor White
    } else {
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}
