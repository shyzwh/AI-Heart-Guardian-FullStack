"""鉴权相关请求/响应模型。"""
from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["doctor", "patient"]


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    role: Role
    display_name: str = Field(default="", max_length=64)
    phone: str = Field(default="", max_length=32)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    user_id: int
    display_name: str


class UserOut(BaseModel):
    id: int
    username: str
    role: Role
    display_name: str
    phone: str
    is_active: bool
    created_at: dt.datetime

    model_config = {"from_attributes": True}
