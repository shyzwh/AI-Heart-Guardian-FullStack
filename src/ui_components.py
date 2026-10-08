"""Reusable UI helpers for the medical ECG dashboard."""

import streamlit as st


def _icon_html(icon):
    """过滤 Material 图标占位符，保留普通文本图标。"""
    if str(icon).startswith(":material/") and str(icon).endswith(":"):
        return ""
    return str(icon or "")


# 注入全局样式，包含毛玻璃卡片、医疗蓝主题、悬停效果
# 统一主题和视觉组件，保证多个页面风格一致

def inject_global_css(theme="医疗蓝"):
    THEMES = {
        "医疗蓝": {
            "primary": "#1A5CFF",
            "bg": "#F5F7FA",
            "card": "#FFFFFF",
            "text": "#18324F",
            "border": "#DCE4EF",
            "heading": "#0B2D7A",
            "muted": "#667085",
            "shadow": "rgba(23, 77, 155, 0.10)",
            "color_scheme": "light",
        },
        "纯白极简": {
            "primary": "#333333",
            "bg": "#FFFFFF",
            "card": "#FFFFFF",
            "text": "#333333",
            "border": "#E5E5E5",
            "heading": "#333333",
            "muted": "#707070",
            "shadow": "rgba(0, 0, 0, 0.06)",
            "color_scheme": "light",
        },
        "深色护眼": {
            "primary": "#4A9EFF",
            "bg": "#1E232B",
            "card": "#292F38",
            "text": "#E6EDF5",
            "border": "#414B58",
            "heading": "#B8D8FF",
            "muted": "#A5B1C0",
            "shadow": "rgba(0, 0, 0, 0.24)",
            "color_scheme": "dark",
        },
        "磨砂灰": {
            "primary": "#5C6B7A",
            "bg": "#EEF1F4",
            "card": "#F8FAFC",
            "text": "#26323D",
            "border": "#D5DDE4",
            "heading": "#3C4B59",
            "muted": "#66727D",
            "shadow": "rgba(44, 62, 80, 0.08)",
            "color_scheme": "light",
        },
    }
    t = THEMES.get(theme, THEMES["医疗蓝"])
    st.markdown(
        f"""
        <style>
        :root {{
            --primary-color: {t['primary']};
            --bg-color: {t['bg']};
            --card-bg: {t['card']};
            --text-color: {t['text']};
            --border-color: {t['border']};
            --heading-color: {t['heading']};
            --muted-color: {t['muted']};
            --shadow-color: {t['shadow']};
            --background-color: var(--bg-color);
            --secondary-background-color: var(--card-bg);
            color-scheme: {t['color_scheme']};
            --medical-blue: var(--primary-color);
            --medical-deep: var(--heading-color);
            --medical-soft: color-mix(in srgb, var(--primary-color) 9%, var(--card-bg));
            --glass-bg: color-mix(in srgb, var(--card-bg) 88%, transparent);
            --glass-border: color-mix(in srgb, var(--border-color) 75%, transparent);
            --text: var(--text-color);
            --muted: var(--muted-color);
            --success: #2ecc71;
            --warning: #f39c12;
            --danger: #e74c3c;
            --shadow: 0 12px 28px var(--shadow-color);
        }}
        html, body, [data-testid="stAppViewContainer"] {{
            background: var(--bg-color);
            color: var(--text-color);
            font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
        }}
        [data-testid="stAppViewContainer"] > .main {{ background: transparent; }}
        [data-testid="stAppViewContainer"] main {{ color: var(--text-color); }}
        .glass-panel {{
            background: var(--glass-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            box-shadow: var(--shadow);
            padding: 1rem 1.1rem;
            margin-bottom: 1rem;
            min-height: 0;
            transition: transform 0.25s ease, box-shadow 0.25s ease;
        }}
        .glass-panel:hover {{
            transform: translateY(-2px);
            box-shadow: 0 18px 35px var(--shadow-color);
        }}
        .section-title {{
            color: var(--heading-color);
            font-size: 1.08rem;
            font-weight: 800;
            padding-left: 0.7rem;
            border-left: 4px solid var(--medical-blue);
            margin-bottom: 0.8rem;
        }}
        .risk-badge {{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.38rem 0.8rem;
            border-radius: 999px;
            color: white;
            font-weight: 700;
            font-size: 0.8rem;
            min-width: 92px;
        }}
        .metric-card {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 0.9rem 0.8rem;
            min-height: 110px;
            box-shadow: 0 10px 20px var(--shadow-color);
            transition: transform 0.2s ease;
        }}
        .metric-card:hover {{ transform: translateY(-3px); }}
        .metric-label {{
            font-size: 0.72rem;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            font-weight: 700;
        }}
        .metric-value {{
            margin-top: 0.45rem;
            font-size: 1.7rem;
            font-weight: 900;
            color: var(--heading-color);
            font-family: "Consolas", "Courier New", monospace;
        }}
        .metric-subtext {{
            margin-top: 0.2rem;
            font-size: 0.74rem;
            color: var(--muted);
        }}
        .ecg-section-title {{
            display: flex;
            align-items: center;
            gap: 0.45rem;
            color: var(--heading-color);
            font-size: 20px;
            font-weight: 800;
            padding: 0.2rem 0 0.2rem 0.7rem;
            border-left: 4px solid var(--medical-blue);
            margin: 1rem 0 0.8rem;
        }}
        .material-symbols-rounded {{
            font-family: "Material Symbols Rounded";
            font-size: 1.1em;
            vertical-align: -0.12em;
            margin-right: 0.25rem;
        }}
        .ecg-info-card,
        .ecg-stat-card,
        .ecg-feature-card,
        .ecg-warning-card {{
            border-radius: 16px;
            padding: 1rem 1.1rem;
            margin: 0.35rem 0 0.9rem;
            min-height: 0;
        }}
        .ecg-info-card {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            box-shadow: 0 10px 24px var(--shadow-color);
        }}
        .ecg-info-card.ecg-green-card {{
            background: color-mix(in srgb, #2e7d32 10%, var(--card-bg));
            border-color: color-mix(in srgb, #2e7d32 30%, var(--border-color));
            color: var(--text-color);
        }}
        .ecg-info-card.ecg-blue-card {{
            background: var(--medical-soft);
            border-color: color-mix(in srgb, var(--primary-color) 28%, var(--border-color));
        }}
        .ecg-info-accent {{
            height: 4px;
            border-radius: 999px;
            margin-bottom: 0.6rem;
            background: var(--primary-color);
        }}
        .ecg-info-accent.ecg-green-card {{
            background: #2e7d32;
        }}
        .ecg-info-accent.ecg-blue-card {{
            background: var(--primary-color);
        }}
        .ecg-card-title {{
            color: var(--heading-color);
            font-size: 1rem;
            font-weight: 800;
            margin-bottom: 0.45rem;
        }}
        .ecg-card-content {{
            color: var(--text-color);
            line-height: 1.7;
            white-space: pre-wrap;
        }}
        .ecg-stat-card {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            box-shadow: 0 10px 24px var(--shadow-color);
            text-align: center;
        }}
        .ecg-stat-value {{
            color: var(--heading-color);
            font-size: 1.7rem;
            font-weight: 900;
            line-height: 1.2;
        }}
        .ecg-stat-label {{
            color: var(--muted);
            font-size: 0.78rem;
            font-weight: 700;
            margin-top: 0.35rem;
        }}
        .ecg-stat-unit {{
            color: var(--muted);
            font-size: 0.75rem;
            margin-left: 0.2rem;
        }}
        .ecg-feature-card {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            box-shadow: 0 8px 20px var(--shadow-color);
            min-height: 105px;
        }}
        .ecg-feature-icon {{ font-size: 1.2rem; margin-right: 0.35rem; }}
        .ecg-feature-title {{ color: var(--heading-color); font-weight: 800; }}
        .ecg-feature-desc {{ color: var(--muted); line-height: 1.6; margin-top: 0.45rem; }}
        .ecg-warning-card {{
            background: color-mix(in srgb, #f2c66d 18%, var(--card-bg));
            border: 1px solid color-mix(in srgb, #f2c66d 65%, var(--border-color));
            box-shadow: 0 8px 18px rgba(173, 119, 20, 0.08);
            color: var(--text-color);
            line-height: 1.7;
        }}
        .ecg-page-header {{
            padding: 0.9rem 1.2rem;
            border-radius: 16px;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow);
            margin-bottom: 1rem;
        }}
        .ecg-page-header-title {{
            color: var(--heading-color);
            font-size: 1.35rem;
            font-weight: 800;
        }}
        .ecg-page-header-meta {{
            color: var(--muted-color);
            font-size: 0.8rem;
        }}
        .ecg-clinical-feature-card {{
            padding: 0.8rem 0.9rem;
            border-radius: 14px;
            border: 1px solid var(--border-color);
            background: var(--card-bg);
            color: var(--text-color);
            min-height: 86px;
        }}
        .ecg-clinical-feature-card.is-abnormal {{
            background: color-mix(in srgb, #b42318 8%, var(--card-bg));
            border-color: color-mix(in srgb, #b42318 24%, var(--border-color));
            color: var(--text-color);
        }}
        .ecg-report-card {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            padding: 1rem 1.2rem;
            border-radius: 16px;
            margin: 0.7rem 0 1rem;
            box-shadow: 0 8px 20px var(--shadow-color);
        }}
        .ecg-report-card-title {{
            color: var(--heading-color);
            font-size: 1.05rem;
            font-weight: 800;
            margin-bottom: 0.5rem;
        }}
        .ecg-report-card-content {{
            white-space: pre-wrap;
            line-height: 1.8;
        }}
        .ecg-history-tag {{
            display: inline-block;
            padding: 4px 8px;
            border-radius: 999px;
            background: var(--medical-soft);
            color: var(--heading-color);
            font-size: 12px;
            margin: 0 4px 4px 0;
        }}
        [data-testid="stMarkdownContainer"] {{
            color: var(--text-color);
            font-size: 14px;
            line-height: 1.7;
        }}
        .ecg-card-note {{
            color: var(--muted-color);
            font-size: 12px;
        }}
        </style>
        """,
        unsafe_allow_html=True,
    )


# 渲染患者信息卡片
# 用于在分析页展示已录入的患者基本信息

def render_patient_card(patient_name="未命名患者", age="未录入", sex="未指定"):
    """渲染患者基础信息卡片。"""
    with st.container(border=True):
        render_section_title("患者信息", "👤")
        st.markdown(f"- **姓名：** {patient_name}\n- **年龄：** {age} 岁\n- **性别：** {sex}")


# 渲染上传卡片
# 展示文件选择框与示例数据入口，方便前台快速试用

def render_upload_card():
    """渲染 ECG 文件上传区和示例数据按钮。"""
    with st.container(border=True):
        render_section_title("采集数据", "⤴️")
    uploaded = st.file_uploader("选择 ECG 文件", type=["csv", "txt", "dat"], label_visibility="collapsed")
    demo = st.button("加载示例数据", use_container_width=True)
    return uploaded, demo


# 渲染风险等级徽章
# 通过统一颜色和文字给出当前风险状态

def render_risk_badge(level="低危", value=None):
    """按风险等级渲染颜色徽章。"""
    level_map = {
        "低危": ("#52c41a", "低危"),
        "中危": ("#faad14", "中危"),
        "高危": ("#ff4d4f", "高危"),
        "未知": ("#6c757d", "未知"),
    }
    color, text = level_map.get(level, level_map["未知"])
    if value is not None:
        text = f"{text} · {value:.2f}"
    st.markdown(f'<span class="risk-badge" style="background:linear-gradient(135deg,{color},var(--primary-color));">{text}</span>', unsafe_allow_html=True)


# 渲染指标卡片
def render_metric_card(label="指标", value="--", unit=""):
    st.markdown(
        f'<div class="metric-card"><div class="metric-label">{label}</div><div class="metric-value">{value}</div><div class="metric-subtext">{unit}</div></div>',
        unsafe_allow_html=True,
    )


# 渲染分节标题
def render_section_title(title="分节标题", icon=""):
    st.markdown(f'<div class="ecg-section-title">{_icon_html(icon)}{title}</div>', unsafe_allow_html=True)


def render_info_card(title, content, icon="", variant=""):
    with st.container(border=True):
        if variant in {"ecg-green-card", "ecg-blue-card"}:
            st.markdown(f'<div class="ecg-info-accent {variant}"></div>', unsafe_allow_html=True)
        render_section_title(title, icon)
        if content:
            st.markdown(str(content))


def render_stat_card(label, value, unit="", icon=""):
    st.markdown(
        f'<div class="ecg-stat-card"><div class="ecg-stat-value">{_icon_html(icon)}{value}<span class="ecg-stat-unit">{unit}</span></div><div class="ecg-stat-label">{label}</div></div>',
        unsafe_allow_html=True,
    )


def render_feature_card(title, desc, icon=""):
    with st.container(border=True):
        render_section_title(title, icon)
        st.markdown(str(desc))


def render_warning_card(text):
    with st.container(border=True):
        st.markdown(f"> **提示：** {text}")
