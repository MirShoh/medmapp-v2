# Runs every check CI runs, locally:  powershell -ExecutionPolicy Bypass -File .\tools-check.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$py = Join-Path $root "backend\.venv\Scripts\python.exe"

Write-Host "`n== Backend: ruff ==" -ForegroundColor Cyan
Push-Location (Join-Path $root "backend")
& $py -m ruff check .; if ($LASTEXITCODE) { throw "ruff failed" }
Write-Host "`n== Backend: migrations up to date ==" -ForegroundColor Cyan
& $py -W ignore manage.py makemigrations --check --dry-run; if ($LASTEXITCODE) { throw "missing migrations" }
Write-Host "`n== Backend: tests ==" -ForegroundColor Cyan
& $py -W ignore manage.py test tests; if ($LASTEXITCODE) { throw "tests failed" }
Pop-Location

Write-Host "`n== Web: type check + lint ==" -ForegroundColor Cyan
Push-Location (Join-Path $root "web")
cmd /c "npm run check"; if ($LASTEXITCODE) { throw "web checks failed" }
Pop-Location
Write-Host "`nAll checks passed." -ForegroundColor Green
