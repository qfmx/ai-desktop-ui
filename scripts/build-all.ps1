# Build Python backend + Tauri app for production distribution
Write-Host "Building AI-Workspace for Production" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $PSScriptRoot

# Step 1: Build Python backend with PyInstaller
Write-Host "[1/3] Building Python backend with PyInstaller..." -ForegroundColor Yellow
& "$PSScriptRoot\build-backend.ps1"
Write-Host "  Python backend built successfully!" -ForegroundColor Green

# Step 2: Copy binary to Tauri's external bin directory
Write-Host "[2/3] Copying backend binary to Tauri bundle..." -ForegroundColor Yellow
Write-Host "  Binary copied by build-backend.ps1!" -ForegroundColor Green

# Step 3: Build Tauri app
Write-Host "[3/3] Building Tauri app..." -ForegroundColor Yellow
Set-Location $rootDir
pnpm tauri build --config "src-tauri/tauri.bundle.conf.json"
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Tauri build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Tauri app built successfully!" -ForegroundColor Green

Write-Host "`nBuild complete! Installer located in src-tauri/target/release/bundle/" -ForegroundColor Cyan
