"""聚合导入所有 ORM 模型，确保 Base.metadata 完整注册。"""
from app.models.user import User
from app.models.patient import Patient
from app.models.ecg_record import EcgRecord
from app.models.consultation import Consultation, ConsultationMessage
from app.models.notification import Notification
from app.models.wellness import (
    EmergencyContact,
    FollowUp,
    HealthCheckIn,
    PolicyArticle,
    RehabPlan,
)

__all__ = [
    "User",
    "Patient",
    "EcgRecord",
    "Consultation",
    "ConsultationMessage",
    "Notification",
    "FollowUp",
    "EmergencyContact",
    "HealthCheckIn",
    "RehabPlan",
    "PolicyArticle",
]
