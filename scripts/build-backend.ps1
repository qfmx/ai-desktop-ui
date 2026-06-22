$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendDir = Join-Path $rootDir "ai-backend"
$sourceExe = Join-Path $backendDir "dist\ai-backend.exe"
$targetDir = Join-Path $rootDir "src-tauri\binaries"
$targetExe = Join-Path $targetDir "ai-backend-x86_64-pc-windows-msvc.exe"

Write-Host "Building AI-Workspace backend with PyInstaller..." -ForegroundColor Yellow

Push-Location $backendDir
try {
  uv run --with pyinstaller pyinstaller pyinstaller/build.spec --clean --noconfirm
  if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

if (-not (Test-Path $sourceExe)) {
  throw "Backend executable not found: $sourceExe"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item -LiteralPath $sourceExe -Destination $targetExe -Force

Write-Host "Backend sidecar copied to $targetExe" -ForegroundColor Green
