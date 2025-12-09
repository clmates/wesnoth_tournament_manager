# Test script para crear torneo - basado en report_matches.ps1
$ApiUrl = "http://localhost:3000/api"

# Login admin
try {
    Write-Host "Intentando login..." -ForegroundColor Cyan
    $adminLogin = Invoke-WebRequest -Uri "$ApiUrl/auth/login" -Method POST -ContentType "application/json" -Body (@{
        nickname = "admin"
        password = "test123"
    } | ConvertTo-Json) -UseBasicParsing | ConvertFrom-Json
    
    $adminToken = $adminLogin.token
    Write-Host "[OK] Admin logged in successfully" -ForegroundColor Green
    Write-Host "Token: $adminToken" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "[ERROR] Error logging in: $_" -ForegroundColor Red
    exit 1
}

# Create tournament
try {
    Write-Host "Creando torneo..." -ForegroundColor Cyan
    
    $tournamentBody = @{
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

    Write-Host "Payload:" -ForegroundColor Yellow
    Write-Host $tournamentBody -ForegroundColor White
    Write-Host ""

    $headers = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }

    $response = Invoke-WebRequest -Uri "$ApiUrl/tournaments" `
        -Method POST `
        -ContentType "application/json" `
        -Headers $headers `
        -Body $tournamentBody `
        -UseBasicParsing | ConvertFrom-Json
    
    Write-Host "[OK] Tournament created successfully!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor White
    $response | ConvertTo-Json | Write-Host
} catch {
    Write-Host "[ERROR] Error creating tournament: $_" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
