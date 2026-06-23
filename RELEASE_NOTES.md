# Release 1.0.2

## Summary

This release improves conversation history management and the model/provider
configuration workflow while keeping session editing focused in the history page.

## Changes

- Added conversation history rename and tag editing.
- Redesigned history filters with single-select archive state and multi-select tags.
- Added double-click navigation from history rows back into the chat session view.
- Removed rename and tag editing actions from the chat page session list.
- Improved chat markdown rendering and model/provider management UI.
- Updated backend model provider handling and related API/data specifications.
- Bumped app, Tauri, Rust, and Python package versions to `1.0.2`.

## Outputs

- `AI-Workspace_1.0.2_x64-setup.exe`
- `AI-Workspace_1.0.2_x64_zh-CN.msi`
- `AI-Workspace_1.0.2_x64_single.exe`
- `AI-Workspace_1.0.2_x64_portable.zip`
- `AI-Workspace-portable/`
- `ai-backend.exe`

## Verification

- `npm run build`
- `pnpm package:windows`

# Release 1.0.1

## Summary

This release standardizes the Windows app name as `AI-Workspace` and packages
the Python backend into the desktop distribution. Installed and portable builds
now start the backend automatically.

## Changes

- Bumped app, Tauri, Rust, and Python package versions to `1.0.1`.
- Renamed Windows product, main executable, window title, installers, and
  portable artifacts to `AI-Workspace`.
- Added a PyInstaller backend sidecar build step.
- Added `src-tauri/tauri.bundle.conf.json` so release builds include
  `ai-backend.exe` without forcing normal `cargo check` or development builds
  to require the generated binary.
- Updated the Tauri shell to locate the packaged backend executable and run it
  with an application data working directory.
- Fixed packaged backend startup by initializing standard streams for
  no-console PyInstaller mode.
- Fixed frozen backend startup by passing the FastAPI `app` object directly to
  Uvicorn instead of using `"main:app"`.
- Improved Windows packaging collection, including portable zip generation and
  stale output process cleanup.
- Added ignore rules for Python, PyInstaller, and Tauri generated output.

## Outputs

- `AI-Workspace_1.0.1_x64-setup.exe`
- `AI-Workspace_1.0.1_x64_zh-CN.msi`
- `AI-Workspace_1.0.1_x64_single.exe`
- `AI-Workspace_1.0.1_x64_portable.zip`
- `AI-Workspace-portable/`
- `ai-backend.exe`

## Verification

- `uv run python -m py_compile main.py`
- `cargo check`
- `pnpm build`
- `.\scripts\build-backend.ps1`
- `pnpm package:windows`
- `pnpm package:windows:collect`
- Direct `ai-backend.exe` health check returned
  `{"status":"ok","app":"AI-Workspace"}`
- Portable `AI-Workspace.exe` auto-started the backend and the health check
  returned `{"status":"ok","app":"AI-Workspace"}`

# Release 1.0.0

Initial production release of AI-Workspace.

## Highlights

- Professional dark AI workbench UI.
- Enterprise Q&A workspace with citations and runtime context.
- Knowledge base management view with health, status, and access matrix.
- Model configuration view with providers, model toggles, routing, and safety
  options.
- Conversation history and system settings pages.
- Windows packaging configuration for zh-CN MSI and multilingual NSIS
  installer.
- Windows packaging helper for installer collection, single executable copy,
  and portable zip.

## Verification

- Frontend build: `pnpm build`
- Windows packaging: `pnpm package:windows`
