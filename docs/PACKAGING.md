# Windows 打包与发布说明

## 1. 打包目标

Windows 发布流程需要同时交付：

- Tauri 桌面主程序 `AI-Workspace.exe`
- Python 后端 sidecar `ai-backend.exe`
- MSI 安装包
- NSIS 安装包
- 单文件主程序拷贝
- portable 目录
- portable zip

## 2. 关键文件

- `scripts/build-backend.ps1`
- `scripts/build-all.ps1`
- `scripts/package-windows.ps1`
- `ai-backend/pyinstaller/build.spec`
- `src-tauri/tauri.conf.json`
- `src-tauri/tauri.bundle.conf.json`

## 3. 后端 sidecar 构建

命令：

```powershell
.\scripts\build-backend.ps1
```

流程：

1. 进入 `ai-backend`。
2. 运行 `uv run --with pyinstaller pyinstaller pyinstaller/build.spec --clean --noconfirm`。
3. 生成 `ai-backend/dist/ai-backend.exe`。
4. 复制到 `src-tauri/binaries/ai-backend-x86_64-pc-windows-msvc.exe`。

PyInstaller spec 特点：

- 入口为 `ai-backend/main.py`。
- 输出名为 `ai-backend`。
- `console=False`，打包后不显示控制台窗口。
- 显式包含 Uvicorn/Starlette 相关 hidden imports。

## 4. Tauri bundle 配置

普通 Tauri 配置：

```text
src-tauri/tauri.conf.json
```

sidecar bundle 覆盖配置：

```text
src-tauri/tauri.bundle.conf.json
```

内容：

```json
{
  "bundle": {
    "externalBin": ["binaries/ai-backend"]
  }
}
```

打包时必须使用：

```powershell
pnpm tauri build --config "src-tauri/tauri.bundle.conf.json"
```

## 5. 完整 Windows 打包

推荐命令：

```powershell
pnpm package:windows
```

等价于运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-windows.ps1
```

流程：

1. 构建后端 sidecar。
2. 删除旧 Tauri bundle 输出。
3. 运行 Tauri release build。
4. 停止发布目录中仍在运行的旧 `AI-Workspace` 或 `ai-backend` 进程。
5. 重建 `release/windows/`。
6. 收集主程序、sidecar、MSI、NSIS。
7. 生成 portable 目录和 zip。

## 6. 只收集已有构建产物

命令：

```powershell
pnpm package:windows:collect
```

用途：

- 已经完成 Tauri release build。
- 只想重新整理 `release/windows/`。

注意：

- 如果 `src-tauri/target/release/AI-Workspace.exe` 或 `ai-backend.exe` 不存在，该命令会失败。

## 7. 输出目录

发布产物目录：

```text
release/windows/
```

版本 `1.0.2` 的预期产物：

- `AI-Workspace_1.0.2_x64-setup.exe`
- `AI-Workspace_1.0.2_x64_zh-CN.msi`
- `AI-Workspace_1.0.2_x64_single.exe`
- `AI-Workspace_1.0.2_x64_portable.zip`
- `AI-Workspace-portable/`
- `ai-backend.exe`

portable 目录包含：

- `AI-Workspace.exe`
- `ai-backend.exe`
- `resources/`，如果 Tauri release 目录存在该目录
- `README.zh-CN.txt`

## 8. 打包后启动行为

安装版或 portable 版启动时：

1. Rust 侧查找主程序同目录的 `ai-backend.exe`。
2. 找到后以 Tauri app data 目录作为工作目录启动后端。
3. 前端访问固定地址 `http://127.0.0.1:18888`。
4. 窗口销毁时，Rust 侧尝试 kill 后端子进程。

## 9. 发布验证

建议发布前执行：

```powershell
pnpm build
cd src-tauri
cargo check
cd ..
.\scripts\build-backend.ps1
pnpm package:windows
```

验证后端：

```powershell
Invoke-RestMethod http://127.0.0.1:18888/api/health
```

验证 portable：

1. 解压或进入 `release/windows/AI-Workspace-portable/`。
2. 运行 `AI-Workspace.exe`。
3. 等待后端自动启动。
4. 访问健康检查接口。

## 10. 注意事项

- `release/`、`src-tauri/target/`、`src-tauri/binaries/` 都是生成物，不应提交。
- 如果目标机器没有 WebView2 Runtime，应优先使用安装包。
- 单文件主程序拷贝仍依赖同目录或合适位置的后端 sidecar；真正 portable 使用 `AI-Workspace-portable/` 或 zip。
