# Build Python backend + Tauri app for production distribution
Write-Host "Building AI Desktop UI for Production" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $PSScriptRoot

# Step 1: Build Python backend with PyInstaller
Write-Host "[1/3] Building Python backend with PyInstaller..." -ForegroundColor Yellow
Set-Location "$rootDir/ai-backend"
$pyi = "$(uv run python -c "import sys;print(sys.executable)" | Out-String).Trim()"
$pyiDir = Split-Path -Parent $pyi
$pyinstaller = "$pyiDir/Scripts/pyinstaller.exe"

if (-not (Test-Path $pyinstaller)) {
    Write-Host "  Installing PyInstaller..." -ForegroundColor Gray
    uv add pyinstaller --group build
}

uv run pyinstaller pyinstaller/build.spec --clean --noconfirm
if ($LASTEXITCODE -ne 0) {
    Write-Host "  PyInstaller build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Python backend built successfully!" -ForegroundColor Green

# Step 2: Copy binary to Tauri's external bin directory
Write-Host "[2/3] Copying backend binary to Tauri bundle..." -ForegroundColor Yellow
$targetDir = "$rootDir/src-tauri/binaries"
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Copy-Item "$rootDir/ai-backend/dist/ai-backend.exe" "$targetDir/ai-backend-x86_64-pc-windows-msvc.exe" -Force
Write-Host "  Binary copied!" -ForegroundColor Green

# Step 3: Build Tauri app
Write-Host "[3/3] Building Tauri app..." -ForegroundColor Yellow
Set-Location $rootDir
pnpm tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Tauri build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Tauri app built successfully!" -ForegroundColor Green

Write-Host "`nBuild complete! Installer located in src-tauri/target/release/bundle/" -ForegroundColor Cyan
