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

function QuietRclone {
  $ErrorActionPreference = 'Continue'
  rclone @args *> $null
}

function Read-Json($f) {
  if (Test-Path $f) { try { return (Get-Content $f -Raw | ConvertFrom-Json) } catch { } }
  return (New-Object psobject)
}

function Norm($s) { return (($s -replace '[^a-zA-Z0-9]', '_').ToLower()) }

function CheckTools($local, $proj) {
  if (-not (Test-Path $local)) { Msg "لا توجد محادثات على هذا الجهاز لهذا المجلد." 'OK' 'Warning' | Out-Null; return }
  $parts = @()
  foreach ($f in Get-ChildItem $local -Filter *.jsonl) { $parts += [IO.File]::ReadAllText($f.FullName) }
  $text = $parts -join "`n"

  $mcp = @{}; foreach ($m in [regex]::Matches($text, '"name":"mcp__([^"]+?)__')) { $mcp[$m.Groups[1].Value] = 1 }
  $skills = @{}; foreach ($m in [regex]::Matches($text, '"name":"Skill","input":\{"skill":"([^"]+)"')) { $skills[$m.Groups[1].Value] = 1 }
  $agents = @{}; foreach ($m in [regex]::Matches($text, '"subagent_type":"([^"]+)"')) { $agents[$m.Groups[1].Value] = 1 }

  $claude = Join-Path $env:USERPROFILE '.claude'
  $instFile = Join-Path $claude 'plugins\installed_plugins.json'
  $instKeys = @()
  if (Test-Path $instFile) {
    $ij = Read-Json $instFile
    if ($ij.plugins) { $instKeys = @($ij.plugins.PSObject.Properties.Name) } else { $instKeys = @($ij.PSObject.Properties.Name) }
  } else {
    $st = Read-Json (Join-Path $claude 'settings.json')
    if ($st.enabledPlugins) { $instKeys = @($st.enabledPlugins.PSObject.Properties.Name) }
  }
  $instNames = @($instKeys | ForEach-Object { ($_ -split '@')[0] })

  $conf = @()
  $cj = Read-Json (Join-Path $env:USERPROFILE '.claude.json')
  if ($cj.mcpServers) { $conf += $cj.mcpServers.PSObject.Properties.Name }
  if ($cj.projects) {
    foreach ($pp in $cj.projects.PSObject.Properties) {
      if ((Norm $pp.Name) -eq (Norm $proj) -and $pp.Value.mcpServers) { $conf += $pp.Value.mcpServers.PSObject.Properties.Name }
    }
  }
  $mj = Read-Json (Join-Path $proj '.mcp.json')
  if ($mj.mcpServers) { $conf += $mj.mcpServers.PSObject.Properties.Name }
  $confN = @($conf | ForEach-Object { Norm $_ })

  $missPlugins = @{}; $missMcp = @(); $missAgents = @()
  foreach ($sv in $mcp.Keys) {
    if ($sv -like 'claude_ai_*') { continue }
    if ($sv -like 'plugin_*') {
      $rest = $sv.Substring(7).ToLower(); $hit = $false
      foreach ($n in $instNames) { if ($rest.StartsWith((Norm $n))) { $hit = $true } }
      if (-not $hit) { $missPlugins[$rest] = 1 }
      continue
    }
    if ($confN -notcontains (Norm $sv)) { $missMcp += $sv }
  }
  foreach ($k in $skills.Keys) {
    if ($k -like '*:*') { $pn = ($k -split ':')[0]; if ($instNames -notcontains $pn) { $missPlugins[$pn] = 1 } }
  }
  $builtin = @('general-purpose','Explore','Plan','statusline-setup','claude-code-guide','claude','fork')
  foreach ($ag in $agents.Keys) {
    if ($builtin -contains $ag) { continue }
    if ($ag -like '*:*') { $pn = ($ag -split ':')[0]; if ($instNames -notcontains $pn) { $missPlugins[$pn] = 1 }; continue }
    if (-not ((Test-Path (Join-Path $claude "agents\$ag.md")) -or (Test-Path (Join-Path $proj ".claude\agents\$ag.md")))) { $missAgents += $ag }
  }

  if ($missPlugins.Count -eq 0 -and $missMcp.Count -eq 0 -and $missAgents.Count -eq 0) {
    Msg ("فحصت أدوات هذه المحادثة (MCP: $($mcp.Count)، skills: $($skills.Count)، agents: $($agents.Count)).`nكلها متوفرة على هذا الجهاز.") | Out-Null
    return
  }

  $tmp = Join-Path $env:TEMP 'cc-portable-check.json'
  Remove-Item $tmp -ErrorAction SilentlyContinue
  QuietRclone copyto "gdrive:claude-sessions/_shared/settings-portable.json" $tmp
  $port = Read-Json $tmp
  $loc  = Read-Json (Join-Path $claude 'settings.json')
  function FindKey($name) {
    foreach ($src in @($port, $loc)) {
      if ($src.enabledPlugins) { foreach ($p in $src.enabledPlugins.PSObject.Properties) { if ((($p.Name -split '@')[0]) -ieq $name) { return $p.Name } } }
    }
    return $null
  }
  function FindSrc($mkt) {
    foreach ($src in @($port, $loc)) {
      if ($src.extraKnownMarketplaces -and $src.extraKnownMarketplaces.PSObject.Properties[$mkt]) {
        $so = $src.extraKnownMarketplaces.$mkt.source
        if ($so.url) { return $so.url } elseif ($so.repo) { return $so.repo }
      }
    }
    return $null
  }

  $cmds = @(); $lines = @()
  foreach ($pn in $missPlugins.Keys) {
    $key = FindKey $pn
    if ($key) {
      $mkt = ($key -split '@')[1]
      $u = FindSrc $mkt
      if ($u) { $cmds += "/plugin marketplace add $u" }
      $cmds += "/plugin install $key"
      $lines += "- إضافة: $key"
    } else { $lines += "- إضافة: $pn (لم أجد مصدرها، ابحث عنها داخل /plugin)" }
  }
  foreach ($m in $missMcp)    { $lines += "- خادم MCP: $m (أضفه بـ claude mcp add أو من إعدادات التطبيق، وقد يحتاج مفاتيح)" }
  foreach ($a in $missAgents) { $lines += "- وكيل (agent): $a (ضعه في .claude\agents أو ثبّت إضافته)" }
  $cmds = @($cmds | Select-Object -Unique)

  $txt = "وجدت أدوات استُخدمت في هذه المحادثة وغير مثبتة على هذا الجهاز:`n`n" + ($lines -join "`n")
  if ($cmds.Count -gt 0) {
    $txt += "`n`nهل تريد نسخ أوامر التثبيت إلى الحافظة؟ بعدها الصقها في Claude Code واحدا واحدا."
    if ((Msg $txt 'YesNo' 'Question') -eq 'Yes') { Set-Clipboard -Value ($cmds -join "`r`n") }
  } else {
    Msg $txt 'OK' 'Warning' | Out-Null
  }
}

function DriveOK {
  $ErrorActionPreference = 'Continue'
  rclone lsd gdrive: *> $null
  return ($LASTEXITCODE -eq 0)
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
           "3) تثبيت أداة المزامنة وإضافة رفع تلقائي بعد كل رد من Claude (مع مزامنة الإعدادات والإضافات).`n" +
           "4) سؤالك: بدء محادثة جديدة، ربط بمحادثة موجودة، أو فحص أدواتها.`n`n" +
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
  $key = GetOwnKey
  $has = (rclone listremotes) -contains 'gdrive:'
  if (-not ($has -and (DriveOK))) {
    if (-not $key) {
      $c = Choose ("كيف تريد ربط Google Drive؟`n(المفتاح الخاص أضمن على المدى الطويل، لكنه يحتاج حوالي 10 دقائق من الخطوات)") @(
        "ربط سريع الآن (مفتاح مشترك)",
        "إنشاء مفتاح Google خاص بي (موصى به للاستمرار)")
      if ($c -lt 0) { return }
      if ($c -eq 1) { $key = CreateOwnKey }
    }
    if ($has) { rclone config delete gdrive }
    $extra = @()
    if ($key) { $extra = @("client_id=$($key[0])", "client_secret=$($key[1])"); Step "Using your own Google client_id" }
    Step "Browser will open: sign in to Google and click Allow..."
    rclone config create gdrive drive scope=drive @extra
    if (-not (DriveOK)) {
      if ($key) {
        $a = Msg "فشل الربط بالمفتاح الخاص.`nهل تريد المتابعة الآن بالمفتاح المشترك (يمكنك إعادة المحاولة بالمفتاح الخاص لاحقا)؟" 'YesNo' 'Warning'
        if ($a -ne 'Yes') { return }
        Remove-Item (Join-Path $env:USERPROFILE '.cc-sync-client.txt') -ErrorAction SilentlyContinue
        rclone config delete gdrive
        rclone config create gdrive drive scope=drive
      }
      if (-not (DriveOK)) { throw "تعذر الاتصال بـ Google Drive. أعد تشغيل الملف وتأكد من تسجيل الدخول والموافقة." }
    }
  }
  rclone mkdir gdrive:claude-sessions
  Step "Google Drive connected"

  # ---------- cc-sync script ----------
  try { Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force -ErrorAction Stop } catch { }
  New-Item -ItemType Directory -Force -Path C:\Tools | Out-Null
  $script = @'
param(
  [Parameter(Mandatory=$true)][ValidateSet("push","pull","push-settings","pull-settings")][string]$Action,
  [string]$Project = (Get-Location).Path
)
$env:RCLONE_LOG_LEVEL = "ERROR"
$Remote = "gdrive:claude-sessions"
$Shared = "$Remote/_shared"
$Claude = Join-Path $env:USERPROFILE ".claude"
$script:fail = $false
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Invoke-Rc { & rclone @args; if ($LASTEXITCODE -ne 0) { $script:fail = $true } }
function Read-Json($f) {
  if (Test-Path $f) { try { return (Get-Content $f -Raw | ConvertFrom-Json) } catch { } }
  return (New-Object psobject)
}
function Write-Json($o, $f) { [IO.File]::WriteAllText($f, ($o | ConvertTo-Json -Depth 20), $Utf8) }
function Merge-Keys($dst, $src) {
  foreach ($k in @('enabledPlugins','extraKnownMarketplaces')) {
    if (-not $src.PSObject.Properties[$k]) { continue }
    if (-not $dst.PSObject.Properties[$k]) { $dst | Add-Member -NotePropertyName $k -NotePropertyValue (New-Object psobject) }
    foreach ($p in $src.$k.PSObject.Properties) {
      if (-not $dst.$k.PSObject.Properties[$p.Name]) { $dst.$k | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value }
    }
  }
}
function Get-Conv {
  $proj = (Resolve-Path -LiteralPath $Project).Path
  $name = Split-Path $proj -Leaf
  $mapFile = Join-Path $env:USERPROFILE ".cc-sync-map.json"
  if (Test-Path $mapFile) {
    $m = Get-Content $mapFile -Raw | ConvertFrom-Json
    $v = $m.PSObject.Properties[$proj]
    if ($v) { $name = $v.Value }
  }
  $enc = $proj -replace '[^a-zA-Z0-9]', '-'
  return @{ Name = $name; Local = (Join-Path $Claude "projects\$enc") }
}
function Push-Settings {
  foreach ($d in @('skills','commands','agents')) {
    $p = Join-Path $Claude $d
    if (Test-Path $p) { Invoke-Rc copy $p "$Shared/$d" --update }
  }
  $cm = Join-Path $Claude 'CLAUDE.md'
  if (Test-Path $cm) { Invoke-Rc copyto $cm "$Shared/CLAUDE.md" --update }
  $tmp = Join-Path $env:TEMP 'cc-portable.json'
  Remove-Item $tmp -ErrorAction SilentlyContinue
  $ErrorActionPreference = 'Continue'
  rclone copyto "$Shared/settings-portable.json" $tmp *> $null
  $port = Read-Json $tmp
  Merge-Keys $port (Read-Json (Join-Path $Claude 'settings.json'))
  Write-Json $port $tmp
  Invoke-Rc copyto $tmp "$Shared/settings-portable.json"
}
function Pull-Settings {
  $ErrorActionPreference = 'Continue'
  foreach ($d in @('skills','commands','agents')) {
    rclone copy "$Shared/$d" (Join-Path $Claude $d) --update *> $null
  }
  rclone copyto "$Shared/CLAUDE.md" (Join-Path $Claude 'CLAUDE.md') --update *> $null
  $tmp = Join-Path $env:TEMP 'cc-portable.json'
  Remove-Item $tmp -ErrorAction SilentlyContinue
  rclone copyto "$Shared/settings-portable.json" $tmp *> $null
  if (Test-Path $tmp) {
    $sp = Join-Path $Claude 'settings.json'
    $j = Read-Json $sp
    if (Test-Path $sp) { Copy-Item $sp "$sp.bak" -Force }
    Merge-Keys $j (Read-Json $tmp)
    New-Item -ItemType Directory -Force -Path $Claude | Out-Null
    Write-Json $j $sp
  }
}

switch ($Action) {
  "push" {
    $c = Get-Conv
    if (Test-Path $c.Local) { Invoke-Rc copy $c.Local "$Remote/$($c.Name)" --update }
    $mark = Join-Path $env:TEMP 'cc-settings-push.stamp'
    if (-not (Test-Path $mark) -or ((Get-Date) - (Get-Item $mark).LastWriteTime).TotalMinutes -gt 10) {
      Push-Settings
      Set-Content $mark (Get-Date)
    }
  }
  "pull" {
    $c = Get-Conv
    New-Item -ItemType Directory -Force -Path $c.Local | Out-Null
    Invoke-Rc copy "$Remote/$($c.Name)" $c.Local --update
  }
  "push-settings" { Push-Settings }
  "pull-settings" { Pull-Settings }
}

if ($script:fail) {
  "$(Get-Date) $Action FAILED" | Add-Content "$env:USERPROFILE\cc-sync.log"
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
    "ربط هذا الجهاز بمحادثة موجودة على Drive (أو تحديثها)",
    "فحص أدوات وإضافات محادثة وتثبيت الناقص",
    "مزامنة الإعدادات والإضافات الآن (رفع وتنزيل)"
  )
  if ($choice -lt 0) { return }

  if ($choice -eq 0) {
    # ----- new synced conversation -----
    $proj = PickFolder "اختر مجلد المشروع على هذا الجهاز (أو أنشئ مجلدا جديدا)"
    if (-not $proj) { return }
    $rname = Split-Path $proj -Leaf
    $existing = @(rclone lsf "gdrive:claude-sessions" --dirs-only | ForEach-Object { $_.TrimEnd('/') } | Where-Object { $_ -and $_ -notlike '_*' })
    if ($existing -contains $rname) {
      $a = Msg "يوجد على Drive مشروع بنفس الاسم ($rname).`nهل هو نفس المشروع؟ (نعم = استخدمه، لا = إلغاء)" 'YesNo' 'Question'
      if ($a -ne 'Yes') { return }
    }
    SetMap $proj $rname
    $local = LocalDir $proj
    if (Test-Path $local) { Step "Uploading existing conversations..."; rclone copy $local "gdrive:claude-sessions/$rname" --update }
    Step "Uploading settings..."
    & C:\Tools\cc-sync.ps1 push-settings
    Msg ("تم الربط.`n`nافتح هذا المجلد في Claude Code المحلي وابدأ محادثة جديدة:`n$proj`n`n" +
         "ستُرفع المحادثة تلقائيا إلى Drive بعد كل رد.`n" +
         "على الجهاز الآخر: شغّل هذا الملف واختر (ربط بمحادثة موجودة).`n`n" +
         "مهم: لا تعمل على نفس المحادثة في جهازين في نفس الوقت.") | Out-Null
  }
  elseif ($choice -eq 1) {
    # ----- connect to existing -----
    $remotes = @(rclone lsf "gdrive:claude-sessions" --dirs-only | ForEach-Object { $_.TrimEnd('/') } | Where-Object { $_ -and $_ -notlike '_*' })
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
    Step "Syncing settings and plugins..."
    & C:\Tools\cc-sync.ps1 pull-settings
    CheckTools $local $proj
    Msg ("تم تنزيل المحادثة.`n`nافتح هذا المجلد في Claude Code المحلي وأكمل المحادثة السابقة:`n$proj`n`n" +
         "ستُرفع تعديلاتك تلقائيا بعد كل رد.`n" +
         "ملاحظة: كود المشروع نفسه يجب أن يكون في المجلد (مثلا عبر git clone).") | Out-Null
  }
  elseif ($choice -eq 2) {
    # ----- check tools of a conversation -----
    $proj = PickFolder "اختر مجلد المشروع الذي تريد فحص أدوات محادثته"
    if (-not $proj) { return }
    CheckTools (LocalDir $proj) $proj
  }
  else {
    # ----- sync settings -----
    Step "Uploading settings..."
    & C:\Tools\cc-sync.ps1 push-settings
    Step "Downloading settings..."
    & C:\Tools\cc-sync.ps1 pull-settings
    Msg ("تمت مزامنة الإعدادات (skills والأوامر والوكلاء وCLAUDE.md وقائمة الإضافات).`nأعد تشغيل تطبيق كلود ليلتقط التغييرات.`nلا تتم مزامنة بيانات الدخول ولا مفاتيح MCP.") | Out-Null
  }
}
catch {
  Msg ("حصل خطأ:`n" + $_.Exception.Message) 'OK' 'Error' | Out-Null
}
