# AGENT.md

本文件给后续 agent 或自动化助手使用。先读它，再读 `docs/README.md`。

## 项目是什么

这是 `AI-Workspace`，一个 Windows 桌面企业 AI 工作台。

技术组成：

- 前端：React 19、TypeScript、Vite、Lucide React
- 桌面壳：Tauri 2、Rust
- 后端：Python FastAPI、SQLite、NumPy 向量索引
- 包管理：前端 `pnpm`，后端 `uv`

后端固定监听：

```text
http://127.0.0.1:18888
```

Vite/Tauri 开发端口：

```text
http://localhost:1420
```

## 先看哪些文档

从这里开始：

1. `docs/README.md`
2. `docs/PROJECT_SPEC.md`
3. `docs/FEATURE_SPEC.md`
4. `docs/ARCHITECTURE.md`
5. `docs/API_SPEC.md`
6. `docs/DATA_SPEC.md`
7. `docs/DEVELOPMENT.md`
8. `docs/PACKAGING.md`

如果要改功能，先更新对应 spec，再改代码。文档必须描述当前真实行为，不能把 UI 占位写成已完整实现。

## 怎么启动

首次依赖安装：

```powershell
pnpm install
cd ai-backend
uv sync
cd ..
```

一键开发启动：

```powershell
.\scripts\dev.ps1
```

手动后端：

```powershell
cd ai-backend
uv run python main.py
```

手动 Tauri：

```powershell
pnpm tauri dev
```

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:18888/api/health
```

## 怎么验证

前端：

```powershell
pnpm build
```

后端：

```powershell
cd ai-backend
uv run python -m py_compile main.py
```

Rust/Tauri：

```powershell
cd src-tauri
cargo check
```

Windows 打包：

```powershell
.\scripts\build-backend.ps1
pnpm package:windows
```

## 主要源码入口

前端：

- `src/main.tsx`: React 挂载和 ThemeProvider。
- `src/App.tsx`: 页面路由、顶部栏、默认模型展示。
- `src/services/api.ts`: 前端所有 HTTP/SSE API 封装。
- `src/pages/ChatPage.tsx`: 智能问答。
- `src/pages/KnowledgePage.tsx`: 知识库。
- `src/pages/ModelPage.tsx`: 模型配置。
- `src/pages/HistoryPage.tsx`: 对话历史。
- `src/pages/SettingsPage.tsx`: 系统设置。

后端：

- `ai-backend/main.py`: FastAPI app 和 Uvicorn 启动。
- `ai-backend/core/config.py`: 配置和环境变量。
- `ai-backend/core/database.py`: SQLite schema 和种子数据。
- `ai-backend/routers/chat.py`: 会话和问答 API。
- `ai-backend/routers/knowledge.py`: 知识库 API。
- `ai-backend/routers/models.py`: 模型供应商 API。
- `ai-backend/routers/settings.py`: 设置 API。
- `ai-backend/services/rag.py`: 向量库和 RAG。
- `ai-backend/services/llm.py`: LLM/embedding provider 调用。
- `ai-backend/services/model_provider.py`: OpenAI 兼容 provider 同步。
- `ai-backend/services/document.py`: 文档解析和切片。

Tauri：

- `src-tauri/src/lib.rs`: 后端 sidecar 启动、健康命令和退出清理。
- `src-tauri/tauri.conf.json`: 基础 Tauri 配置。
- `src-tauri/tauri.bundle.conf.json`: release build externalBin 配置。

脚本：

- `scripts/dev.ps1`: 开发模式启动后端和 Tauri。
- `scripts/build-backend.ps1`: PyInstaller 构建后端。
- `scripts/package-windows.ps1`: Windows 发布产物收集。

## 不要手工改的生成物

不要提交或手工维护：

- `node_modules/`
- `dist/`
- `release/`
- `src-tauri/target/`
- `src-tauri/binaries/`
- `ai-backend/build/`
- `ai-backend/dist/`
- `ai-backend/.venv/`
- `ai-backend/data/*.db`

## 当前实现边界

注意这些不是完整功能：

- 顶部全局搜索未接后端。
- 顶部安全审计和通知按钮没有完整交互。
- 知识库页面没有完整上传表单，上传 API 需要本地 `file_path`。
- 设置页导入/导出按钮没有后端动作。
- 权限矩阵只展示，不在 RAG 检索中强制过滤。
- `system_prompt` 可保存，但当前问答服务仍使用后端代码中的固定系统提示词。

## 变更原则

- 前端新增 API 时先改 `src/services/api.ts`。
- 后端新增业务能力时优先放到 `services/`，router 只做请求响应编排。
- 新增数据库字段时同步更新 `core/database.py`、相关 API、前端类型和 `docs/DATA_SPEC.md`。
- 新增页面或导航时同步更新 `Sidebar.tsx`、`App.tsx` 和 `docs/FEATURE_SPEC.md`。
- 涉及打包行为时同步更新 `docs/PACKAGING.md`。
