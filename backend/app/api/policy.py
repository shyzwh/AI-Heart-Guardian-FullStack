"""政策资讯接口（康养 / 智慧养老 / 心脑血管防治）。

- 读取：GET 列表 / 分类 / 详情，公开可读（登录可选）。
- 管理：POST 新增 / PUT 编辑 / DELETE 删除，需登录且为医生（管理员）。
"""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_user_optional
from app.db.database import get_db
from app.models.user import User
from app.models.wellness import PolicyArticle
from app.schemas.wellness import PolicyCreate, PolicyOut, PolicyUpdate
from app.services.policy_seed import SEED_POLICIES

router = APIRouter(prefix="/policy", tags=["policy"])

# 旧版短标题 → 新版种子标题（用于把历史开发库中的旧条目原地升级，避免重复）
_LEGACY_TITLE_MAP = {
    "关于培育养老服务经营主体 促进银发经济发展的若干措施":
        "关于培育养老服务经营主体 促进银发经济发展的若干措施",
    "智慧健康养老产业发展行动计划":
        "智慧健康养老产业发展行动计划（2021—2025年）",
}


def _apply_item(article: PolicyArticle, item: dict) -> None:
    article.title = item["title"]
    article.category = item["category"]
    article.source = item["source"]
    article.source_url = item.get("source_url", "")
    article.summary = item["summary"]
    article.content = item["content"]
    raw = item.get("published_at")
    if isinstance(raw, str) and raw:
        article.published_at = dt.date.fromisoformat(raw)
    else:
        article.published_at = raw
    article.is_published = True


def seed_policies(db: Session) -> None:
    """幂等写入 / 升级种子政策（按标题去重，并迁移旧版短标题条目）。"""
    existing_rows = db.scalars(select(PolicyArticle)).all()
    by_title = {p.title: p for p in existing_rows}
    changed = False

    for item in SEED_POLICIES:
        target = by_title.get(item["title"])
        if target is None:
            # 旧标题条目原地升级
            for legacy, new_title in _LEGACY_TITLE_MAP.items():
                if new_title == item["title"] and legacy in by_title:
                    target = by_title[legacy]
                    break
        if target is None:
            article = PolicyArticle()
            _apply_item(article, item)
            db.add(article)
            changed = True
        else:
            # 已存在则刷新来源链接 / 日期 / 正文，保证种子信息最新
            _apply_item(target, item)
            changed = True

    if changed:
        db.commit()


def _require_manager(current: User) -> None:
    if current.role not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="仅医生或管理员可管理政策资讯")


@router.get("", response_model=list[PolicyOut])
def list_policy(
    category: str | None = None,
    keyword: str | None = None,
    db: Session = Depends(get_db),
    current=Depends(get_current_user_optional),
) -> list[PolicyArticle]:
    """政策列表（公开可读）。首次访问自动播种内置政策。"""
    seed_policies(db)
    stmt = select(PolicyArticle).where(PolicyArticle.is_published.is_(True))
    if category:
        stmt = stmt.where(PolicyArticle.category == category)
    if keyword:
        stmt = stmt.where(PolicyArticle.title.contains(keyword))
    return list(
        db.scalars(
            stmt.order_by(PolicyArticle.published_at.desc().nullslast(), PolicyArticle.id.desc())
        ).all()
    )


@router.get("/categories")
def policy_categories(
    db: Session = Depends(get_db),
    current=Depends(get_current_user_optional),
) -> dict:
    seed_policies(db)
    rows = db.scalars(
        select(PolicyArticle.category).where(PolicyArticle.is_published.is_(True)).distinct()
    ).all()
    return {"categories": [c for c in rows if c]}


@router.get("/{policy_id}", response_model=PolicyOut)
def get_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_user_optional),
) -> PolicyArticle:
    article = db.get(PolicyArticle, policy_id)
    if article is None or not article.is_published:
        raise HTTPException(status_code=404, detail="政策不存在")
    return article


@router.post("", response_model=PolicyOut, status_code=201)
def create_policy(
    payload: PolicyCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> PolicyArticle:
    """新增政策（医生 / 管理员）。"""
    _require_manager(current)
    article = PolicyArticle(
        title=payload.title,
        category=payload.category,
        source=payload.source,
        source_url=payload.source_url,
        published_at=payload.published_at,
        summary=payload.summary,
        content=payload.content,
        cover_image=payload.cover_image,
        is_published=payload.is_published,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.put("/{policy_id}", response_model=PolicyOut)
def update_policy(
    policy_id: int,
    payload: PolicyUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> PolicyArticle:
    """编辑政策（医生 / 管理员）。"""
    _require_manager(current)
    article = db.get(PolicyArticle, policy_id)
    if article is None:
        raise HTTPException(status_code=404, detail="政策不存在")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(article, key, value)
    db.commit()
    db.refresh(article)
    return article


@router.delete("/{policy_id}", status_code=204)
def delete_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> None:
    """删除政策（医生 / 管理员）。"""
    _require_manager(current)
    article = db.get(PolicyArticle, policy_id)
    if article is None:
        raise HTTPException(status_code=404, detail="政策不存在")
    db.delete(article)
    db.commit()
