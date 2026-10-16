"""密码哈希与 JWT 工具。

直接使用 bcrypt（避免 passlib 1.7.x 与 bcrypt 5.x 的版本兼容告警）。
"""
from __future__ import annotations

import datetime as dt

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(plain: str) -> str:
    """生成 bcrypt 密码哈希。"""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """校验明文密码与哈希是否匹配。"""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str | int, role: str, extra: dict | None = None) -> str:
    """生成 JWT access token。sub 存用户 id 字符串。"""
    now = dt.datetime.now(dt.timezone.utc)
    payload: dict = {
        "sub": str(subject),
        "role": role,
        "iat": now,
        "exp": now + dt.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """解码并校验 JWT，失败返回 None。"""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
