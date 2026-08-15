# ============================================================
#  dsh-plugin-voice-input — 一键安装脚本
#
#  在线安装（推荐，1 条命令）:
#     irm https://raw.githubusercontent.com/NewDaNew/dsh-voice-input/main/install.ps1 | iex
#
#  本地安装（下载仓库 ZIP 解压后）:
#     powershell -ExecutionPolicy Bypass -File install.ps1
#
#  脚本自动完成:
#     1. 定位 DSH 目录（$env:DSH_HOME，默认 ~\.dsh）
#     2. 下载/复制插件文件到 profiles\node_modules\@local\dsh-plugin-voice-input
#     3. 把 loader 行写进 profiles\web\cordis.patch.yml（幂等，重复运行安全）
#     4. 提示重启
# ============================================================
$ErrorActionPreference = 'Stop'

$pluginName = 'dsh-plugin-voice-input'
$pluginId   = 'voice-input'
$pkgName    = '@local/dsh-plugin-voice-input'
$repoBase   = 'https://raw.githubusercontent.com/NewDaNew/dsh-voice-input/main'
$files      = @('package.json', 'README.md', 'LICENSE', 'lib/client.js', 'lib/index.js')

# ---------- 0. 定位 DSH 目录 ----------
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$profileDir  = Join-Path $dshHome 'profiles\web'
$dst         = Join-Path (Join-Path (Join-Path $dshHome 'profiles\node_modules') '@local') $pluginName
$patchFile   = Join-Path $profileDir 'cordis.patch.yml'

Write-Host "==> DSH 目录   : $dshHome"
Write-Host "==> 安装位置   : $dst"

if (-not (Test-Path $profileDir)) {
    Write-Host '[错误] 找不到 web profile: ' $profileDir -ForegroundColor Red
    Write-Host '       请先运行过一次 dsh web（初始化 profile），或检查 DSH_HOME 环境变量。' -ForegroundColor Red
    exit 1
}

# ---------- 1. 获取插件文件（本地模式 / 在线下载模式） ----------
$localSrc = if ($PSScriptRoot) { $PSScriptRoot } else { '' }
$hasLocal = ($localSrc -ne '') -and (Test-Path (Join-Path $localSrc 'package.json'))

New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dst 'lib') | Out-Null

foreach ($f in $files) {
    $dest = Join-Path $dst ($f -replace '/', '\')
    if ($hasLocal) {
        $src = Join-Path $localSrc $f
        if (Test-Path $src) { Copy-Item -Force $src $dest }
    }
    else {
        $url = "$repoBase/$f"
        Write-Host "    downloading $f ..." -ForegroundColor DarkGray
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
    }
}
Write-Host '[OK] 插件文件已就位' -ForegroundColor Green

# ---------- 2. 注册到 cordis.patch.yml（幂等） ----------
$patchText = ''
if (Test-Path $patchFile) { $patchText = Get-Content $patchFile -Raw }
if ($patchText -match "name:\s*'$([regex]::Escape($pkgName))'") {
    Write-Host '[OK] cordis.patch.yml 已注册过该插件（跳过）' -ForegroundColor Green
}
else {
    $entry = @"

# Voice input plugin (installed by install.ps1)
- insert:
    - id: $pluginId
      name: '$pkgName'
"@
    $entry | Out-File -FilePath $patchFile -Append -Encoding ascii
    Write-Host '[OK] 已写入 cordis.patch.yml' -ForegroundColor Green
}

# ---------- 3. 完成提示 ----------
Write-Host ''
Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host '  安装完成！最后两步：' -ForegroundColor Cyan
Write-Host '    1. 重启 dsh web：结束当前 dsh web 进程后重新运行  dsh web' -ForegroundColor Cyan
Write-Host '    2. 刷新浏览器页面，输入框右侧出现 🎤 按钮即可语音输入' -ForegroundColor Cyan
Write-Host '==========================================================' -ForegroundColor Cyan
