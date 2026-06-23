# 数据规格说明

## 1. 配置来源

后端配置定义在 `ai-backend/core/config.py`。

环境变量前缀：

```text
AI_
```

常用配置：

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `AI_APP_NAME` | `AI-Workspace` | 应用名 |
| `AI_HOST` | `127.0.0.1` | 后端监听地址 |
| `AI_PORT` | `18888` | 后端监听端口 |
| `AI_DATA_DIR` | `data` | 后端数据目录 |
| `AI_VECTOR_STORE_DIR` | `data/vector_store` | 向量索引目录 |
| `AI_KNOWLEDGE_DIR` | `data/knowledge` | 知识库文件目录预留 |
| `AI_AUDIT_ENABLED` | `true` | 审计默认开关 |
| `AI_MASKING_ENABLED` | `true` | 脱敏默认开关 |

模型供应商、API key、Base URL、默认聊天模型、默认 embedding 模型、默认 rerank 模型、temperature 和 top-k 均保存在 SQLite 中，不再作为系统环境变量维护。本地 `.env` 仍可放置运行参数；旧模型相关 `AI_` 变量会被忽略以保证兼容。

## 2. SQLite 数据库

数据库路径：

```text
data/app.db
```

初始化入口：

```text
ai-backend/core/database.py:init_db()
```

初始化时执行：

- `PRAGMA journal_mode=WAL`
- `PRAGMA foreign_keys=ON`
- 创建所有业务表
- 写入默认模型、知识库、会话、消息和界面种子数据

## 3. 表结构

### `conversations`

用途：会话元数据。

主要字段：

- `id`: 主键
- `title`: 会话标题
- `model`: 会话模型
- `model_config_id`: 当前会话绑定的模型配置 ID
- `scope`: 知识范围
- `starred`: 收藏状态
- `archived`: 归档状态，`1` 表示已归档
- `archived_at`: 归档时间，取消归档时为空字符串
- `tags`: JSON 字符串
- `preview`: 预览文本
- `message_count`: 消息数量
- `token_usage`: token 使用量
- `created_at`
- `updated_at`

### `messages`

用途：会话消息。

主要字段：

- `id`: 主键
- `conversation_id`: 外键，删除会话时级联删除
- `role`: `user` 或 `assistant`
- `content`
- `model`
- `model_config_id`
- `tokens`
- `citations`: JSON 字符串
- `created_at`

### `knowledge_bases`

用途：知识库元数据。

主要字段：

- `id`: 主键
- `name`
- `description`
- `documents`
- `embedding_model`
- `status`: `ready`、`syncing`、`warning`
- `owner`
- `tags`: JSON 字符串
- `created_at`
- `updated_at`

### `model_providers`

用途：模型供应商。

主要字段：

- `id`
- `name`
- `provider_type`: `cloud`、`local` 或 `custom`
- `protocol_type`: `openai-compatible`、`anthropic` 或 `ollama`
- `base_url`
- `api_key`
- `status`: `connected`、`limited`、`offline` 等
- `enabled`
- `created_at`
- `updated_at`

注意：API 返回前会脱敏 `api_key`，但数据库中当前为明文保存。旧库迁移后可能仍存在 `type` 和 `endpoint` 兼容列，业务 API 以 `provider_type` 和 `base_url` 为准。

### `model_configs`

用途：模型配置。

主要字段：

- `id`
- `provider_id`
- `model_name`: 实际发送给供应商的模型名
- `display_name`: UI 展示名
- `name`
- `context_length`
- `max_output`
- `temperature`
- `active`
- `capabilities`: JSON 字符串
- `created_at`
- `updated_at`

### `settings`

用途：保存可覆盖的应用设置。

字段：

- `key`
- `value`

后端保存时统一写入字符串，读取时按具体 key 转换成 bool、int、float 或 string。

模型默认值相关 key：

- `default_chat_model_config_id`
- `default_embedding_model_config_id`
- `default_rerank_model_config_id`
- `default_temperature`
- `default_top_k`

### `quick_actions`

用途：智能问答快捷问题。

字段：

- `id`
- `title`
- `prompt`
- `sort_order`
- `enabled`
- `updated_at`

### `prompt_templates`

用途：设置页提示词模板。

字段：

- `id`
- `name`
- `description`
- `sort_order`
- `enabled`
- `updated_at`

### `knowledge_access_policies`

用途：知识库权限展示。

字段：

- `knowledge_base_id`
- `roles`: JSON 字符串
- `policy`
- `updated_at`

当前权限数据用于 UI 展示，不在 RAG 查询中强制执行。

### `runtime_pipeline_steps`

用途：问答上下文面板 pipeline。

字段：

- `id`
- `label`
- `value_template`
- `tone`
- `sort_order`
- `enabled`
- `updated_at`

### `runtime_route_items`

用途：问答上下文面板模型路由。

字段：

- `id`
- `label`
- `kind`
- `value_key`
- `sort_order`
- `enabled`
- `updated_at`

### `audit_logs`

用途：审计日志预留。

字段：

- `id`
- `action`
- `detail`
- `created_at`

当前代码没有完整写入审计日志的业务闭环。

## 4. 种子数据

初始化时如果 `model_providers` 已有记录，会跳过核心种子数据。

默认供应商：

- `openai`
- `anthropic`
- `local`

默认模型：

- `gpt-41`
- `gpt-4o-mini`
- `openai:text-embedding-3-large`
- `claude-sonnet`
- `qwen-local`
- `local:bge-reranker-v2`

默认知识库：

- `policy`: 企业制度与流程
- `legal`: 法务合同库
- `support`: 售后工单库
- `research`: 行业研究资料

默认会话：

- `delivery-risk`
- `contract-review`
- `meeting-summary`

默认快捷问题：

- 制度问答
- 合同审查
- 工单分析

默认提示词模板：

- 技术专家
- 法务审查
- 运营分析
- 会议纪要

## 5. 向量索引

路径：

```text
data/vector_store/
  index.json
  vectors.npy
```

`index.json` 保存 chunk 元数据，`vectors.npy` 保存向量矩阵。

chunk 字段：

- `id`: 内容 MD5 前 12 位
- `content`: 文本切片
- `knowledge_base_id`
- `meta`: source、path 等来源信息

检索流程：

1. 对 query 调用 embedding。
2. 将 query embedding 转为 NumPy 向量。
3. 与现有向量矩阵做 dot product。
4. 按分数倒序返回 top_k。
5. 可按 `knowledge_base_id` 过滤。

## 6. 数据目录注意事项

开发模式默认数据相对 `ai-backend` 工作目录。

打包模式由 Tauri 将后端工作目录切到 app data 目录。因此安装版和 portable 版不会把运行数据写到安装目录旁边。

## 7. 会话归档字段

`conversations` 增加以下生命周期字段：
- `archived`: `INTEGER NOT NULL DEFAULT 0`，`1` 表示已归档。
- `archived_at`: `TEXT NOT NULL DEFAULT ''`，记录归档时间，取消归档时清空。

数据规则：
- 聊天页默认只查询 `archived = 0` 的会话。
- 历史页使用 `include_archived=true` 查询未删除的全部会话，并在前端按归档状态筛选。
- 删除会话执行物理删除，`messages.conversation_id` 通过外键级联删除关联消息。
