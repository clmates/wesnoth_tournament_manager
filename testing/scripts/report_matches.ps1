param(
    [Parameter(Mandatory=$true)]
    [string]$WinnerNickname,
    
    [Parameter(Mandatory=$true)]
    [string]$WinnerPassword,
    
    [Parameter(Mandatory=$true)]
    [string]$LoserNickname,
    
    [Parameter(Mandatory=$true)]
    [int]$MatchCount = 1,
    
    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = "http://localhost:3000/api"
)

# Validate parameters
if ($MatchCount -lt 1 -or $MatchCount -gt 100) {
    Write-Host "Error: MatchCount must be between 1 and 100"
    exit 1
}

# Login winner
try {
    $winnerLogin = Invoke-WebRequest -Uri "$ApiUrl/auth/login" -Method POST -ContentType "application/json" -Body (@{
        nickname = $WinnerNickname
        password = $WinnerPassword
    } | ConvertTo-Json) -UseBasicParsing | ConvertFrom-Json
    
    $winnerToken = $winnerLogin.token
    Write-Host "[OK] Winner '$WinnerNickname' logged in successfully"
} catch {
    Write-Host "[ERROR] Error logging in winner: $_"
    exit 1
}

# Get loser info (search for user)
try {
    $loserSearch = Invoke-WebRequest -Uri "$ApiUrl/users/search/$LoserNickname" -Method GET -UseBasicParsing | ConvertFrom-Json
    
    if ($loserSearch.Count -eq 0 -or $null -eq $loserSearch[0]) {
        Write-Host "[ERROR] Loser '$LoserNickname' not found"
        exit 1
    }
    
    $loserId = $loserSearch[0].id
    Write-Host "[OK] Loser '$LoserNickname' found (ID: $loserId)"
} catch {
    Write-Host "[ERROR] Error searching for loser: $_"
    exit 1
}

# Arrays of factions and maps
$factions = @("Elves", "Humans", "Orcs", "Undead", "Dwarves", "Drakes")
$maps = @("Map 1", "Map 2", "Map 3", "Siege", "Dueling Grounds")

# Report matches
$successCount = 0
$errorCount = 0

Write-Host "`nReporting $MatchCount matches..."
Write-Host "===================================================="

for ($i = 1; $i -le $MatchCount; $i++) {
    $winnerFaction = $factions | Get-Random
    $loserFaction = $factions | Get-Random
    while ($loserFaction -eq $winnerFaction) {
        $loserFaction = $factions | Get-Random
    }
    $map = $maps | Get-Random
    $rating = Get-Random -Minimum 1 -Maximum 6
    
    $body = @{
        opponent_id = $loserId
        map = $map
        winner_faction = $winnerFaction
        loser_faction = $loserFaction
        comments = "$winnerFaction vs $loserFaction on $map - gg"
        rating = $rating
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl/matches/report-json" -Method POST -ContentType "application/json" -Headers @{"Authorization" = "Bearer $winnerToken"} -Body $body -UseBasicParsing
        $result = $response.Content | ConvertFrom-Json
        Write-Host "[$i/$MatchCount] [OK] $winnerFaction vs $loserFaction on $map (Rating: $rating/5)"
        $successCount++
    } catch {
        $errorMsg = $_.Exception.Response.StatusCode
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            $reader.Dispose()
            Write-Host "[$i/$MatchCount] [ERROR] Status: $errorMsg - Body: $errorBody"
        } else {
            Write-Host "[$i/$MatchCount] [ERROR] $_"
        }
        $errorCount++
    }
    
    Start-Sleep -Milliseconds 300
}

Write-Host "===================================================="
Write-Host "`nResults:"
Write-Host "  [OK] Successful: $successCount"
Write-Host "  [ERROR] Failed: $errorCount"
Write-Host "  Total: $($successCount + $errorCount)/$MatchCount"

if ($errorCount -eq 0) {
    Write-Host "`n[OK] All matches reported successfully!"
    exit 0
} else {
    Write-Host "`n[WARNING] Some matches failed to report"
    exit 1
}
