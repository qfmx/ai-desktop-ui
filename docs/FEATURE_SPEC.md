# 功能规格说明

## 1. 导航与应用壳

源码入口：

- `src/App.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/contexts/ThemeContext.tsx`

用户可见能力：

- 左侧主导航包含智能问答、知识库、模型配置、对话历史、系统设置。
- 侧边栏可折叠。
- 侧边栏显示后端服务在线状态和审计开关状态。
- 顶部显示当前页面标题、副标题、默认模型、全局搜索输入、安全审计按钮和通知按钮。
- 主题支持暗色和亮色，使用 `localStorage` 保存到 `app-theme`。

当前边界：

- 顶部全局搜索、安全审计按钮、通知按钮是 UI 入口，尚未实现具体交互闭环。

## 2. 智能问答

源码入口：

- `src/pages/ChatPage.tsx`
- `src/components/chat/SessionList.tsx`
- `src/components/chat/MessageThread.tsx`
- `src/components/chat/Composer.tsx`
- `src/components/chat/ContextPanel.tsx`
- `ai-backend/routers/chat.py`
- `ai-backend/services/rag.py`
- `ai-backend/services/llm.py`

功能契约：

- 页面进入后等待后端健康检查。
- 加载会话列表、快捷问题和默认问答设置。
- 支持创建新会话。
- 支持选择会话并加载消息。
- 发送问题时调用 `/api/chat/ask/stream`，以 SSE 形式接收 token。
- 生成完成后将 assistant 消息、模型名和引用写回前端状态。
- 后端会把 user/assistant 消息持久化到 SQLite。
- 右侧上下文面板展示运行时 pipeline、模型路由、审计状态和向量索引统计。

后端行为：

- 普通问答：`POST /api/chat/ask`
- 流式问答：`POST /api/chat/ask/stream`
- 检索：`VectorStore.search()` 查询向量索引。
- 生成：`LLMService` 按模型名路由到 OpenAI、Anthropic 或 Ollama。
- 引用：返回前 5 个检索片段作为 citations。

当前边界：

- 如果向量库为空，检索上下文为空，回答依赖模型自身能力。
- OpenAI embedding 和 chat 调用依赖 `AI_OPENAI_API_KEY` 等环境变量。
- 会话消息 ID 使用时间字符串拼接，极端并发下需注意唯一性。
- Chat 工具栏中的“企业库/网页/混合”模式按钮是前端展示，未接入检索策略参数。

## 3. 知识库

源码入口：

- `src/pages/KnowledgePage.tsx`
- `src/components/knowledge/KnowledgeSummary.tsx`
- `src/components/knowledge/KnowledgeToolbar.tsx`
- `src/components/knowledge/KnowledgeList.tsx`
- `src/components/knowledge/PermissionMatrix.tsx`
- `ai-backend/routers/knowledge.py`
- `ai-backend/services/document.py`
- `ai-backend/services/rag.py`

功能契约：

- 展示知识库统计：知识库数量、文档数量、切片数量、向量维度。
- 展示知识库列表，支持关键字过滤和 grid/list 视图切换。
- 展示知识库健康度、状态、owner、embedding 模型和标签。
- 展示权限矩阵，包含知识库、owner、角色和策略。
- 后端支持创建知识库、删除知识库和通过本地文件路径上传文档。

后端行为：

- `POST /api/knowledge/bases/{id}/upload` 接收 `file_path`，读取本机文件。
- `DocumentService` 支持 `.txt`、`.md`、`.json`、`.csv`、`.py`、`.yaml`、`.yml`、`.xml` 这类文本文件。
- 文档按约 512 字符切片，约 64 字符重叠。
- `VectorStore.add_chunks()` 调用 embedding API 后写入 `data/vector_store/index.json` 和 `vectors.npy`。

当前边界：

- 前端知识库页面没有完整上传文件表单。
- 上传 API 使用服务器本地路径，不是 multipart 文件上传。
- 权限矩阵目前展示策略，不在检索阶段强制过滤。

## 4. 模型配置

源码入口：

- `src/pages/ModelPage.tsx`
- `src/components/model/ModelSummary.tsx`
- `src/components/model/ProviderPanel.tsx`
- `src/components/model/ModelTable.tsx`
- `src/components/model/ModelConfigGrids.tsx`
- `ai-backend/routers/models.py`
- `ai-backend/services/model_provider.py`

功能契约：

- 展示供应商数量、启用模型数量、模型总量和供应商可用性。
- 支持新增模型供应商。
- 支持测试供应商连接。
- 支持从 OpenAI 兼容 `/models` 接口同步模型列表。
- 支持启用/停用单个模型配置。
- 支持保存默认 temperature、top_k、脱敏、fallback、trace 等设置。

供应商行为：

- provider ID 会被规范化为小写 slug。
- API key 只在数据库保存明文，返回前会用 `mask_api_key()` 脱敏。
- 同步模型时生成模型 ID：`{provider_id}:{remote_model_id}`。
- 当前同步协议只支持 OpenAI 兼容模型列表。

当前边界：

- provider 配置会影响 UI 列表，但 `LLMService` 实际运行时主要从环境变量读取 OpenAI/Anthropic/Ollama 地址和 key。
- 模型能力由模型名简单推断，例如 embedding、vision、code。

## 5. 对话历史

源码入口：

- `src/pages/HistoryPage.tsx`
- `src/components/history/HistoryToolbar.tsx`
- `src/components/history/HistoryFilter.tsx`
- `src/components/history/HistoryList.tsx`
- `ai-backend/routers/chat.py`

功能契约：

- 加载全部会话并展示标题、模型、知识范围、消息数量、token 使用量、标签、预览和最后活动时间。
- 支持按关键字过滤。
- 支持按标签过滤。
- 支持收藏/取消收藏会话。
- 支持删除会话，删除时级联删除消息。

当前边界：

- 历史导出没有独立后端接口。
- token 使用量主要依赖数据库字段，流式问答当前没有实际 token 统计。

## 6. 系统设置

源码入口：

- `src/pages/SettingsPage.tsx`
- `ai-backend/routers/settings.py`
- `src/contexts/ThemeContext.tsx`

功能契约：

- 设置分为通用设置、提示词、安全隐私、通知偏好、数据治理。
- 支持保存语言、自动保存、恢复会话、审计、脱敏、通知、提示音、数据保留周期、系统提示词。
- 支持选择前端主题，主题保存在浏览器本地存储。
- 支持加载 prompt templates。
- 支持展示会话数据、知识库索引、审计日志的本地存储大小。

当前边界：

- 主题设置只存在前端 `localStorage`，不通过后端持久化。
- 数据导入、导出按钮尚未绑定后端逻辑。
- `system_prompt` 已保存到 settings 表，但当前问答后端仍使用 `rag.py` 和 `chat.py` 中的固定系统提示词。
