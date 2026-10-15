# 바탕화면에 "줍줍 뉴스 뷰어" 바로가기를 만든다. (setup-shortcut.bat 에서 한 번만 실행)
$digestDir = Split-Path -Parent $PSScriptRoot
$target    = Join-Path $digestDir 'open-viewer.bat'
$desktop   = [Environment]::GetFolderPath('Desktop')
$lnkPath   = Join-Path $desktop '줍줍 뉴스 뷰어.lnk'

$ws  = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath       = $target
$lnk.WorkingDirectory = $digestDir
$lnk.WindowStyle      = 7   # 최소화로 실행
$lnk.IconLocation     = "$env:SystemRoot\System32\shell32.dll,13"
$lnk.Description      = '줍줍 뉴스 뷰어 (http://localhost:3030)'
$lnk.Save()

Write-Host ''
Write-Host "바로가기를 만들었습니다: $lnkPath" -ForegroundColor Green
Write-Host '바탕화면의 "줍줍 뉴스 뷰어" 아이콘을 더블클릭하면 브라우저에서 뷰어가 열립니다.'
