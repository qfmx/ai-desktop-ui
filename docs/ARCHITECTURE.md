# 架构说明

## 1. 总览

```text
Windows desktop
  |
  | Tauri 2 window
  v
React + Vite frontend
  |
  | HTTP fetch / SSE
  v
FastAPI backend on 127.0.0.1:18888
  |
  +-- SQLite: data/app.db
  +-- Vector store: data/vector_store/index.json + vectors.npy
  +-- LLM providers: OpenAI / Anthropic / Ollama-compatible runtime
```

前端不直接访问数据库或模型供应商。所有业务数据都通过 `src/services/api.ts` 访问本机 FastAPI 服务。

## 2. Tauri 桌面壳

关键文件：

- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/tauri.bundle.conf.json`
- `src-tauri/capabilities/default.json`

职责：

- 创建桌面窗口。
- 在 setup 阶段尝试启动 Python 后端。
- 在窗口销毁时 kill 子进程。
- 暴露 `get_backend_status` 和 `get_backend_url` Tauri command。
- 打包时包含 `ai-backend.exe` sidecar。

后端查找顺序：

1. 当前 exe 同目录的 `ai-backend.exe`。
2. 当前 exe 同目录 `binaries/ai-backend-x86_64-pc-windows-msvc.exe`。
3. 当前工作目录下的 `ai-backend/main.py`，使用 `uv run python main.py` 启动。

打包模式下，后端工作目录使用 Tauri app data 目录，避免写入安装目录。

## 3. React 前端

关键文件：

- `src/main.tsx`
- `src/App.tsx`
- `src/services/api.ts`
- `src/pages/*.tsx`
- `src/components/**`
- `src/styles/global.css`
- `src/App.css`

职责：

- 提供五个主页面。
- 通过 `api` service 调用后端。
- 管理页面状态、流式输出、筛选、表单和主题。
- 使用 Lucide React 图标。

页面边界：

- `ChatPage` 负责会话和问答。
- `KnowledgePage` 负责知识库展示、统计和权限矩阵。
- `ModelPage` 负责 provider、模型列表和默认参数。
- `HistoryPage` 负责会话历史筛选、收藏和删除。
- `SettingsPage` 负责偏好、提示词、安全、通知和存储展示。

## 4. FastAPI 后端

关键文件：

- `ai-backend/main.py`
- `ai-backend/core/config.py`
- `ai-backend/core/database.py`
- `ai-backend/routers/*.py`
- `ai-backend/services/*.py`

启动流程：

1. `main.py` 创建 FastAPI app。
2. 注册 CORS。
3. 注册 health、chat、knowledge、models、settings router。
4. startup 事件调用 `init_db()`。
5. `uvicorn.run(app, host=settings.host, port=settings.port)` 启动服务。

配置来源：

- 默认值定义在 `core/config.py`。
- 环境变量前缀为 `AI_`。
- 本地 `.env` 文件可放在 `ai-backend/.env`，该文件已被 `.gitignore` 忽略。

## 5. 数据层

SQLite：

- 路径：`data/app.db`
- 连接：`ai-backend/core/database.py:get_db()`
- 初始化：`init_db()`
- 默认启用 WAL 和 foreign keys。

向量索引：

- 路径：`data/vector_store/`
- 元数据：`index.json`
- 向量：`vectors.npy`
- 实例：`services/rag.py:vector_store`

注意：

- 当前向量检索使用 dot product，没有显式归一化。
- 向量维度由 embedding provider 返回结果决定。
- 删除知识库时会同步删除该知识库对应的向量片段。

## 6. 请求链路

流式问答链路：

```text
Composer.send
  -> api.chat.askStream()
  -> POST /api/chat/ask/stream
  -> insert user message
  -> vector_store.search()
  -> llm.chat_completion_stream()
  -> SSE token events
  -> SSE done event
  -> insert assistant message
```

知识库上传链路：

```text
POST /api/knowledge/bases/{base_id}/upload
  -> DocumentService.parse(file_path)
  -> text chunks
  -> llm.embedding()
  -> VectorStore.add_chunks()
  -> update knowledge_bases.documents
```

模型同步链路：

```text
POST /api/models/providers/{provider_id}/sync-models
  -> fetch {endpoint}/models
  -> parse OpenAI-compatible payload
  -> insert or update model_configs
  -> set provider status connected
```

## 7. 打包架构

```text
ai-backend/main.py
  -> PyInstaller
  -> ai-backend/dist/ai-backend.exe
  -> src-tauri/binaries/ai-backend-x86_64-pc-windows-msvc.exe
  -> Tauri externalBin
  -> release/windows/*
```

`package-windows.ps1` 会额外生成：

- installer exe
- MSI
- 单文件主程序拷贝
- portable 目录
- portable zip
- sidecar 拷贝
