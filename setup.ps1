# MedMapp 2.0 - local setup (Windows PowerShell 5.1+). Safe to run again at any time.
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Demo            # also create [DEMO] data + test accounts
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1 -SkipSuperuser   # don't ask to create an admin
param([switch]$Demo, [switch]$SkipSuperuser)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$web = Join-Path $root "web"

function Step($n, $text) { Write-Host ""; Write-Host "[$n] $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "    OK  $text" -ForegroundColor Green }
function Fail($text) { Write-Host ""; Write-Host "XATO: $text" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------- 1. Python
Step 1 "Python tekshirilmoqda (3.10 - 3.12 kerak)"
$pyCmd = $null
foreach ($v in @("3.12", "3.11", "3.10")) {
    try {
        $out = & py "-$v" -c "import sys; print(sys.version.split()[0])" 2>$null
        if ($LASTEXITCODE -eq 0 -and $out) { $pyCmd = @("py", "-$v"); Ok "Python $out (py -$v)"; break }
    } catch { }
}
if (-not $pyCmd) {
    try {
        $out = & python -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
        if ($out -in @("3.10", "3.11", "3.12")) { $pyCmd = @("python"); Ok "Python $out (python)" }
    } catch { }
}
if (-not $pyCmd) { Fail "Python 3.12 topilmadi. https://www.python.org/downloads/release/python-3128/ dan o'rnating ('Add python.exe to PATH' belgisini qo'ying) va skriptni qayta ishga tushiring." }

# ---------------------------------------------------------------- 2. Node.js
Step 2 "Node.js tekshirilmoqda (20 yoki undan yuqori kerak)"
try { $nodeV = (& node --version) } catch { $nodeV = $null }
if (-not $nodeV) { Fail "Node.js topilmadi. https://nodejs.org dan LTS versiyasini o'rnating va skriptni qayta ishga tushiring." }
$major = [int]($nodeV.TrimStart("v").Split(".")[0])
if ($major -lt 20) { Fail "Node.js $nodeV juda eski. Node.js 20 LTS yoki undan yangisini o'rnating." }
Ok "Node.js $nodeV"

# ---------------------------------------------------------------- 3. Backend virtual environment
Step 3 "Backend muhiti (virtual environment) tayyorlanmoqda"
$venvPy = Join-Path $backend ".venv\Scripts\python.exe"
$healthy = $false
if (Test-Path $venvPy) {
    & $venvPy -c "import sys; assert sys.version_info[:2] <= (3, 12)" 2>$null
    $healthy = ($LASTEXITCODE -eq 0)
}
if (-not $healthy) {
    if (Test-Path (Join-Path $backend ".venv")) { Remove-Item -Recurse -Force (Join-Path $backend ".venv") }
    $pyExe = $pyCmd[0]
    $pyArgs = @()
    if ($pyCmd.Count -gt 1) { $pyArgs += $pyCmd[1] }
    & $pyExe @($pyArgs + @("-m", "venv", (Join-Path $backend ".venv")))
    if ($LASTEXITCODE -ne 0) { Fail "Virtual environment yaratilmadi." }
}
Ok ".venv tayyor"

Step 4 "Python paketlari o'rnatilmoqda (birinchi marta 2-5 daqiqa)"
& $venvPy -m pip install --disable-pip-version-check -q --upgrade pip
& $venvPy -m pip install --disable-pip-version-check -q -r (Join-Path $backend "requirements.txt")
if ($LASTEXITCODE -ne 0) { Fail "Paketlar o'rnatilmadi. Internet aloqasini tekshiring va qayta urinib ko'ring." }
Ok "requirements.txt o'rnatildi"

# ---------------------------------------------------------------- 5. Backend settings
Step 5 "backend\.env sozlamalari"
$envFile = Join-Path $backend ".env"
if (-not (Test-Path $envFile)) {
    $chars = (48..57) + (65..90) + (97..122)
    $secret = -join ((1..50) | ForEach-Object { [char]($chars | Get-Random) })
    @(
        "# Local development settings (created by setup.ps1). Do not use on a public server.",
        "DEBUG=True",
        "DB_ENGINE=sqlite",
        "SECRET_KEY=$secret",
        "ALLOWED_HOSTS=127.0.0.1,localhost",
        "EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend",
        "# Optional integrations - fill in to enable:",
        "TELEGRAM_BOT_TOKEN=",
        "TELEGRAM_CHAT_ID=",
        "ANTHROPIC_API_KEY=",
        "CURRENCY_API_URL="
    ) | Out-File -FilePath $envFile -Encoding ascii
    Ok "yangi backend\.env yaratildi (SQLite bazasi, tasodifiy SECRET_KEY)"
} else {
    Ok "mavjud backend\.env saqlab qolindi"
}

# ---------------------------------------------------------------- 6. Database
Step 6 "Ma'lumotlar bazasi (migratsiya + boshlang'ich ma'lumotlar)"
Push-Location $backend
try {
    & $venvPy manage.py migrate --noinput
    if ($LASTEXITCODE -ne 0) { Fail "Migratsiya bajarilmadi." }
    & $venvPy manage.py seed_reference
    if ($LASTEXITCODE -ne 0) { Fail "Boshlang'ich ma'lumotlar yuklanmadi." }
    & $venvPy manage.py import_partners
    if ($LASTEXITCODE -ne 0) { Fail "Boshlang'ich ma'lumotlar yuklanmadi." }
    & $venvPy manage.py import_regional
    if ($LASTEXITCODE -ne 0) { Fail "Boshlang'ich ma'lumotlar yuklanmadi." }
    & $venvPy manage.py seed_content
    if ($LASTEXITCODE -ne 0) { Fail "Boshlang'ich ma'lumotlar yuklanmadi." }
    & $venvPy manage.py import_hospital_photos
    if ($LASTEXITCODE -ne 0) { Fail "Boshlang'ich ma'lumotlar yuklanmadi." }
    Ok "baza tayyor: backend\db.sqlite3"
    if ($Demo) {
        & $venvPy manage.py seed_demo
        Ok "demo ma'lumotlar: test akkauntlari backend\.demo-credentials faylida"
    }
} finally { Pop-Location }

# ---------------------------------------------------------------- 7. Frontend
Step 7 "Frontend paketlari o'rnatilmoqda (birinchi marta 2-5 daqiqa)"
Push-Location $web
try {
    $webEnv = Join-Path $web ".env.local"
    if (-not (Test-Path $webEnv)) { Copy-Item (Join-Path $web ".env.example") $webEnv; Ok "web\.env.local yaratildi" }
    if (Test-Path (Join-Path $web "package-lock.json")) { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }
    if ($LASTEXITCODE -ne 0) { Fail "npm paketlari o'rnatilmadi." }
    Ok "node_modules tayyor"
} finally { Pop-Location }

# ---------------------------------------------------------------- 8. Admin account
if (-not $SkipSuperuser) {
    Step 8 "Super Admin akkaunti"
    $has = & $venvPy (Join-Path $backend "manage.py") shell -c "from django.contrib.auth import get_user_model as g; print(g().objects.filter(is_superuser=True).exists())" 2>$null
    if ("$has".Trim() -eq "True") {
        Ok "Super Admin allaqachon mavjud"
    } else {
        Write-Host "    Birinchi administratorni yarating (Username o'rniga emailingizni yozish tavsiya etiladi):" -ForegroundColor Yellow
        Push-Location $backend
        try { & $venvPy manage.py createsuperuser } finally { Pop-Location }
    }
}

Write-Host ""
Write-Host "Tayyor! Endi platformani ishga tushiring:" -ForegroundColor Green
Write-Host "    powershell -ExecutionPolicy Bypass -File .\start.ps1"
