# MedMapp 2.0 - stop everything started by start.ps1.
#   powershell -ExecutionPolicy Bypass -File .\stop.ps1
# Works whether the windows opened as separate consoles or as Windows Terminal tabs.

# 1. Whatever listens on the MedMapp ports (backend and site).
foreach ($port in 8000, 3000) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop; Write-Host "Port $port to'xtatildi" } catch { }
    }
}

# 2. The shells start.ps1 opened (found by their command line, so Windows Terminal tabs are included),
#    and their child processes (npm, node, python).
$shells = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*MedMapp backend (8000)*" -or $_.CommandLine -like "*MedMapp web (3000)*" -or $_.CommandLine -like "*MedMapp reminders*" }
foreach ($s in $shells) {
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($s.ProcessId)" -ErrorAction SilentlyContinue
    foreach ($ch in $children) {
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$($ch.ProcessId)" -ErrorAction SilentlyContinue |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id $ch.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Stop-Process -Id $s.ProcessId -Force -ErrorAction SilentlyContinue
}
# 3. The public share link (start.ps1 -Share), if one is open.
$cf = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
if ($cf) { $cf | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Host "Ommaviy havola yopildi" }
$shareFile = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "share-link.txt"
if (Test-Path $shareFile) { Remove-Item $shareFile -Force -ErrorAction SilentlyContinue }
Write-Host "MedMapp to'xtatildi."
