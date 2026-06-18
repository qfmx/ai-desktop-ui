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
    (Path(settings.data_dir)).mkdir(parents=True, exist_ok=True)
    db = await get_db()
    try:
        await db.executescript("""
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

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
        """)
        await db.commit()
        await _seed_data(db)
    finally:
        await db.close()


async def _seed_data(db: aiosqlite.Connection):
    row = await db.execute_fetchall("SELECT COUNT(*) as c FROM model_providers")
    if row and row[0][0] > 0:
        return

    seed_sql = """
    INSERT OR IGNORE INTO model_providers (id, name, type, endpoint, api_key, status) VALUES
        ('openai', 'OpenAI', 'cloud', 'https://api.openai.com/v1', '', 'connected'),
        ('anthropic', 'Anthropic', 'cloud', 'https://api.anthropic.com/v1', '', 'connected'),
        ('local', '本地推理集群', 'local', 'http://localhost:11434', '', 'limited');

    INSERT OR IGNORE INTO model_configs (id, provider_id, name, context_length, max_output, temperature, active, capabilities) VALUES
        ('gpt-41', 'openai', 'GPT-4.1 Enterprise', '128K', 8192, 0.4, 1, '["问答","代码","工具调用","长上下文"]'),
        ('gpt-4o-mini', 'openai', 'GPT-4o mini', '128K', 4096, 0.3, 1, '["问答","摘要","低延迟"]'),
        ('claude-sonnet', 'anthropic', 'Claude 3.5 Sonnet', '200K', 8192, 0.5, 1, '["文档分析","代码","长文本"]'),
        ('qwen-local', 'local', 'Qwen2.5 72B', '32K', 4096, 0.6, 0, '["离线","中文","代码"]');

    INSERT OR IGNORE INTO knowledge_bases (id, name, description, documents, embedding_model, status, owner, tags) VALUES
        ('policy', '企业制度与流程', '覆盖人事、财务、采购、行政与交付流程的内部制度文档。', 1482, 'text-embedding-3-large', 'syncing', '综合管理部', '["制度","流程","全员"]'),
        ('legal', '法务合同库', '采购、销售、数据处理协议与供应商模板的结构化合同知识。', 864, 'bge-large-zh-v1.5', 'ready', '法务部', '["合同","合规","权限"]'),
        ('support', '售后工单库', '客户反馈、工单处理、交付延期、区域服务质量相关数据。', 24190, 'text-embedding-3-large', 'ready', '客户成功部', '["工单","客户","交付"]'),
        ('research', '行业研究资料', '市场研究、竞品分析、行业政策与技术趋势报告。', 326, 'bge-m3', 'warning', '战略部', '["研究","市场","战略"]');

    INSERT OR IGNORE INTO conversations (id, title, model, scope, starred, message_count, token_usage, tags, preview) VALUES
        ('delivery-risk', '交付延期风险归因', 'GPT-4.1', '售后工单库', 1, 3, 624, '["运营","工单"]', '归纳上周客户反馈中的交付延期原因，并引用对应工单与处理建议。'),
        ('contract-review', '合同风险条款识别', 'Claude 3.5 Sonnet', '法务合同库', 0, 1, 0, '["法务","合同"]', '检查采购合同中的交付、违约和数据安全条款。'),
        ('meeting-summary', '季度经营会纪要', 'GPT-4.1', '会议纪要库', 1, 0, 0, '["经营","纪要"]', '从会议录音和资料中整理季度经营会要点与行动项。');

    INSERT OR IGNORE INTO messages (id, conversation_id, role, content, model, tokens, citations) VALUES
        ('m1', 'delivery-risk', 'user', '把上周客户反馈中关于交付延期的主要原因做一个归纳，并引用对应工单。', '', 0, '[]'),
        ('m2', 'delivery-risk', 'assistant', '已基于售后工单知识库完成聚类。主要原因集中在供应链排期变更、客户侧验收窗口延后、跨区域物流节点拥堵三类。', 'GPT-4.1', 428, '["CS-2026-1182","CS-2026-1207","CS-2026-1221"]'),
        ('m3', 'delivery-risk', 'assistant', '建议将高频延误场景同步到交付风险看板，并为华东区新增提前 48 小时预警规则。', 'GPT-4.1', 196, '["SOP-DELIVERY-08","RISK-OPS-14"]'),
        ('m4', 'contract-review', 'user', '检查这份采购合同中的交付、违约和数据安全条款。', '', 0, '[]');
    """
    await db.executescript(seed_sql)
    await db.commit()
