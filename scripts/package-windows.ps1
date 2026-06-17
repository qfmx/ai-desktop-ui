param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$tauriDir = Join-Path $root "src-tauri"
$targetDir = Join-Path $tauriDir "target\release"
$bundleDir = Join-Path $targetDir "bundle"
$distDir = Join-Path $root "release\windows"
$portableDir = Join-Path $distDir "AI-Workspace-portable"
$version = (Get-Content -Raw (Join-Path $root "package.json") | ConvertFrom-Json).version

if (-not $SkipBuild) {
  Push-Location $root
  try {
    pnpm tauri build
  } finally {
    Pop-Location
  }
}

if (Test-Path $distDir) {
  Remove-Item -LiteralPath $distDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
New-Item -ItemType Directory -Force -Path $portableDir | Out-Null

$exe = Join-Path $targetDir "ai-desktop-ui.exe"
if (-not (Test-Path $exe)) {
  throw "Release executable not found: $exe"
}

$singleFileExe = Join-Path $distDir "AI-Workspace_$version`_x64_single.exe"
Copy-Item -LiteralPath $exe -Destination $singleFileExe -Force

Copy-Item -LiteralPath $exe -Destination (Join-Path $portableDir "AI-Workspace.exe") -Force

$resources = Join-Path $targetDir "resources"
if (Test-Path $resources) {
  Copy-Item -LiteralPath $resources -Destination (Join-Path $portableDir "resources") -Recurse -Force
}

$readme = @(
  "AI Workspace Portable",
  "",
  "Usage:",
  "1. Extract the whole directory.",
  "2. Run AI-Workspace.exe.",
  "",
  "Notes:",
  "- The portable package does not create Start Menu shortcuts.",
  "- First run still requires Microsoft WebView2 Runtime. Use MSI or NSIS if the target machine does not have it."
) -join [Environment]::NewLine
Set-Content -LiteralPath (Join-Path $portableDir "README.zh-CN.txt") -Value $readme -Encoding UTF8

$portableZip = Join-Path $distDir "AI-Workspace_$version`_x64_portable.zip"
Compress-Archive -LiteralPath (Join-Path $portableDir "*") -DestinationPath $portableZip -Force

$msiDir = Join-Path $bundleDir "msi"
if (Test-Path $msiDir) {
  Get-ChildItem -LiteralPath $msiDir -Filter "*.msi" | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $distDir $_.Name) -Force
  }
}

$nsisDir = Join-Path $bundleDir "nsis"
if (Test-Path $nsisDir) {
  Get-ChildItem -LiteralPath $nsisDir -Filter "*.exe" | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $distDir $_.Name) -Force
  }
}

Get-ChildItem -LiteralPath $distDir | Select-Object Name, Length, LastWriteTime
