"""居家康复推荐服务。

基于最新心电风险等级 + 患者年龄的确定性规则，生成八段锦/太极拳/慢走等方案。
不依赖外部 AI，保证离线可用；高危以静养+就医提示为主。
"""
from __future__ import annotations

from app.models.ecg_record import EcgRecord
from app.models.patient import Patient
from app.models.wellness import RehabPlan


def _age_band(age: int | None) -> str:
    if age is None:
        return "adult"
    if age >= 75:
        return "elder_old"
    if age >= 60:
        return "elder"
    return "adult"


def generate_plan_fields(patient: Patient, record: EcgRecord | None) -> dict:
    """返回可写入 RehabPlan 的字段字典。"""
    risk = record.risk_level if record else "低危"
    band = _age_band(patient.age)

    if risk == "高危":
        return {
            "risk_level": risk,
            "exercise_type": "静养为主，暂不运动",
            "intensity": "极低（仅床边活动/室内慢走2-3分钟）",
            "duration_min": 5,
            "frequency": "每日2-3次，以不引发不适为限",
            "guidance": (
                "当前为高风险，首要任务是尽快到心内科或急诊评估，明确诊断前不要自行锻炼。"
                "可在家人陪同下做极短距离室内走动，活动量以无胸闷、气短、心悸为绝对前提。"
            ),
            "cautions": (
                "出现胸痛、冷汗、呼吸困难、黑朦或晕厥，立即停止活动并拨打120；"
                "禁止独自外出运动、提重物与情绪激动。"
            ),
        }

    if risk == "中危":
        duration = 15 if band in {"elder", "elder_old"} else 20
        return {
            "risk_level": risk,
            "exercise_type": "太极拳 / 慢走（任选其一，循序渐进）",
            "intensity": "低强度，运动中能完整说话、心率不超过（170-年龄）",
            "duration_min": duration,
            "frequency": "每周3-4次，隔天进行，心率平稳后再小幅加量",
            "guidance": (
                "选择低强度太极拳或平地慢走；运动前后各热身与放松5分钟。"
            ),
            "cautions": (
                "避免晨起低温时段、饱餐后立即运动；出现胸闷、明显心悸、头晕立即停止并就医，"
                "按医嘱在24小时内完成心内科复查。"
            ),
        }

    # 低危
    duration = 20 if band == "elder_old" else 30
    return {
        "risk_level": risk,
        "exercise_type": "八段锦 / 太极拳 / 慢走",
        "intensity": "中等偏轻，运动中可正常交谈、微微出汗",
        "duration_min": duration,
        "frequency": "每周4-5次",
        "guidance": (
            "推荐以八段锦、太极拳等传统康养功法或快走为主，配合均匀呼吸；"
            "长期坚持有助于改善心率变异性与心血管健康。"
        ),
        "cautions": (
            "运动前后监测心率；感冒、发热或睡眠不足时暂停；如运动中出现胸痛或气促，及时就医。"
        ),
    }
