@echo off
chcp 65001 >nul
set "HERE=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8; Invoke-Expression $t.Substring($t.LastIndexOf('#'+'PS'+'#')+4)"
echo.
pause
exit /b
#PS#
$ErrorActionPreference = 'Stop'
function Say($m)  { Write-Host ">> $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "!! $m" -ForegroundColor Yellow }
$utf8 = New-Object System.Text.UTF8Encoding($false)

# ---------- 1) rclone ----------
if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
  Say "Installing rclone..."
  winget install -e --id Rclone.Rclone --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
  if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
    throw "rclone installed but not found in PATH. Close this window and run the file again."
  }
}
Say "rclone OK"

# ---------- 2) Google Drive remote 'gdrive' ----------
if (-not ((rclone listremotes) -contains 'gdrive:')) {
  $conf = Join-Path $env:HERE 'rclone.conf'
  if (Test-Path $conf) {
    Say "Using rclone.conf found next to this file"
    $dir = Join-Path $env:APPDATA 'rclone'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $dest = Join-Path $dir 'rclone.conf'
    if (Test-Path $dest) { Copy-Item $dest "$dest.bak" -Force; Add-Content $dest ("`r`n" + (Get-Content $conf -Raw)) }
    else { Copy-Item $conf $dest }
  } else {
    Say "A browser will open: sign in to Google and click Allow..."
    rclone config create gdrive drive scope=drive
  }
}
rclone lsd gdrive: | Out-Null
Say "Google Drive connected"

# ---------- 3) cc-sync.ps1 ----------
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force
New-Item -ItemType Directory -Force -Path C:\Tools | Out-Null
$script = @'
param(
  [Parameter(Mandatory=$true)][ValidateSet("push","pull")][string]$Action,
  [string]$Project = (Get-Location).Path
)
$Remote = "gdrive:claude-sessions"
$Proj   = (Resolve-Path -LiteralPath $Project).Path
$Name   = Split-Path $Proj -Leaf
$mapFile = Join-Path $env:USERPROFILE ".cc-sync-map.json"
if (Test-Path $mapFile) {
  $m = Get-Content $mapFile -Raw | ConvertFrom-Json
  $v = $m.PSObject.Properties[$Proj]
  if ($v) { $Name = $v.Value }
}
$Enc   = $Proj -replace '[^a-zA-Z0-9]', '-'
$Local = Join-Path $env:USERPROFILE ".claude\projects\$Enc"

if ($Action -eq "push") {
  if (Test-Path $Local) { rclone copy $Local "$Remote/$Name" --update -v }
} else {
  New-Item -ItemType Directory -Force -Path $Local | Out-Null
  rclone copy "$Remote/$Name" $Local --update -v
}
'@
[IO.File]::WriteAllText('C:\Tools\cc-sync.ps1', $script, $utf8)
if (-not (Test-Path $PROFILE)) { New-Item -Force -Path $PROFILE | Out-Null }
if (-not (Select-String -Path $PROFILE -Pattern 'cc-sync' -Quiet)) {
  Add-Content $PROFILE 'Set-Alias cc-sync C:\Tools\cc-sync.ps1'
}
Say "cc-sync installed (C:\Tools\cc-sync.ps1)"

# ---------- 4) Claude hook: push after every reply ----------
$claudeDir = Join-Path $env:USERPROFILE '.claude'
New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null
$sp = Join-Path $claudeDir 'settings.json'
$cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\Tools\cc-sync.ps1 push'
$entry = @{ hooks = @(@{ type = 'command'; command = $cmd }) }
if (Test-Path $sp) {
  Copy-Item $sp "$sp.bak" -Force
  $j = Get-Content $sp -Raw | ConvertFrom-Json
} else {
  $j = New-Object psobject
}
if (-not $j.PSObject.Properties['hooks']) { $j | Add-Member -NotePropertyName hooks -NotePropertyValue (New-Object psobject) }
if (-not $j.hooks.PSObject.Properties['Stop']) { $j.hooks | Add-Member -NotePropertyName Stop -NotePropertyValue @() }
if (($j.hooks.Stop | ConvertTo-Json -Depth 10) -notmatch 'cc-sync') {
  $j.hooks.Stop = @($j.hooks.Stop) + @($entry)
}
[IO.File]::WriteAllText($sp, ($j | ConvertTo-Json -Depth 10), $utf8)
Say "Auto-push hook added to settings.json"

# ---------- 5) pull a conversation ----------
$remotes = @(rclone lsf "gdrive:claude-sessions" --dirs-only | ForEach-Object { $_.TrimEnd('/') } | Where-Object { $_ })
if ($remotes.Count -eq 0) { Warn "No saved conversations on Drive yet."; return }
Write-Host ""
Write-Host "Saved projects on Drive:" -ForegroundColor Green
for ($i = 0; $i -lt $remotes.Count; $i++) { Write-Host ("  [{0}] {1}" -f ($i+1), $remotes[$i]) }
$n = [int](Read-Host "Choose a number") - 1
$rname = $remotes[$n]

Add-Type -AssemblyName System.Windows.Forms
$fd = New-Object System.Windows.Forms.FolderBrowserDialog
$fd.Description = "Choose (or create) the LOCAL project folder for '$rname' on this device"
$fd.ShowNewFolderButton = $true
if ($fd.ShowDialog() -ne 'OK') { Warn "Cancelled."; return }
$proj = $fd.SelectedPath

$mapFile = Join-Path $env:USERPROFILE ".cc-sync-map.json"
$map = @{}
if (Test-Path $mapFile) { (Get-Content $mapFile -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $map[$_.Name] = $_.Value } }
$map[$proj] = $rname
[IO.File]::WriteAllText($mapFile, ($map | ConvertTo-Json), $utf8)

$enc = $proj -replace '[^a-zA-Z0-9]', '-'
$local = Join-Path $env:USERPROFILE ".claude\projects\$enc"
New-Item -ItemType Directory -Force -Path $local | Out-Null
Say "Downloading conversation..."
rclone copy "gdrive:claude-sessions/$rname" $local --update -v

Write-Host ""
Write-Host "DONE. Open this folder in the Claude app and resume the conversation:" -ForegroundColor Green
Write-Host "  $proj"
Write-Host "Reminder: the project code itself should come from git (git clone) into that folder."
