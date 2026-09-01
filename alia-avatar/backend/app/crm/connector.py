"""
ALIA Avatar - CRM Database Connector
Connects to the VITAL SA CRM database for data retrieval and report storage.
"""
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
from loguru import logger

try:
    from sqlalchemy import create_engine, text, Column, Integer, String, DateTime, Float, JSON
    from sqlalchemy.orm import declarative_base, sessionmaker
    HAS_SQLALCHEMY = True
except ImportError:
    HAS_SQLALCHEMY = False

from app.models.schemas import VisitReport, VisitSession

Base = declarative_base() if HAS_SQLALCHEMY else None


# ──────────────────────────────────────────────
# ALIA-specific tables (in PostgreSQL)
# ──────────────────────────────────────────────

if HAS_SQLAlchemy:
    class AliaVisitSession(Base):
        """Store ALIA visit sessions in the database."""
        __tablename__ = "alia_sessions"

        id = Column(String, primary_key=True)
        user_id = Column(String, nullable=True)
        mode = Column(String)
        level = Column(String)
        product_focus = Column(String, nullable=True)
        visit_format = Column(String)
        doctor_style = Column(String)
        doctor_specialty = Column(String)
        score = Column(Float)
        started_at = Column(DateTime)
        ended_at = Column(DateTime, nullable=True)
        metadata_json = Column(JSON, nullable=True)


class CRMConnector:
    """Connector for the VITAL SA CRM database."""

    def __init__(self):
        self.engine = None
        self.SessionLocal = None

    def initialize(self, database_url: Optional[str] = None):
        """Initialize database connection."""
        if not HAS_SQLALCHEMY:
            logger.warning("SQLAlchemy not available. CRM connector disabled.")
            return

        try:
            from app.config import get_settings
            settings = get_settings()
            url = database_url or settings.DATABASE_URL

            self.engine = create_engine(url, pool_pre_ping=True)
            self.SessionLocal = sessionmaker(bind=self.engine)

            # Create ALIA tables
            Base.metadata.create_all(self.engine)

            logger.info("CRM database connected successfully")

        except Exception as e:
            logger.error(f"CRM database connection failed: {e}")

    def save_session_report(self, session: VisitSession, report: VisitReport):
        """Save a visit session report to the CRM."""
        if not self.SessionLocal:
            logger.warning("CRM not connected. Report not saved.")
            return

        try:
            db = self.SessionLocal()
            alia_session = AliaVisitSession(
                id=session.id,
                user_id=session.user_id,
                mode=session.mode.value,
                level=session.level.value,
                product_focus=session.product_focus,
                visit_format=session.visit_format.value,
                doctor_style=session.doctor_profile.style.value,
                doctor_specialty=session.doctor_profile.specialty or "",
                score=report.score,
                started_at=session.started_at,
                ended_at=session.ended_at,
                metadata_json={
                    "need_identified": report.need_identified,
                    "message_delivered": report.message_delivered,
                    "objections": report.objections_encountered,
                    "engagement": report.engagement_level,
                    "next_step": report.next_step,
                },
            )
            db.add(alia_session)
            db.commit()
            db.close()
            logger.info(f"Session report saved: {session.id}")

        except Exception as e:
            logger.error(f"Failed to save session report: {e}")

    def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all sessions for a user."""
        if not self.SessionLocal:
            return []

        try:
            db = self.SessionLocal()
            sessions = db.query(AliaVisitSession).filter(
                AliaVisitSession.user_id == user_id
            ).order_by(AliaVisitSession.started_at.desc()).all()

            return [
                {
                    "id": s.id,
                    "mode": s.mode,
                    "level": s.level,
                    "product": s.product_focus,
                    "score": s.score,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                }
                for s in sessions
            ]

        except Exception as e:
            logger.error(f"Failed to fetch user sessions: {e}")
            return []

    def get_session_stats(self) -> Dict[str, Any]:
        """Get aggregated session statistics."""
        if not self.SessionLocal:
            return {}

        try:
            db = self.SessionLocal()
            from sqlalchemy import func

            total = db.query(func.count(AliaVisitSession.id)).scalar() or 0
            avg_score = db.query(func.avg(AliaVisitSession.score)).scalar() or 0

            # Level distribution
            levels = db.query(
                AliaVisitSession.level,
                func.count(AliaVisitSession.id)
            ).group_by(AliaVisitSession.level).all()

            return {
                "total_sessions": total,
                "average_score": round(float(avg_score), 1),
                "level_distribution": {level: count for level, count in levels},
            }

        except Exception as e:
            logger.error(f"Failed to get session stats: {e}")
            return {}


# Global instance
crm_connector = CRMConnector()
