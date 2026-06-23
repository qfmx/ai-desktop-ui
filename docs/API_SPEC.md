# API 规格说明

后端基础地址：

```text
http://127.0.0.1:18888
```

前端封装入口：

```text
src/services/api.ts
```

所有普通 JSON 请求默认带 `Content-Type: application/json`。流式问答使用 Server-Sent Events 格式返回 `data: {...}` 行。

## 1. Health

### GET `/api/health`

用途：检查后端是否可用。

响应：

```json
{
  "status": "ok",
  "app": "AI-Workspace"
}
```

## 2. Chat

### GET `/api/chat/quick-actions`

用途：获取首页快捷问题。

响应字段：

- `id`
- `title`
- `prompt`

### GET `/api/chat/runtime-context?session_id={id}`

用途：获取当前会话的 pipeline、模型路由、审计状态和向量统计。

响应字段：

- `pipeline`: 运行步骤列表
- `routing`: 模型路由列表
- `audit`: 审计状态
- `scope`: 当前知识范围
- `stats`: 向量索引统计

### GET `/api/chat/sessions`

用途：获取未归档会话列表，按 `updated_at DESC` 排序。可通过 `include_archived=true` 或 `archived=true/false` 调整归档筛选。

### GET `/api/chat/sessions/{session_id}`

用途：获取单个会话和消息列表。

错误：

- `404 Session not found`

### POST `/api/chat/sessions`

用途：创建会话。

请求示例：

```json
{
  "id": "session-001",
  "title": "新会话",
  "model_config_id": "gpt-4o-mini",
  "scope": "",
  "preview": "",
  "tags": []
}
```

响应：

```json
{
  "ok": true,
  "id": "session-001"
}
```

### PATCH `/api/chat/sessions/{session_id}`

用途：更新会话元数据。

支持字段：

- `title`
- `model`
- `model_config_id`
- `scope`
- `preview`
- `starred`
- `tags`
- `archived`

### DELETE `/api/chat/sessions/{session_id}`

用途：删除会话和关联消息。

响应：

```json
{
  "ok": true
}
```

### POST `/api/chat/ask`

用途：普通非流式 RAG 问答。

请求示例：

```json
{
  "question": "解释差旅报销流程",
  "session_id": "session-001",
  "knowledge_base_id": "policy",
  "model_config_id": "openai:gpt-4o-mini",
  "top_k": 8
}
```

响应字段：

- `answer`
- `citations`
- `chunks_retrieved`
- `model`
- `model_config_id`

错误：

- `400 question is required`

### POST `/api/chat/ask/stream`

用途：流式 RAG 问答。

请求字段同 `/api/chat/ask`。

事件示例：

```text
data: {"type":"token","content":"这里是增量文本"}

data: {"type":"done","content":"完整回答","model":"GPT-4o mini","model_config_id":"gpt-4o-mini","citations":[]}
```

说明：

- 如果提供 `session_id`，后端会先写入 user message。
- 结束时写入 assistant message，并更新会话 `message_count`、`preview` 和 `updated_at`。

## 3. Knowledge

### GET `/api/knowledge/bases`

用途：获取知识库列表，附带 chunk 数、估算大小和健康度。

响应字段：

- `id`
- `name`
- `description`
- `documents`
- `embedding_model`
- `status`
- `owner`
- `tags`
- `chunks`
- `size`
- `health`

### POST `/api/knowledge/bases`

用途：创建知识库和默认访问策略。

请求示例：

```json
{
  "id": "policy",
  "name": "企业制度与流程",
  "description": "内部制度文档",
  "embedding_model": "openai:text-embedding-3-large",
  "owner": "综合管理部",
  "tags": ["制度", "流程"],
  "access_roles": ["全员"],
  "access_policy": "全员可读"
}
```

### DELETE `/api/knowledge/bases/{base_id}`

用途：删除知识库、权限策略和向量片段。

响应字段：

- `ok`
- `chunks_removed`

### POST `/api/knowledge/bases/{base_id}/upload`

用途：通过后端可访问的本地文件路径上传文档。

请求示例：

```json
{
  "file_path": "E:\\EnterpriseAiWorkspace\\docs\\policy.md"
}
```

响应字段：

- `ok`
- `chunks_added`

错误：

- `400 file_path is required`
- 文件不存在时会抛出文件读取错误。

### GET `/api/knowledge/stats`

用途：获取知识库和向量索引统计。

响应字段：

- `bases`
- `documents`
- `chunks`
- `vector_dim`

### GET `/api/knowledge/access-matrix`

用途：获取知识库访问矩阵。

响应字段：

- `id`
- `name`
- `owner`
- `roles`
- `policy`

## 4. Models

### GET `/api/models/protocols`

用途：获取前端可展示的协议类型。

当前协议：

- `openai-compatible`
- `anthropic`
- `ollama`

### GET `/api/models/providers`

用途：获取模型供应商和模型配置。

说明：

- 响应中不会返回明文 API key。
- 返回 `has_api_key` 和 `api_key_masked`。
- provider 使用 `provider_type`、`protocol_type`、`base_url` 作为主字段。
- 为兼容旧前端，响应仍包含 `type` 和 `endpoint` 别名。

### GET `/api/models/chat-options`

用途：获取聊天页可选择的供应商模型列表。

响应示例：

```json
[
  {
    "provider_id": "openai",
    "provider_name": "OpenAI",
    "provider_type": "cloud",
    "protocol_type": "openai-compatible",
    "models": [
      {
        "model_config_id": "gpt-4o-mini",
        "display_name": "GPT-4o mini",
        "model_name": "gpt-4o-mini"
      }
    ]
  }
]
```

### POST `/api/models/providers`

用途：创建模型供应商，可选自动同步模型。

请求示例：

```json
{
  "id": "openai-compatible",
  "name": "OpenAI Compatible",
  "provider_type": "cloud",
  "protocol_type": "openai-compatible",
  "base_url": "https://api.example.com/v1",
  "api_key": "sk-...",
  "auto_sync_models": true
}
```

响应字段：

- `ok`
- `provider`
- `sync`

错误：

- `400 Provider name is required`
- `400 Provider base_url is required`
- `409 Provider already exists`

### PATCH `/api/models/providers/{provider_id}`

用途：更新供应商。

支持字段：

- `name`
- `provider_type`
- `protocol_type`
- `base_url`
- `api_key`
- `enabled`
- `status`

### DELETE `/api/models/providers/{provider_id}`

用途：删除供应商和关联模型配置。

### POST `/api/models/providers/{provider_id}/test`

用途：测试供应商连接。

行为：

- OpenAI-compatible 请求 `{base_url}/models`。
- Anthropic 请求 `{base_url}/models`。
- Ollama 请求 `{base_url}/api/tags`。
- 成功后 provider 状态更新为 `connected`。
- 失败后根据错误更新为 `offline` 或 `limited`。

### POST `/api/models/providers/{provider_id}/sync-models`

用途：按 provider 的协议类型同步模型。

请求示例：

```json
{
  "protocol_type": "openai-compatible",
  "overwrite": false
}
```

响应字段：

- `ok`
- `provider_id`
- `fetched`
- `inserted`
- `updated`
- `models`

### PATCH `/api/models/configs/{model_id}`

用途：更新模型配置。

支持字段：

- `active`
- `temperature`
- `max_output`
- `context_length`
- `capabilities`
- `model_name`
- `display_name`
- `name`

错误：

- `400 No supported fields to update`
- `404 Model config not found`

## 5. Settings

### GET `/api/settings`

用途：获取应用设置。

响应字段：

- `default_chat_model_config_id`
- `default_embedding_model_config_id`
- `default_rerank_model_config_id`
- `default_chat_model_label`
- `default_embedding_model_label`
- `default_rerank_model_label`
- `default_llm_model`
- `default_embedding_model`
- `default_rerank_model`
- `default_temperature`
- `default_top_k`
- `audit_enabled`
- `masking_enabled`
- `model_fallback_enabled`
- `trace_enabled`
- `auto_save`
- `restore_session`
- `language`
- `notifications_enabled`
- `sound_enabled`
- `data_retention_days`
- `system_prompt`

### POST `/api/settings`

用途：保存任意 settings key/value。后端会以字符串形式写入 SQLite。

请求示例：

```json
{
  "default_chat_model_config_id": "gpt-4o-mini",
  "default_embedding_model_config_id": "openai:text-embedding-3-large",
  "default_rerank_model_config_id": "local:bge-reranker-v2",
  "default_temperature": 0.4,
  "default_top_k": 8,
  "audit_enabled": true
}
```

响应：

```json
{
  "ok": true
}
```

### GET `/api/settings/prompt-templates`

用途：获取提示词模板。

响应字段：

- `id`
- `name`
- `description`

### GET `/api/settings/storage`

用途：获取本地存储使用情况。

响应字段：

- `label`
- `value`
- `width`

## 6. Chat Session Lifecycle

### GET `/api/chat/sessions?include_archived=true&archived=false`

用途：获取会话列表。默认不返回已归档会话，供聊天页左侧列表使用。

查询参数：
- `include_archived`: 可选，`true` 时返回未删除的全部会话。
- `archived`: 可选，显式筛选归档状态；`true` 只返回已归档，`false` 只返回未归档。

说明：
- 归档会话仍保存在 `conversations` 和 `messages` 中。
- 删除会话会物理删除会话和关联消息，历史记录接口不会再返回。

### PATCH `/api/chat/sessions/{session_id}`

新增支持字段：
- `archived`: `true` 时设置 `archived=1` 并写入 `archived_at`；`false` 时取消归档并清空 `archived_at`。

聊天页会话菜单使用该接口完成重命名、标签更新、归档和模型切换。
