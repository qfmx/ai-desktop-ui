import os
import sys
import traceback
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.database import init_db
from routers import chat, knowledge, models, settings as settings_router, health

app = FastAPI(title=settings.app_name, version="1.0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(chat.router)
app.include_router(knowledge.router)
app.include_router(models.router)
app.include_router(settings_router.router)


@app.on_event("startup")
async def startup():
    await init_db()


def ensure_standard_streams():
    if sys.stdin is None:
        sys.stdin = open(os.devnull, "r", encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")


def main():
    ensure_standard_streams()
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        try:
            Path("ai-backend-error.log").write_text(traceback.format_exc(), encoding="utf-8")
        except Exception:
            pass
        raise
