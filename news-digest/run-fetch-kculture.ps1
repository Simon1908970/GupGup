$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$logPath = Join-Path $projectRoot "news-digest\kculture\fetch.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$timestamp] Starting kculture fetch" | Out-File -FilePath $logPath -Append -Encoding utf8
& "C:\Program Files\nodejs\node.exe" news-digest\fetch-kculture.mjs 2>&1 | Out-File -FilePath $logPath -Append -Encoding utf8
"[$timestamp] Done, exit code: $LASTEXITCODE" | Out-File -FilePath $logPath -Append -Encoding utf8
