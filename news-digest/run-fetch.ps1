$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$logPath = Join-Path $projectRoot "news-digest\daily\fetch.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$timestamp] Starting fetch" | Out-File -FilePath $logPath -Append -Encoding utf8
& "C:\Program Files\nodejs\node.exe" --env-file=.env.local news-digest\fetch.mjs 2>&1 | Out-File -FilePath $logPath -Append -Encoding utf8
"[$timestamp] Done, exit code: $LASTEXITCODE" | Out-File -FilePath $logPath -Append -Encoding utf8
