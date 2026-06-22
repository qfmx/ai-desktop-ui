# 开发指南

## 1. 环境要求

- Windows PowerShell
- Node.js 18+
- pnpm 9+
- Rust stable
- Python 3.11+
- uv
- Microsoft WebView2 Runtime

## 2. 安装依赖

前端依赖：

```powershell
pnpm install
```

后端依赖：

```powershell
cd ai-backend
uv sync
```

可选后端环境变量：

```powershell
cd ai-backend
New-Item -ItemType File -Force .env
```

`.env` 示例：

```dotenv
AI_OPENAI_API_KEY=sk-...
AI_OPENAI_BASE_URL=https://api.openai.com/v1
AI_DEFAULT_LLM_MODEL=gpt-4o-mini
AI_DEFAULT_EMBEDDING_MODEL=text-embedding-3-large
```

## 3. 一键启动

从项目根目录运行：

```powershell
.\scripts\dev.ps1
```

脚本行为：

1. 使用 PowerShell Job 在 `ai-backend` 目录运行 `uv run python main.py`。
2. 等待并检查 `http://127.0.0.1:18888/api/health`。
3. 在项目根目录运行 `pnpm tauri dev`。
4. Tauri 退出后清理 Python 后端 Job。

## 4. 手动启动

后端：

```powershell
cd ai-backend
uv run python main.py
```

前端网页开发服务器：

```powershell
pnpm dev
```

Tauri 开发模式：

```powershell
pnpm tauri dev
```

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:18888/api/health
```

预期结果：

```json
{
  "status": "ok",
  "app": "AI-Workspace"
}
```

## 5. 常用命令

前端构建：

```powershell
pnpm build
```

Vite 预览：

```powershell
pnpm preview
```

Tauri 命令：

```powershell
pnpm tauri
```

后端语法检查：

```powershell
cd ai-backend
uv run python -m py_compile main.py
```

Rust 检查：

```powershell
cd src-tauri
cargo check
```

后端 sidecar 构建：

```powershell
.\scripts\build-backend.ps1
```

Windows 完整打包：

```powershell
pnpm package:windows
```

只收集已有 Windows 构建产物：

```powershell
pnpm package:windows:collect
```

## 6. 开发约定

前端：

- API 调用集中放在 `src/services/api.ts`。
- 页面级状态放在 `src/pages/*Page.tsx`。
- 可复用 UI 放在 `src/components/{domain}/`。
- 类型定义放在 `src/types/`。
- 页面新增时需要更新 `PageKey`、`navItems` 和 `pageTitles`。

后端：

- 路由放在 `ai-backend/routers/`。
- 可复用业务逻辑放在 `ai-backend/services/`。
- 数据库 schema 和种子数据放在 `ai-backend/core/database.py`。
- 配置默认值放在 `ai-backend/core/config.py`。
- 新增配置优先支持 `AI_` 环境变量。

打包：

- 不要手工提交 `src-tauri/binaries/`。
- 不要手工提交 `ai-backend/dist/` 或 `ai-backend/build/`。
- 打包链路以 `scripts/package-windows.ps1` 为准。

## 7. 验证清单

普通代码变更建议至少执行：

```powershell
pnpm build
```

涉及后端 Python：

```powershell
cd ai-backend
uv run python -m py_compile main.py
```

涉及 Tauri/Rust：

```powershell
cd src-tauri
cargo check
```

涉及 Windows 发布：

```powershell
.\scripts\build-backend.ps1
pnpm package:windows
```

## 8. 常见问题

后端连接失败：

- 确认 `18888` 端口未被占用。
- 在 `ai-backend` 目录手动运行 `uv run python main.py` 看错误。
- 检查 `ai-backend/.env` 中 provider 配置。

问答失败：

- 如果使用 OpenAI 默认模型，需要配置 `AI_OPENAI_API_KEY`。
- 如果知识库向量为空，检索不会返回引用。
- 如果 embedding 调用失败，知识库上传和 RAG 检索都会失败。

打包后后端不启动：

- 检查发布目录是否有 `ai-backend.exe`。
- 检查 PyInstaller 构建是否成功。
- 检查是否由 `src-tauri/tauri.bundle.conf.json` 进行 release build。
