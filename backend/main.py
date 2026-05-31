import threading
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

_BACKEND_DIR = Path(__file__).resolve().parent
_PROJECT_DIR = _BACKEND_DIR.parent

from config import load_config
from logger import setup_logger
from storage.db import Database
from api.routes import create_router
from scheduler import setup_scheduler, run_full_pipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    config_path = str(_PROJECT_DIR / "config.yaml")
    config = load_config(config_path)
    log_path = str(_PROJECT_DIR / config.logging.file)
    app_logger = setup_logger(config.logging.level, log_path)
    app_logger.info("JobRadar starting up...")

    # Init database
    db = Database(config)
    db.init()

    # Start scheduler
    scheduler = setup_scheduler(config, db)

    # Run pipeline immediately on startup if last run was > 1hr ago or never ran
    last_run = db.get_setting("last_global_refresh")
    should_run_now = True
    if last_run:
        try:
            elapsed = (datetime.now() - datetime.fromisoformat(last_run)).total_seconds()
            should_run_now = elapsed > 3600
        except Exception:
            should_run_now = True

    if should_run_now:
        app_logger.info("[main] Running initial pipeline on startup...")
        threading.Thread(
            target=run_full_pipeline,
            args=[config, db],
            daemon=True,
        ).start()

    app.state.config = config
    app.state.db = db
    app.state.scheduler = scheduler

    yield

    scheduler.shutdown(wait=False)
    app_logger.info("JobRadar shutdown complete")


app = FastAPI(
    title="JobRadar API",
    description="AI-powered job hunting tool for Haamid",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(create_router(), prefix="/api")


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Check logs for details."},
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
