import json
from pathlib import Path

import aiosqlite

from .config import settings

DB_PATH = Path(settings.data_dir) / "app.db"


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
    db = await get_db()
    try:
        await db.executescript(
            """
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;

            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                model TEXT NOT NULL DEFAULT '',
                scope TEXT NOT NULL DEFAULT '',
                starred INTEGER NOT NULL DEFAULT 0,
                tags TEXT NOT NULL DEFAULT '[]',
                preview TEXT NOT NULL DEFAULT '',
                message_count INTEGER NOT NULL DEFAULT 0,
                token_usage INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user','assistant')),
                content TEXT NOT NULL,
                model TEXT,
                tokens INTEGER DEFAULT 0,
                citations TEXT DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS knowledge_bases (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                documents INTEGER NOT NULL DEFAULT 0,
                embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-large',
                status TEXT NOT NULL DEFAULT 'ready',
                owner TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS model_providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'cloud',
                endpoint TEXT NOT NULL DEFAULT '',
                api_key TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'connected',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS model_configs (
                id TEXT PRIMARY KEY,
                provider_id TEXT NOT NULL,
                name TEXT NOT NULL,
                context_length TEXT NOT NULL DEFAULT '128K',
                max_output INTEGER NOT NULL DEFAULT 4096,
                temperature REAL NOT NULL DEFAULT 0.4,
                active INTEGER NOT NULL DEFAULT 1,
                capabilities TEXT NOT NULL DEFAULT '[]',
                FOREIGN KEY (provider_id) REFERENCES model_providers(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS quick_actions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                prompt TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                enabled INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS prompt_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                enabled INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS knowledge_access_policies (
                knowledge_base_id TEXT PRIMARY KEY,
                roles TEXT NOT NULL DEFAULT '[]',
                policy TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS runtime_pipeline_steps (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                value_template TEXT NOT NULL DEFAULT '',
                tone TEXT NOT NULL DEFAULT 'cyan',
                sort_order INTEGER NOT NULL DEFAULT 0,
                enabled INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS runtime_route_items (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                kind TEXT NOT NULL DEFAULT 'cpu',
                value_key TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                enabled INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            """
        )
        await db.commit()
        await _seed_data(db)
        await _seed_interface_data(db)
    finally:
        await db.close()


async def _seed_data(db: aiosqlite.Connection):
    row = await db.execute_fetchall("SELECT COUNT(*) as c FROM model_providers")
    if row and row[0]["c"] > 0:
        return

    await db.executemany(
        """
        INSERT OR IGNORE INTO model_providers
            (id, name, type, endpoint, api_key, status)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            ("openai", "OpenAI", "cloud", settings.openai_base_url, settings.openai_api_key, "connected"),
            ("anthropic", "Anthropic", "cloud", "https://api.anthropic.com/v1", settings.anthropic_api_key, "connected"),
            ("local", "本地推理集群", "local", settings.ollama_base_url, "", "limited"),
        ],
    )

    await db.executemany(
        """
        INSERT OR IGNORE INTO model_configs
            (id, provider_id, name, context_length, max_output, temperature, active, capabilities)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            ("gpt-41", "openai", "GPT-4.1 Enterprise", "128K", 8192, 0.4, 1, json.dumps(["问答", "代码", "工具调用", "长上下文"], ensure_ascii=False)),
            ("gpt-4o-mini", "openai", "GPT-4o mini", "128K", 4096, 0.3, 1, json.dumps(["问答", "摘要", "低延迟"], ensure_ascii=False)),
            ("claude-sonnet", "anthropic", "Claude 3.5 Sonnet", "200K", 8192, 0.5, 1, json.dumps(["文档分析", "代码", "长文本"], ensure_ascii=False)),
            ("qwen-local", "local", "Qwen2.5 72B", "32K", 4096, 0.6, 0, json.dumps(["离线", "中文", "代码"], ensure_ascii=False)),
        ],
    )

    await db.executemany(
        """
        INSERT OR IGNORE INTO knowledge_bases
            (id, name, description, documents, embedding_model, status, owner, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            ("policy", "企业制度与流程", "覆盖人事、财务、采购、行政与交付流程的内部制度文档。", 1482, "text-embedding-3-large", "syncing", "综合管理部", json.dumps(["制度", "流程", "全员"], ensure_ascii=False)),
            ("legal", "法务合同库", "采购、销售、数据处理协议与供应商模板的结构化合同知识。", 864, "bge-large-zh-v1.5", "ready", "法务部", json.dumps(["合同", "合规", "权限"], ensure_ascii=False)),
            ("support", "售后工单库", "客户反馈、工单处理、交付延期、区域服务质量相关数据。", 24190, "text-embedding-3-large", "ready", "客户成功部", json.dumps(["工单", "客户", "交付"], ensure_ascii=False)),
            ("research", "行业研究资料", "市场研究、竞品分析、行业政策与技术趋势报告。", 326, "bge-m3", "warning", "战略部", json.dumps(["研究", "市场", "战略"], ensure_ascii=False)),
        ],
    )

    await db.executemany(
        """
        INSERT OR IGNORE INTO conversations
            (id, title, model, scope, starred, message_count, token_usage, tags, preview)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            ("delivery-risk", "交付延期风险归因", "GPT-4.1", "售后工单库", 1, 3, 624, json.dumps(["运营", "工单"], ensure_ascii=False), "归纳上周客户反馈中的交付延期原因，并引用对应工单与处理建议。"),
            ("contract-review", "合同风险条款识别", "Claude 3.5 Sonnet", "法务合同库", 0, 1, 0, json.dumps(["法务", "合同"], ensure_ascii=False), "检查采购合同中的交付、违约和数据安全条款。"),
            ("meeting-summary", "季度经营会纪要", "GPT-4.1", "会议纪要库", 1, 0, 0, json.dumps(["经营", "纪要"], ensure_ascii=False), "从会议录音和资料中整理季度经营会要点与行动项。"),
        ],
    )

    await db.executemany(
        """
        INSERT OR IGNORE INTO messages
            (id, conversation_id, role, content, model, tokens, citations)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            ("m1", "delivery-risk", "user", "把上周客户反馈中关于交付延期的主要原因做一个归纳，并引用对应工单。", "", 0, "[]"),
            ("m2", "delivery-risk", "assistant", "已基于售后工单知识库完成聚类。主要原因集中在供应链排期变更、客户侧验收窗口延后、跨区域物流节点拥堵三类。", "GPT-4.1", 428, json.dumps(["CS-2026-1182", "CS-2026-1207", "CS-2026-1221"], ensure_ascii=False)),
            ("m3", "delivery-risk", "assistant", "建议将高频延误场景同步到交付风险看板，并为华东区新增提前 48 小时预警规则。", "GPT-4.1", 196, json.dumps(["SOP-DELIVERY-08", "RISK-OPS-14"], ensure_ascii=False)),
            ("m4", "contract-review", "user", "检查这份采购合同中的交付、违约和数据安全条款。", "", 0, "[]"),
        ],
    )
    await db.commit()


async def _seed_interface_data(db: aiosqlite.Connection):
    await db.executemany(
        """
        INSERT OR IGNORE INTO quick_actions
            (id, title, prompt, sort_order, enabled)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            ("policy-qa", "制度问答", "请解释差旅报销流程中需要主管审批的场景。", 10, 1),
            ("contract-review", "合同审查", "识别合同中可能导致延期赔付争议的条款。", 20, 1),
            ("ticket-analysis", "工单分析", "汇总最近 7 天交付延期工单的主要原因。", 30, 1),
        ],
    )
    await db.executemany(
        """
        INSERT OR IGNORE INTO prompt_templates
            (id, name, description, sort_order, enabled)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            ("technical", "技术专家", "用于系统架构、代码审查和技术方案分析。", 10, 1),
            ("legal", "法务审查", "用于合同条款、合规风险和数据安全审查。", 20, 1),
            ("operations", "运营分析", "用于工单归因、流程优化和指标分析。", 30, 1),
            ("meeting", "会议纪要", "用于纪要整理、行动项提取和摘要生成。", 40, 1),
        ],
    )
    await db.executemany(
        """
        INSERT OR IGNORE INTO knowledge_access_policies
            (knowledge_base_id, roles, policy)
        VALUES (?, ?, ?)
        """,
        [
            ("policy", json.dumps(["全员"], ensure_ascii=False), "全员可读"),
            ("legal", json.dumps(["法务", "管理层"], ensure_ascii=False), "细粒度权限"),
            ("support", json.dumps(["售后", "运营", "交付"], ensure_ascii=False), "脱敏后可读"),
            ("research", json.dumps(["战略", "管理层"], ensure_ascii=False), "部门授权"),
        ],
    )
    await db.executemany(
        """
        INSERT OR IGNORE INTO runtime_pipeline_steps
            (id, label, value_template, tone, sort_order, enabled)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            ("intent", "意图识别", "已完成", "green", 10, 1),
            ("retrieval", "知识检索", "{top_k} 条", "cyan", 20, 1),
            ("permission", "权限过滤", "已通过", "amber", 30, 1),
            ("generation", "响应生成", "流式", "rose", 40, 1),
        ],
    )
    await db.executemany(
        """
        INSERT OR IGNORE INTO runtime_route_items
            (id, label, kind, value_key, sort_order, enabled)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            ("primary", "主模型", "cpu", "default_llm_model", 10, 1),
            ("embedding", "向量模型", "database", "default_embedding_model", 20, 1),
            ("rerank", "重排模型", "workflow", "default_rerank_model", 30, 1),
        ],
    )
    await db.commit()
