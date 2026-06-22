# Start both Python backend and Tauri frontend for development
Write-Host "Starting AI-Workspace - Development Mode" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $PSScriptRoot

# Start Python backend
Write-Host "[1/2] Starting Python backend on http://127.0.0.1:18888..." -ForegroundColor Yellow
$pythonJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    uv run python main.py
} -ArgumentList "$rootDir/ai-backend"

Start-Sleep -Seconds 3

# Check if backend is running
$response = $null
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:18888/api/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  Backend is running!" -ForegroundColor Green
} catch {
    Write-Host "  Warning: Backend may not be ready yet. Check ai-backend logs." -ForegroundColor Red
}

# Start Tauri dev
Write-Host "[2/2] Starting Tauri dev server..." -ForegroundColor Yellow
Set-Location $rootDir
pnpm tauri dev

# Cleanup on exit
Write-Host "Shutting down Python backend..." -ForegroundColor Yellow
Stop-Job $pythonJob -ErrorAction SilentlyContinue
Remove-Job $pythonJob -ErrorAction SilentlyContinue
Write-Host "Done." -ForegroundColor Cyan
