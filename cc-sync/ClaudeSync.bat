@echo off
chcp 65001 >nul
set "HERE=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8; Invoke-Expression $t.Substring($t.LastIndexOf('#'+'PS'+'#')+4)"
exit /b
#PS#
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$utf8 = New-Object System.Text.UTF8Encoding($false)
$env:RCLONE_LOG_LEVEL = 'ERROR'
$rtlOpt = [System.Windows.Forms.MessageBoxOptions]::RtlReading -bor [System.Windows.Forms.MessageBoxOptions]::RightAlign

function Step($m) { Write-Host ">> $m" -ForegroundColor Cyan }

function Msg($text, $buttons = 'OK', $icon = 'Information') {
  [System.Windows.Forms.MessageBox]::Show($text, 'Claude Sync', $buttons, $icon, 'Button1', $rtlOpt)
}

function NewForm($h) {
  $f = New-Object System.Windows.Forms.Form
  $f.Text = 'Claude Sync'
  $f.RightToLeft = 'Yes'; $f.RightToLeftLayout = $true
  $f.StartPosition = 'CenterScreen'; $f.FormBorderStyle = 'FixedDialog'
  $f.MaximizeBox = $false; $f.MinimizeBox = $false; $f.TopMost = $true
  $f.Font = New-Object System.Drawing.Font('Segoe UI', 11)
  $f.ClientSize = New-Object System.Drawing.Size(540, $h)
  return $f
}

function AddLabel($f, $text, $h) {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $text
  $l.Location = New-Object System.Drawing.Point(20, 15)
  $l.Size = New-Object System.Drawing.Size(500, $h)
  $f.Controls.Add($l)
}

# window with big buttons; returns index of clicked button or -1
function Choose($text, $labels) {
  $f = NewForm (110 + 60 * $labels.Count)
  AddLabel $f $text 80
  $global:picked = -1
  for ($i = 0; $i -lt $labels.Count; $i++) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $labels[$i]; $b.Tag = $i
    $b.Location = New-Object System.Drawing.Point(20, (100 + 60 * $i))
    $b.Size = New-Object System.Drawing.Size(500, 48)
    $b.Add_Click({ $global:picked = $this.Tag; $this.FindForm().Close() })
    $f.Controls.Add($b)
  }
  [void]$f.ShowDialog()
  return $global:picked
}

# list window; returns selected index or -1
function PickList($text, $items) {
  $f = NewForm 380
  AddLabel $f $text 50
  $lb = New-Object System.Windows.Forms.ListBox
  $lb.Location = New-Object System.Drawing.Point(20, 70)
  $lb.Size = New-Object System.Drawing.Size(500, 230)
  foreach ($it in $items) { [void]$lb.Items.Add($it) }
  if ($items.Count -gt 0) { $lb.SelectedIndex = 0 }
  $f.Controls.Add($lb)
  $ok = New-Object System.Windows.Forms.Button
  $ok.Text = 'OK'; $ok.DialogResult = 'OK'
  $ok.Location = New-Object System.Drawing.Point(20, 320); $ok.Size = New-Object System.Drawing.Size(150, 42)
  $f.Controls.Add($ok); $f.AcceptButton = $ok
  if ($f.ShowDialog() -eq 'OK') { return $lb.SelectedIndex }
  return -1
}

function PickFolder($desc) {
  $fd = New-Object System.Windows.Forms.FolderBrowserDialog
  $fd.Description = $desc
  $fd.ShowNewFolderButton = $true
  if ($fd.ShowDialog() -eq 'OK') { return $fd.SelectedPath }
  return $null
}

function SetMap($proj, $rname) {
  $mapFile = Join-Path $env:USERPROFILE '.cc-sync-map.json'
  $map = @{}
  if (Test-Path $mapFile) {
    (Get-Content $mapFile -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $map[$_.Name] = $_.Value }
  }
  $map[$proj] = $rname
  [IO.File]::WriteAllText($mapFile, ($map | ConvertTo-Json), $utf8)
}

function LocalDir($proj) {
  Join-Path $env:USERPROFILE (".claude\projects\" + ($proj -replace '[^a-zA-Z0-9]', '-'))
}

function GetOwnKey {
  foreach ($f in @((Join-Path $env:HERE 'rclone-client.txt'), (Join-Path $env:USERPROFILE '.cc-sync-client.txt'))) {
    if (Test-Path $f) {
      $l = @(Get-Content $f | Where-Object { $_.Trim() })
      if ($l.Count -ge 2) { return @($l[0].Trim(), $l[1].Trim()) }
    }
  }
  return $null
}

function CreateOwnKey {
  Add-Type -AssemblyName Microsoft.VisualBasic
  $steps = @(
    @("https://console.cloud.google.com/projectcreate", "الخطوة 1 من 5: في المتصفح أنشئ مشروعا جديدا (أي اسم مثل claude-sync) واضغط Create. انتظر حتى ينتهي ثم اضغط (تم)."),
    @("https://console.cloud.google.com/apis/library/drive.googleapis.com", "الخطوة 2 من 5: تأكد أن مشروعك الجديد هو المختار في الأعلى، ثم اضغط Enable لتفعيل Google Drive API."),
    @("https://console.cloud.google.com/auth/overview", "الخطوة 3 من 5: اضغط Get started، اكتب اسم التطبيق وبريدك، واختر Audience = External، وأكمل حتى Create. (إن اختلفت الواجهة: APIs & Services ثم OAuth consent screen)"),
    @("https://console.cloud.google.com/auth/audience", "الخطوة 4 من 5 (مهمة جدا): اضغط Publish app ثم Confirm. بدونها تنتهي صلاحية الربط كل 7 أيام."),
    @("https://console.cloud.google.com/apis/credentials", "الخطوة 5 من 5: Create credentials ثم OAuth client ID ثم Application type = Desktop app ثم Create. انسخ Client ID و Client secret واضغط (تم).")
  )
  foreach ($st in $steps) {
    Start-Process $st[0]
    if ((Choose $st[1] @("تم، الخطوة التالية")) -ne 0) { return $null }
  }
  $id  = [Microsoft.VisualBasic.Interaction]::InputBox("الصق Client ID هنا", "Claude Sync")
  $sec = [Microsoft.VisualBasic.Interaction]::InputBox("الصق Client secret هنا", "Claude Sync")
  if (-not $id.Trim() -or -not $sec.Trim()) { return $null }
  $txt = $id.Trim() + "`r`n" + $sec.Trim() + "`r`n"
  [IO.File]::WriteAllText((Join-Path $env:USERPROFILE '.cc-sync-client.txt'), $txt, $utf8)
  return @($id.Trim(), $sec.Trim())
}

try {
  # ---------- explain, then ask for approval ----------
  $intro = "هذا البرنامج يزامن محادثات Claude Code المحلية عبر Google Drive بين أجهزتك.`n`n" +
           "ما الذي سيفعله:`n" +
           "1) تثبيت أداة rclone إن لم تكن موجودة.`n" +
           "2) ربط حساب Google Drive (سيفتح المتصفح لتسجيل الدخول).`n" +
           "3) تثبيت أداة المزامنة وإضافة رفع تلقائي بعد كل رد من Claude.`n" +
           "4) سؤالك: بدء محادثة جديدة مزامنة، أو ربط هذا الجهاز بمحادثة موجودة.`n`n" +
           "ملاحظة: شغّل البرنامج على كل جهاز بنفس حساب Claude وحساب Google Drive.`n`nهل توافق على المتابعة؟"
  if ((Msg $intro 'OKCancel') -ne 'OK') { return }

  # ---------- rclone ----------
  if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
    Step "Installing rclone..."
    winget install -e --id Rclone.Rclone --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
    if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
      throw "تم تثبيت rclone لكنه غير ظاهر بعد. أغلق النافذة وشغّل الملف مرة أخرى."
    }
  }
  Step "rclone OK"

  # ---------- Google Drive ----------
  $cur = $null
  if ((rclone listremotes) -contains 'gdrive:') { $cur = (rclone config dump | ConvertFrom-Json).gdrive.client_id }
  $key = GetOwnKey
  if (-not $key -and -not $cur) {
    $c = Choose ("لضمان استمرار المزامنة دائما، يُنصح بإنشاء مفتاح Google خاص بحسابك (مجاني، حوالي 10 دقائق، مرة واحدة).`n" +
                 "بدونه تعتمد المزامنة على مفتاح مشترك قد يتوقف خلال 2026.") @(
      "إنشاء مفتاحي الخاص الآن (موصى به)",
      "تخطي (استخدام المفتاح المشترك)")
    if ($c -eq 0) { $key = CreateOwnKey }
  }
  if (-not ((rclone listremotes) -contains 'gdrive:')) {
    Step "Browser will open: sign in to Google and click Allow..."
    $extra = @()
    if ($key) { $extra = @("client_id=$($key[0])", "client_secret=$($key[1])"); Step "Using your own Google client_id" }
    rclone config create gdrive drive scope=drive @extra
  }
  elseif ($key -and $cur -ne $key[0]) {
    Step "Switching Google Drive link to your own client_id (browser will open)..."
    rclone config update gdrive client_id $key[0] client_secret $key[1] | Out-Null
    rclone config reconnect gdrive:
  }
  rclone lsd gdrive: | Out-Null
  rclone mkdir gdrive:claude-sessions
  Step "Google Drive connected"

  # ---------- cc-sync script ----------
  try { Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force -ErrorAction Stop } catch { }
  New-Item -ItemType Directory -Force -Path C:\Tools | Out-Null
  $script = @'
param(
  [Parameter(Mandatory=$true)][ValidateSet("push","pull")][string]$Action,
  [string]$Project = (Get-Location).Path
)
$env:RCLONE_LOG_LEVEL = "ERROR"
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
  if (Test-Path $Local) { rclone copy $Local "$Remote/$Name" --update }
} else {
  New-Item -ItemType Directory -Force -Path $Local | Out-Null
  rclone copy "$Remote/$Name" $Local --update
}
if ($LASTEXITCODE -ne 0) {
  "$(Get-Date) $Action FAILED for $Proj" | Add-Content "$env:USERPROFILE\cc-sync.log"
  Add-Type -AssemblyName System.Windows.Forms
  [void][System.Windows.Forms.MessageBox]::Show("Claude Sync: $Action to Google Drive FAILED. Your conversation is NOT synced. Run ClaudeSync.bat again to reconnect Google Drive.", "Claude Sync", "OK", "Warning")
}
'@
  [IO.File]::WriteAllText('C:\Tools\cc-sync.ps1', $script, (New-Object System.Text.UTF8Encoding($true)))
  if (-not (Test-Path $PROFILE)) { New-Item -Force -Path $PROFILE | Out-Null }
  if (-not (Select-String -Path $PROFILE -Pattern 'cc-sync' -Quiet)) {
    Add-Content $PROFILE 'Set-Alias cc-sync C:\Tools\cc-sync.ps1'
  }
  Step "cc-sync installed"

  # ---------- Claude hook: push after every reply ----------
  $claudeDir = Join-Path $env:USERPROFILE '.claude'
  New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null
  $sp = Join-Path $claudeDir 'settings.json'
  $cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\Tools\cc-sync.ps1 push'
  $entry = @{ hooks = @(@{ type = 'command'; command = $cmd }) }
  if (Test-Path $sp) { Copy-Item $sp "$sp.bak" -Force; $j = Get-Content $sp -Raw | ConvertFrom-Json }
  else { $j = New-Object psobject }
  if (-not $j.PSObject.Properties['hooks']) { $j | Add-Member -NotePropertyName hooks -NotePropertyValue (New-Object psobject) }
  if (-not $j.hooks.PSObject.Properties['Stop']) { $j.hooks | Add-Member -NotePropertyName Stop -NotePropertyValue @() }
  if (($j.hooks.Stop | ConvertTo-Json -Depth 10) -notmatch 'cc-sync') {
    $j.hooks.Stop = @($j.hooks.Stop) + @($entry)
  }
  [IO.File]::WriteAllText($sp, ($j | ConvertTo-Json -Depth 10), $utf8)
  Step "Auto-push hook added"

  # ---------- what do you want to do? ----------
  $choice = Choose "ماذا تريد أن تفعل على هذا الجهاز؟" @(
    "بدء محادثة جديدة مزامنة (أو رفع مشروع موجود لأول مرة)",
    "ربط هذا الجهاز بمحادثة موجودة على Drive (أو تحديثها)"
  )
  if ($choice -lt 0) { return }

  if ($choice -eq 0) {
    # ----- new synced conversation -----
    $proj = PickFolder "اختر مجلد المشروع على هذا الجهاز (أو أنشئ مجلدا جديدا)"
    if (-not $proj) { return }
    $rname = Split-Path $proj -Leaf
    $existing = @(rclone lsf "gdrive:claude-sessions" --dirs-only | ForEach-Object { $_.TrimEnd('/') })
    if ($existing -contains $rname) {
      $a = Msg "يوجد على Drive مشروع بنفس الاسم ($rname).`nهل هو نفس المشروع؟ (نعم = استخدمه، لا = إلغاء)" 'YesNo' 'Question'
      if ($a -ne 'Yes') { return }
    }
    SetMap $proj $rname
    $local = LocalDir $proj
    if (Test-Path $local) { Step "Uploading existing conversations..."; rclone copy $local "gdrive:claude-sessions/$rname" --update }
    Msg ("تم الربط.`n`nافتح هذا المجلد في Claude Code المحلي وابدأ محادثة جديدة:`n$proj`n`n" +
         "ستُرفع المحادثة تلقائيا إلى Drive بعد كل رد.`n" +
         "على الجهاز الآخر: شغّل هذا الملف واختر (ربط بمحادثة موجودة).`n`n" +
         "مهم: لا تعمل على نفس المحادثة في جهازين في نفس الوقت.") | Out-Null
  }
  else {
    # ----- connect to existing -----
    $remotes = @(rclone lsf "gdrive:claude-sessions" --dirs-only | ForEach-Object { $_.TrimEnd('/') } | Where-Object { $_ })
    if ($remotes.Count -eq 0) {
      Msg "لا توجد محادثات محفوظة على Drive بعد.`nشغّل هذا الملف على الجهاز الأول واختر (بدء محادثة جديدة)." 'OK' 'Warning' | Out-Null
      return
    }
    $i = PickList "اختر المشروع / المحادثة المراد ربطها:" $remotes
    if ($i -lt 0) { return }
    $rname = $remotes[$i]
    $proj = PickFolder "اختر مجلد المشروع '$rname' على هذا الجهاز (أو أنشئ مجلدا جديدا)"
    if (-not $proj) { return }
    SetMap $proj $rname
    $local = LocalDir $proj
    New-Item -ItemType Directory -Force -Path $local | Out-Null
    Step "Downloading conversation..."
    rclone copy "gdrive:claude-sessions/$rname" $local --update
    Msg ("تم تنزيل المحادثة.`n`nافتح هذا المجلد في Claude Code المحلي وأكمل المحادثة السابقة:`n$proj`n`n" +
         "ستُرفع تعديلاتك تلقائيا بعد كل رد.`n" +
         "ملاحظة: كود المشروع نفسه يجب أن يكون في المجلد (مثلا عبر git clone).") | Out-Null
  }
}
catch {
  Msg ("حصل خطأ:`n" + $_.Exception.Message) 'OK' 'Error' | Out-Null
}
