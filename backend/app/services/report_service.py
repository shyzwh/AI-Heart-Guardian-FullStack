"""报告导出服务。

- TXT：直接返回记录落库的 report_text。
- PDF：用 reportlab + matplotlib 自绘（不依赖 src/report_gen 中缺失顶层 import 的 PDF 函数），
  数据全部来自已落库的 EcgRecord（report_data / features / r_peaks / abnormal_positions / 波形 .npy）。
"""
from __future__ import annotations

import io
import os
from pathlib import Path

from app.models.ecg_record import EcgRecord
from app.models.patient import Patient


def report_filename(record: EcgRecord, ext: str) -> str:
    safe_name = f"{record.record_id}_{record.file_name or 'ecg'}".replace("/", "_").replace("\\", "_")
    return f"心电筛查报告_{safe_name}.{ext}"


def build_txt(record: EcgRecord, patient: Patient) -> bytes:
    header = (
        "心电风险辅助筛查报告\n"
        "=" * 40 + "\n"
        f"患者：{patient.name}　性别：{patient.gender}　年龄：{patient.age or '未填'}\n"
        f"文件：{record.file_name or '-'}\n"
        f"检查时间：{record.created_at:%Y-%m-%d %H:%M:%S}\n"
        + "=" * 40 + "\n\n"
    )
    body = record.report_text or "（暂无报告正文）"
    footer = (
        "\n\n" + "=" * 40 + "\n"
        "免责声明：本报告由 AI 辅助筛查系统生成，仅供参考，不能替代执业医师诊断，"
        "请结合临床症状并由专业医护人员审核。如出现胸痛、气促、晕厥等症状，请立即拨打 120。\n"
    )
    return (header + body + footer).encode("utf-8")


def _register_cn_font():
    """注册中文字体，找不到则回退 Helvetica（中文可能显示不全）。"""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    windir = os.environ.get("WINDIR", r"C:\Windows")
    candidates = [
        Path(windir) / "Fonts" / "Deng.ttf",
        Path(windir) / "Fonts" / "msyh.ttc",
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for font_path in candidates:
        if font_path.exists():
            try:
                pdfmetrics.registerFont(TTFont("ECGCN", str(font_path)))
                return "ECGCN"
            except Exception:
                continue
    return "Helvetica"


def _waveform_png(record: EcgRecord) -> bytes | None:
    """由落库的清洗信号 .npy + R峰/异常位置绘制波形 PNG。"""
    if not record.waveform_path or not os.path.exists(record.waveform_path):
        return None
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib import font_manager
        import numpy as np

        # 让波形图中的中文（标题/图例）正常显示
        for _cand in (
            Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "msyh.ttc",
            Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "Deng.ttf",
            Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
        ):
            if _cand.exists():
                try:
                    font_manager.fontManager.addfont(str(_cand))
                    plt.rcParams["font.sans-serif"] = [font_manager.FontProperties(fname=str(_cand)).get_name()]
                    break
                except Exception:
                    continue
        plt.rcParams["axes.unicode_minus"] = False

        signal = np.load(record.waveform_path).astype(float)
        if signal.size == 0:
            return None
        fs = float(record.fs or 1.0)
        fig, ax = plt.subplots(figsize=(8.2, 2.4))
        ax.plot(np.arange(signal.size) / fs, signal, color="#1677ff", linewidth=0.6)
        r_peaks = np.asarray(record.r_peaks or [], dtype=int)
        abnormal = np.asarray(record.abnormal_positions or [], dtype=int)
        if r_peaks.size:
            r_peaks = r_peaks[(r_peaks >= 0) & (r_peaks < signal.size)]
            ax.scatter(r_peaks / fs, signal[r_peaks], color="#ff4d4f", s=10, label="R峰")
        if abnormal.size:
            abnormal = abnormal[(abnormal >= 0) & (abnormal < signal.size)]
            ax.scatter(
                abnormal / fs, signal[abnormal], color="#fa8c16", marker="x", s=24, label="异常心拍"
            )
        ax.set_title("单导联 ECG 波形")
        ax.set_xlabel("时间（秒）")
        ax.set_ylabel("电压")
        ax.grid(alpha=0.25)
        ax.legend(loc="upper right", fontsize=7)
        fig.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=140)
        plt.close(fig)
        buf.seek(0)
        return buf.getvalue()
    except Exception:
        return None


def build_pdf(record: EcgRecord, patient: Patient) -> bytes:
    """生成中文 PDF 报告。"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Image,
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    font_name = _register_cn_font()
    styles = getSampleStyleSheet()
    title = ParagraphStyle("T", parent=styles["Title"], fontName=font_name, fontSize=18, leading=24)
    heading = ParagraphStyle(
        "H", parent=styles["Heading2"], fontName=font_name, fontSize=13,
        leading=18, textColor=colors.HexColor("#0b2d7a"), spaceBefore=8, spaceAfter=6,
    )
    body = ParagraphStyle("B", parent=styles["BodyText"], fontName=font_name, fontSize=9.5, leading=15)

    probs = record.risk_probs or [0.0, 0.0, 0.0]
    story: list = [
        Paragraph("心电风险辅助筛查报告", title),
        Spacer(1, 4 * mm),
        Paragraph("患者信息", heading),
        Paragraph(
            f"姓名：{patient.name}　性别：{patient.gender}　年龄：{patient.age or '未填'}<br/>"
            f"文件：{record.file_name or '-'}　检查时间：{record.created_at:%Y-%m-%d %H:%M:%S}",
            body,
        ),
        Paragraph("双通路结果", heading),
    ]

    dual = [
        ["通路", "结果", "置信度"],
        ["1D-CNN", f"异常心拍 {record.abnormal_beats} 个", f"{(record.cnn_confidence or 0):.2%}"],
        ["XGBoost", str(record.risk_level), f"{(record.risk_score or 0):.2%}"],
    ]
    t = Table(dual, colWidths=[35 * mm, 80 * mm, 45 * mm])
    t.setStyle(_table_style(font_name))
    story.append(t)

    story.append(Paragraph(
        f"风险分级：<b>{record.risk_level}</b>　总心拍：{record.total_beats}　异常心拍：{record.abnormal_beats}<br/>"
        f"低危概率：{probs[0]:.1%}　中危概率：{probs[1]:.1%}　高危概率：{probs[2]:.1%}",
        body,
    ))

    png = _waveform_png(record)
    if png:
        story.append(Paragraph("波形与异常心拍", heading))
        story.append(Image(io.BytesIO(png), width=170 * mm, height=50 * mm))

    # 12 项特征
    data = record.report_data or {}
    judgements = {row.get("feature"): row for row in data.get("detail_rows", []) if isinstance(row, dict)}
    feature_rows = [["特征", "数值", "判读"]]
    for name, value in (record.features or {}).items():
        j = judgements.get(name, {})
        feature_rows.append([str(name), str(value), str(j.get("display_text", "未检测"))])
    ft = Table(feature_rows, colWidths=[45 * mm, 55 * mm, 60 * mm])
    ft.setStyle(_table_style(font_name, font_size=8))
    story.append(Paragraph("12 项特征", heading))
    story.append(ft)

    story.append(PageBreak())

    # 健康建议
    story.append(Paragraph("综合健康建议", heading))
    for label, key in [
        ("总体建议", "risk_summary"),
        ("可能原因", "etiology_analysis"),
        ("生活建议", "lifestyle_advice"),
        ("与医生沟通", "doctor_communication"),
    ]:
        val = data.get(key) or "请咨询医生。"
        story.append(Paragraph(f"<b>{label}：</b>{val}", body))
        story.append(Spacer(1, 1.5 * mm))

    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("医生审核提示与免责声明", heading))
    story.append(Paragraph(
        "本报告由 AI 辅助筛查系统生成，仅供参考，不能替代执业医师诊断，"
        "请结合既往心电图、临床症状及必要检查，由专业医护人员完成最终判断。"
        "如出现胸痛、冷汗、呼吸困难或意识变化，请立即拨打 120。", body,
    ))

    buf = io.BytesIO()
    SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
    ).build(story)
    buf.seek(0)
    return buf.getvalue()


def _table_style(font_name: str, font_size: int = 9) -> TableStyle:
    from reportlab.lib import colors
    from reportlab.platypus import TableStyle

    return TableStyle(
        [
            ("FONTNAME", (0, 0), (-1, -1), font_name),
            ("FONTSIZE", (0, 0), (-1, -1), font_size),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f0ff")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#b7c9e2")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
    )
