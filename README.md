# AI-Workspace

AI-Workspace is a desktop AI workbench built with Tauri, React, and a local
FastAPI backend. It provides enterprise Q&A, knowledge-base management, model
provider configuration, conversation history, and system settings in one
Windows desktop app.

## Stack

Frontend:

- React 19
- TypeScript 5.8
- Vite 7
- Lucide React

Desktop shell:

- Tauri 2
- Rust
- Windows bundles: MSI through WiX and NSIS installer

Backend:

- Python 3.11+
- FastAPI and Uvicorn
- aiosqlite
- httpx
- NumPy
- sse-starlette
- Pydantic Settings

Package managers:

- pnpm for frontend dependencies
- uv for Python dependencies

## Project Layout

```text
ai-desktop-ui/
  src/                    React frontend
  src-tauri/              Tauri and Rust desktop shell
  src-tauri/binaries/     Generated backend sidecar during packaging
  ai-backend/             Python FastAPI backend
  ai-backend/pyinstaller/ PyInstaller spec for backend sidecar
  scripts/                Development and packaging scripts
  release/windows/        Windows package output
```

Generated build output is intentionally ignored by Git, including
`release/`, `src-tauri/target/`, `src-tauri/binaries/`, `ai-backend/build/`,
and `ai-backend/dist/`.

## Requirements

- Node.js 18+
- pnpm 9+
- Rust stable
- Python 3.11+
- uv
- Microsoft WebView2 Runtime

## Development

Install dependencies:

```powershell
pnpm install
cd ai-backend
uv sync
```

Start both backend and desktop app:

```powershell
.\scripts\dev.ps1
```

Run the backend manually:

```powershell
cd ai-backend
uv run python main.py
```

Run the Tauri app in development mode:

```powershell
pnpm tauri dev
```

The backend listens on `http://127.0.0.1:18888`.

## Build And Package

Build the frontend only:

```powershell
pnpm build
```

Build the backend sidecar only:

```powershell
.\scripts\build-backend.ps1
```

Create the full Windows package set:

```powershell
pnpm package:windows
```

The full package flow:

1. Builds `ai-backend` with PyInstaller.
2. Copies it to `src-tauri/binaries/ai-backend-x86_64-pc-windows-msvc.exe`.
3. Builds Tauri with `src-tauri/tauri.bundle.conf.json`, which includes the
   backend as an external binary.
4. Collects installers, single exe, portable directory, and portable zip into
   `release/windows/`.

Collect existing build output without rebuilding:

```powershell
pnpm package:windows:collect
```

## Windows Outputs

After packaging, `release/windows/` contains:

- `AI-Workspace_1.0.1_x64-setup.exe`
- `AI-Workspace_1.0.1_x64_zh-CN.msi`
- `AI-Workspace_1.0.1_x64_single.exe`
- `AI-Workspace_1.0.1_x64_portable.zip`
- `AI-Workspace-portable/`
- `ai-backend.exe`

The packaged desktop app starts the bundled backend automatically. Users do
not need to run `uv run python main.py` for the installed or portable build.

## Backend Packaging Notes

The packaged backend is a PyInstaller sidecar. Two runtime details are handled
in `ai-backend/main.py`:

- Standard streams are initialized when PyInstaller runs without a console, so
  Uvicorn logging does not fail on `None.isatty()`.
- Uvicorn receives the FastAPI `app` object directly instead of the string
  `"main:app"`, so the frozen executable does not need to import `main` again.

In packaged mode, the desktop shell runs backend data under the Tauri app data
directory instead of writing beside the installed executable.

## API

Health check:

```http
GET http://127.0.0.1:18888/api/health
```

Expected response:

```json
{"status":"ok","app":"AI-Workspace"}
```

Main routes:

- `GET /api/health`
- `POST /api/chat/ask`
- `POST /api/chat/ask/stream`
- `GET /api/chat/sessions`
- `GET /api/knowledge/bases`
- `POST /api/knowledge/bases/{id}/upload`
- `GET /api/models/providers`
- `POST /api/models/providers/{id}/test`
- `GET /api/settings`
- `POST /api/settings`

## Verification For 1.0.1

Completed checks:

- `uv run python -m py_compile main.py`
- `cargo check`
- `pnpm build`
- `.\scripts\build-backend.ps1`
- `pnpm package:windows`
- `pnpm package:windows:collect`
- Direct `ai-backend.exe` health check
- Portable `AI-Workspace.exe` auto-start backend health check
