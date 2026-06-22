# 项目规格说明

## 1. 项目目标

AI-Workspace 是一个企业本地桌面 AI 工作台。它通过 Tauri 桌面壳承载 React 前端，通过本机 FastAPI 服务提供问答、知识库、模型配置、历史记录和系统设置能力。

核心目标：

- 在 Windows 桌面环境中提供企业知识问答入口。
- 通过本地 SQLite 保存会话、知识库、模型供应商和设置。
- 支持本地启动 Python 后端，也支持打包后由 Tauri 自动拉起后端 sidecar。
- 以 OpenAI 兼容模型接口为主，保留 Anthropic、Ollama 等 provider 路由。
- 支持知识库文档解析、向量索引、检索增强生成和引用展示。

## 2. 当前范围

已实现范围：

- 桌面应用壳：窗口尺寸、应用名、打包配置、后端 sidecar 启动与退出清理。
- 前端工作区：智能问答、知识库、模型配置、对话历史、系统设置。
- 后端 API：健康检查、会话、问答、流式问答、知识库、模型供应商、设置。
- 数据持久化：SQLite 数据库、向量索引 JSON 与 NumPy 文件。
- 打包发布：PyInstaller 构建后端，Tauri 打包 MSI/NSIS，收集单文件 exe、portable zip 和 sidecar。

暂未完全实现或仅 UI 占位：

- 顶部全局搜索输入框尚未接入统一搜索 API。
- 顶部安全审计和通知按钮没有展开面板或后端接口。
- 知识库页面当前主要展示列表、统计和权限矩阵，前端没有完整新建/上传表单闭环。
- 设置页“导出数据”和“导入备份”按钮当前没有绑定后端逻辑。
- 知识库权限矩阵目前用于展示，RAG 检索路径没有实际执行角色过滤。
- 模型 provider 可同步 OpenAI 兼容模型列表，但默认 LLM 运行仍依赖环境变量中的 provider key。

## 3. 运行形态

开发模式：

- `scripts/dev.ps1` 使用 PowerShell Job 启动 `ai-backend/main.py`。
- 同一脚本随后运行 `pnpm tauri dev`。
- Vite 固定端口为 `1420`，后端固定端口为 `18888`。

打包模式：

- `scripts/build-backend.ps1` 用 PyInstaller 生成 `ai-backend.exe`。
- Tauri bundle 配置通过 `src-tauri/tauri.bundle.conf.json` 引入 `binaries/ai-backend`。
- Rust 侧启动时优先查找同目录 `ai-backend.exe`，并以 Tauri app data 目录作为后端工作目录。

## 4. 技术栈

前端：

- React 19
- TypeScript 5.8
- Vite 7
- Lucide React

桌面壳：

- Tauri 2
- Rust 2021
- `tauri-plugin-opener`
- `tauri-plugin-shell`
- `reqwest` 用于后端健康检查命令

后端：

- Python 3.11+
- FastAPI
- Uvicorn
- aiosqlite
- httpx
- NumPy
- sse-starlette
- pydantic-settings

工具：

- `pnpm` 管理前端依赖
- `uv` 管理 Python 依赖
- PyInstaller 打包后端 sidecar
- WiX/NSIS 由 Tauri 生成 Windows 安装包

## 5. 目录边界

```text
ai-desktop-ui/
  src/                    React 前端源码
  src-tauri/              Tauri/Rust 桌面壳
  ai-backend/             Python FastAPI 后端
  scripts/                开发、后端构建、Windows 打包脚本
  public/                 Vite 静态资源
  data/                   本地运行数据，开发环境可能生成
  dist/                   前端构建输出，生成物
  release/                Windows 发布产物，生成物
```

不应手工维护的生成物：

- `node_modules/`
- `dist/`
- `release/`
- `src-tauri/target/`
- `src-tauri/binaries/`
- `ai-backend/build/`
- `ai-backend/dist/`
- `ai-backend/.venv/`
- `ai-backend/data/*.db`

## 6. 成功标准

一个可接受的项目状态应满足：

- `pnpm install` 和 `uv sync` 可以准备依赖。
- `.\scripts\dev.ps1` 可以启动后端和 Tauri 开发应用。
- `GET http://127.0.0.1:18888/api/health` 返回 `{"status":"ok","app":"AI-Workspace"}`。
- `pnpm build` 可以完成前端构建。
- `.\scripts\build-backend.ps1` 可以生成并复制后端 sidecar。
- `pnpm package:windows` 可以产出 Windows 安装包、单文件 exe、portable 目录和 portable zip。
