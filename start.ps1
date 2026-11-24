# MedMapp 2.0 - start the platform locally and open the browser.
#   powershell -ExecutionPolicy Bypass -File .\start.ps1          # normal use: stable production mode
#   powershell -ExecutionPolicy Bypass -File .\start.ps1 -Dev     # developer mode: hot reload while editing code
#   powershell -ExecutionPolicy Bypass -File .\start.ps1 -Rebuild # force a fresh production build
#   powershell -ExecutionPolicy Bypass -File .\start.ps1 -Share   # also open a temporary public https link (Cloudflare Tunnel)
#                                                                #   so someone else can try the platform; DEBUG is off while sharing
# Windows (or Windows Terminal tabs) open for the backend and the site. Stop everything with stop.ps1.
param([switch]$Dev, [switch]$Rebuild, [switch]$Share)
if ($Share) { $Dev = $false }

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$web = Join-Path $root "web"
$venvPy = Join-Path $backend ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPy) -or -not (Test-Path (Join-Path $web "node_modules"))) {
    Write-Host "Avval sozlashni bajaring:  powershell -ExecutionPolicy Bypass -File .\setup.ps1" -ForegroundColor Red
    exit 1
}

foreach ($port in 8000, 3000) {
    $busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($busy) {
        Write-Host "Port $port band (MedMapp allaqachon ishlayapti bo'lishi mumkin). Avval to'xtating:  powershell -ExecutionPolicy Bypass -File .\stop.ps1" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "Ma'lumotlar bazasi yangilanmoqda..." -ForegroundColor Cyan
Push-Location $backend
try {
    & $venvPy manage.py migrate --noinput | Out-Null
    & $venvPy manage.py seed_reference | Out-Null
} finally { Pop-Location }

# ---------------------------------------------------------------- backend first
# The site build renders public pages with live data, so the API must be up before `next build`.
# Share mode: the site is reachable from the internet, so the backend runs with DEBUG off (no error pages with
# internals), accepts the tunnel host, and serves public media itself. backend\.env is not changed.
$shareEnv = ""
if ($Share) {
    $cloudflared = Join-Path $root "tools\cloudflared.exe"
    if (-not (Test-Path $cloudflared)) {
        Write-Host "tools\cloudflared.exe topilmadi. Uni https://github.com/cloudflare/cloudflared/releases dan yuklab, tools papkasiga qo'ying." -ForegroundColor Red
        exit 1
    }
    $shareEnv = "`$env:DEBUG='False'; `$env:ALLOWED_HOSTS='127.0.0.1,localhost,.trycloudflare.com'; " +
        "`$env:CSRF_TRUSTED_ORIGINS='https://*.trycloudflare.com,http://localhost:3000,http://127.0.0.1:3000'; " +
        "`$env:SECURE_SSL_REDIRECT='False'; `$env:SECURE_HSTS_SECONDS='0'; `$env:SERVE_MEDIA='1';"
}
Write-Host "Backend ishga tushirilmoqda:  http://127.0.0.1:8000" -ForegroundColor Cyan
Start-Process powershell -WorkingDirectory $backend -ArgumentList @(
    "-NoExit", "-Command",
    "`$host.UI.RawUI.WindowTitle = 'MedMapp backend (8000)'; $shareEnv & '$venvPy' manage.py runserver 127.0.0.1:8000"
)
Start-Process powershell -WorkingDirectory $backend -WindowStyle Minimized -ArgumentList @(
    "-NoExit", "-Command",
    "`$host.UI.RawUI.WindowTitle = 'MedMapp reminders'; while (`$true) { & '$venvPy' manage.py send_reminders; Start-Sleep -Seconds 300 }"
)
$apiUp = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health/" -UseBasicParsing -TimeoutSec 5
        if ($r.StatusCode -eq 200) { $apiUp = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $apiUp) {
    Write-Host "Backend 60 soniyada javob bermadi. 'MedMapp backend' oynasidagi xabarni tekshiring." -ForegroundColor Red
    exit 1
}
Write-Host "    OK  backend javob bermoqda" -ForegroundColor Green

# ---------------------------------------------------------------- site build (production mode)
if (-not $Dev) {
    $buildId = Join-Path $web ".next\BUILD_ID"
    $needBuild = $Rebuild -or -not (Test-Path $buildId)
    if (-not $needBuild) {
        $builtAt = (Get-Item $buildId).LastWriteTime
        $srcDirs = "app", "components", "lib", "i18n", "messages", "public"
        $newer = Get-ChildItem -Path ($srcDirs | ForEach-Object { Join-Path $web $_ }) -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTime -gt $builtAt } | Select-Object -First 1
        $cfgNewer = Get-ChildItem -Path (Join-Path $web "*") -Include "next.config.ts", "middleware.ts", "package.json", ".env.local" -File |
            Where-Object { $_.LastWriteTime -gt $builtAt } | Select-Object -First 1
        $needBuild = [bool]($newer -or $cfgNewer)
    }
    if ($needBuild) {
        Write-Host "Sayt production rejimi uchun yig'ilmoqda (1-3 daqiqa, faqat kod o'zgarganda)..." -ForegroundColor Cyan
        Push-Location $web
        try {
            $env:NEXT_DIST_DIR = ".next"
            # Old API responses cached by a previous build must not leak into the new one.
            $fetchCache = Join-Path $web ".next\cache\fetch-cache"
            if (Test-Path $fetchCache) { Remove-Item -Recurse -Force $fetchCache -ErrorAction SilentlyContinue }
            $out = Join-Path $env:TEMP "medmapp-build.log"
            # npm writes progress to stderr; keep it out of PowerShell's error stream and judge by the exit code.
            cmd /c "npm run build > `"$out`" 2>&1"
            if ($LASTEXITCODE -ne 0) {
                Get-Content $out -Tail 40
                Write-Host "Sayt yig'ilmadi. Yuqoridagi xabarni tekshiring (to'liq log: $out)." -ForegroundColor Red
                exit 1
            }
        } finally { Pop-Location }
        Write-Host "    OK  sayt yig'ildi" -ForegroundColor Green
    }
}

# ---------------------------------------------------------------- site
if ($Dev) {
    # Dev server gets its own, freshly cleaned output folder (never shared with the production build).
    $devDir = Join-Path $web ".next-dev"
    if (Test-Path $devDir) { Remove-Item -Recurse -Force $devDir -ErrorAction SilentlyContinue }
    $webCmd = "`$host.UI.RawUI.WindowTitle = 'MedMapp web (3000)'; `$env:NEXT_DIST_DIR = '.next-dev'; npm run dev"
    Write-Host "Sayt ishga tushirilmoqda (dasturchi rejimi):  http://localhost:3000" -ForegroundColor Cyan
} else {
    $webCmd = "`$host.UI.RawUI.WindowTitle = 'MedMapp web (3000)'; `$env:NEXT_DIST_DIR = '.next'; npm run start"
    Write-Host "Sayt ishga tushirilmoqda:  http://localhost:3000" -ForegroundColor Cyan
}
Start-Process powershell -WorkingDirectory $web -ArgumentList @("-NoExit", "-Command", $webCmd)

Write-Host "Sayt tayyor bo'lishi kutilmoqda..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 20
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
}
if ($ready -and $Share) {
    $log = Join-Path $env:TEMP "medmapp-tunnel.log"
    if (Test-Path $log) { Remove-Item $log -Force -ErrorAction SilentlyContinue }
    Write-Host "Ommaviy havola ochilmoqda (Cloudflare Tunnel)..." -ForegroundColor Cyan
    Start-Process -FilePath $cloudflared -ArgumentList @("tunnel", "--no-autoupdate", "--url", "http://localhost:3000", "--logfile", $log) -WindowStyle Minimized
    $url = $null
    for ($i = 0; $i -lt 60 -and -not $url; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path $log) {
            $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
            if ($m) { $url = $m.Matches[0].Value }
        }
    }
    if ($url) {
        Set-Content -Path (Join-Path $root "share-link.txt") -Value $url -Encoding ascii
        Write-Host ""
        Write-Host "Ommaviy havola (kompyuter yoqiq va MedMapp ishlab turganda ishlaydi):" -ForegroundColor Green
        Write-Host "  $url" -ForegroundColor Green
        Write-Host "  Xodimlar paneli: $url/admin/login   Hamkor: $url/partner/login   Bemor: $url/login"
        Write-Host "  Havola share-link.txt fayliga ham yozildi. Yopish:  powershell -ExecutionPolicy Bypass -File .\stop.ps1"
        Write-Host ""
    } else {
        Write-Host "Havola 60 soniyada olinmadi. Log: $log" -ForegroundColor Yellow
    }
}
if ($ready) {
    Start-Process "http://localhost:3000"
    Write-Host ""
    Write-Host "MedMapp ishlayapti:" -ForegroundColor Green
    Write-Host "  Sayt ............ http://localhost:3000"
    Write-Host "  Xodimlar paneli . http://localhost:3000/admin/login"
    Write-Host "  Hamkor portali .. http://localhost:3000/partner/login"
    Write-Host "  Bemor kabineti .. http://localhost:3000/login"
    Write-Host "  API hujjatlari .. http://127.0.0.1:8000/swagger/"
    Write-Host ""
    Write-Host "To'xtatish:  powershell -ExecutionPolicy Bypass -File .\stop.ps1"
} else {
    Write-Host "Sayt 3 daqiqada ochilmadi. 'MedMapp web' oynasidagi xabarni tekshiring." -ForegroundColor Yellow
}
