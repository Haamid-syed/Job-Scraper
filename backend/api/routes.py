import uuid
import threading
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger

from storage.db import Database
from intelligence.email_drafter import EmailDrafter
from scheduler import run_full_pipeline, run_score_phase, is_refreshing, get_last_run_stats


# ─── Request/Response Models ─────────────────────────────────────────────────


class UpdateStatusRequest(BaseModel):
    status: str
    notes: Optional[str] = None


# ─── Dependency ───────────────────────────────────────────────────────────────


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_config(request: Request):
    return request.app.state.config


# ─── Router Factory ───────────────────────────────────────────────────────────


def create_router() -> APIRouter:
    router = APIRouter()

    # ── GET /jobs ─────────────────────────────────────────────────────────────

    @router.get("/jobs")
    def list_jobs(
        verdict: Optional[str] = None,
        source: Optional[str] = None,
        min_score: Optional[int] = None,
        status: Optional[str] = None,
        show_hidden: bool = False,
        q: Optional[str] = None,
        db: Database = Depends(get_db),
    ):
        jobs = db.get_jobs(
            verdict=verdict,
            source=source,
            min_score=min_score,
            status=status,
            show_hidden=show_hidden,
            q=q,
        )
        stats = db.get_stats()
        last_refresh = db.get_setting("last_global_refresh")
        return {
            "jobs": jobs,
            "total": len(jobs),
            "stats": {**stats, "last_refresh": last_refresh},
        }

    # ── GET /jobs/{job_id} ────────────────────────────────────────────────────

    @router.get("/jobs/{job_id}")
    def get_job(job_id: str, db: Database = Depends(get_db)):
        job = db.get_job_by_id(job_id)
        if not job:
            raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
        return job

    # ── PATCH /jobs/{job_id}/status ───────────────────────────────────────────

    @router.patch("/jobs/{job_id}/status")
    def update_job_status(
        job_id: str,
        body: UpdateStatusRequest,
        db: Database = Depends(get_db),
    ):
        valid_statuses = {"new", "saved", "applied", "skipped"}
        if body.status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{body.status}'. Must be one of: {valid_statuses}",
            )
        success = db.update_job_status(job_id, body.status, body.notes)
        if not success:
            raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
        return {"ok": True, "job_id": job_id, "status": body.status}

    # ── POST /jobs/{job_id}/draft ─────────────────────────────────────────────

    @router.post("/jobs/{job_id}/draft")
    def draft_email(
        job_id: str,
        db: Database = Depends(get_db),
        config=Depends(get_config),
    ):
        job = db.get_job_by_id(job_id)
        if not job:
            raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

        # Return cached draft if available
        if job.get("draft_email"):
            return job["draft_email"]

        try:
            drafter = EmailDrafter(config)
            draft = drafter.draft(job)
            db.update_job_draft(job_id, draft)
            return draft
        except Exception as e:
            logger.exception(f"[api] Draft generation failed for {job_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate draft email")

    # ── POST /refresh ─────────────────────────────────────────────────────────

    @router.post("/refresh")
    def trigger_refresh(
        request: Request,
        db: Database = Depends(get_db),
        config=Depends(get_config),
    ):
        if is_refreshing():
            return {"message": "Refresh already in progress", "run_id": None}

        run_id = str(uuid.uuid4())[:8]
        thread = threading.Thread(
            target=run_full_pipeline,
            args=[config, db, run_id],
            daemon=True,
        )
        thread.start()
        logger.info(f"[api] Manual refresh triggered (run_id={run_id})")
        return {"message": "Refresh started", "run_id": run_id}

    # ── GET /refresh/status ───────────────────────────────────────────────────

    @router.get("/refresh/status")
    def refresh_status(db: Database = Depends(get_db)):
        last_refresh = db.get_setting("last_global_refresh")
        stats = get_last_run_stats()
        return {
            "is_running": is_refreshing(),
            "last_run_at": last_refresh,
            "last_run_stats": stats,
        }

    # ── POST /rescore ─────────────────────────────────────────────────────────

    @router.post("/rescore")
    def trigger_rescore(
        request: Request,
        db: Database = Depends(get_db),
        config=Depends(get_config),
    ):
        """Score any pending unscored jobs. Safe to call anytime."""
        if is_refreshing():
            return {"message": "Pipeline already running — scores will be processed", "scored": 0}

        try:
            stats = run_score_phase(config, db)
            return {"message": f"Scored {stats['scored']} jobs", **stats}
        except Exception as e:
            logger.exception(f"[api] Rescore failed: {e}")
            raise HTTPException(status_code=500, detail=f"Rescore failed: {e}")

    # ── GET /health ───────────────────────────────────────────────────────────

    @router.get("/health")
    def health_check(db: Database = Depends(get_db)):
        sources = db.get_all_scraper_health()
        broken = [s for s in sources if s["is_circuit_broken"]]
        failing = [s for s in sources if (s["consecutive_failures"] or 0) > 0]

        if broken:
            overall = "error"
        elif failing:
            overall = "degraded"
        else:
            overall = "healthy"

        return {"sources": sources, "overall": overall}

    # ── GET /stats ────────────────────────────────────────────────────────────

    @router.get("/stats")
    def stats(db: Database = Depends(get_db)):
        result = db.get_stats()
        last_refresh = db.get_setting("last_global_refresh")
        return {**result, "last_refresh": last_refresh}

    # ── GET /pipeline-runs ────────────────────────────────────────────────────

    @router.get("/pipeline-runs")
    def pipeline_runs(limit: int = 10, db: Database = Depends(get_db)):
        """Get recent pipeline run history."""
        return {"runs": db.get_pipeline_runs(limit=limit)}

    return router
