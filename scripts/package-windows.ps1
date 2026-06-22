param(
  [switch]$SkipBuild,
  [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$tauriDir = Join-Path $root "src-tauri"
$targetDir = Join-Path $tauriDir "target\release"
$bundleDir = Join-Path $targetDir "bundle"
$distDir = Join-Path $root "release\windows"
$portableDir = Join-Path $distDir "AI-Workspace-portable"
$version = (Get-Content -Raw (Join-Path $root "package.json") | ConvertFrom-Json).version
$tauriConfig = Get-Content -Raw (Join-Path $tauriDir "tauri.conf.json") | ConvertFrom-Json
$binaryName = if ($tauriConfig.mainBinaryName) { $tauriConfig.mainBinaryName } else { $tauriConfig.productName }

function Stop-OutputProcesses {
  param([string]$PathPrefix)

  if (-not (Test-Path $PathPrefix)) {
    return
  }

  $resolvedPrefix = (Resolve-Path $PathPrefix).Path
  Get-Process -Name $binaryName, "ai-backend" -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path.StartsWith($resolvedPrefix, [System.StringComparison]::OrdinalIgnoreCase) } |
    Stop-Process -Force -ErrorAction SilentlyContinue
}

if (-not $SkipBuild) {
  if (-not $SkipBackend) {
    & (Join-Path $PSScriptRoot "build-backend.ps1")
  }
  if (Test-Path $bundleDir) {
    Remove-Item -LiteralPath $bundleDir -Recurse -Force
  }
  Push-Location $root
  try {
    pnpm tauri build --config "src-tauri/tauri.bundle.conf.json"
  } finally {
    Pop-Location
  }
}

Stop-OutputProcesses -PathPrefix $distDir

if (Test-Path $distDir) {
  Remove-Item -LiteralPath $distDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
New-Item -ItemType Directory -Force -Path $portableDir | Out-Null

$exe = Join-Path $targetDir "$binaryName.exe"
if (-not (Test-Path $exe)) {
  throw "Release executable not found: $exe"
}

$sidecarExe = Join-Path $targetDir "ai-backend.exe"
if (-not (Test-Path $sidecarExe)) {
  throw "Backend sidecar not found: $sidecarExe"
}

$singleFileExe = Join-Path $distDir "AI-Workspace_$version`_x64_single.exe"
Copy-Item -LiteralPath $exe -Destination $singleFileExe -Force
Copy-Item -LiteralPath $sidecarExe -Destination (Join-Path $distDir "ai-backend.exe") -Force

Copy-Item -LiteralPath $exe -Destination (Join-Path $portableDir "AI-Workspace.exe") -Force
Copy-Item -LiteralPath $sidecarExe -Destination (Join-Path $portableDir "ai-backend.exe") -Force

$resources = Join-Path $targetDir "resources"
if (Test-Path $resources) {
  Copy-Item -LiteralPath $resources -Destination (Join-Path $portableDir "resources") -Recurse -Force
}

$readme = @(
  "AI-Workspace Portable",
  "",
  "Usage:",
  "1. Extract the whole directory.",
  "2. Run AI-Workspace.exe.",
  "",
  "Notes:",
  "- The portable package does not create Start Menu shortcuts.",
  "- The bundled backend starts automatically.",
  "- First run still requires Microsoft WebView2 Runtime. Use MSI or NSIS if the target machine does not have it."
) -join [Environment]::NewLine
Set-Content -LiteralPath (Join-Path $portableDir "README.zh-CN.txt") -Value $readme -Encoding UTF8

$portableZip = Join-Path $distDir "AI-Workspace_$version`_x64_portable.zip"
Compress-Archive -Path (Join-Path $portableDir "*") -DestinationPath $portableZip -Force

$msiDir = Join-Path $bundleDir "msi"
if (Test-Path $msiDir) {
  Get-ChildItem -LiteralPath $msiDir -Filter "$binaryName*.msi" | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $distDir $_.Name) -Force
  }
}

$nsisDir = Join-Path $bundleDir "nsis"
if (Test-Path $nsisDir) {
  Get-ChildItem -LiteralPath $nsisDir -Filter "$binaryName*.exe" | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $distDir $_.Name) -Force
  }
}

Get-ChildItem -LiteralPath $distDir | Select-Object Name, Length, LastWriteTime
