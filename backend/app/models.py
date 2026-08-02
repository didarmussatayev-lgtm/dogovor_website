from __future__ import annotations

import re

from pydantic import BaseModel, field_validator


class AgreementRequest(BaseModel):
    full_name: str
    phone: str
    iin: str
    allergy: str
    signature_base64: str  # data:image/png;base64,... or raw base64

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("full_name is required")
        return v

    @field_validator("iin")
    @classmethod
    def iin_12_digits(cls, v: str) -> str:
        v = v.strip()
        if not re.fullmatch(r"\d{12}", v):
            raise ValueError("IIN must be exactly 12 digits")
        return v

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v: str) -> str:
        v = v.strip()
        digits = re.sub(r"\D", "", v)
        if not re.fullmatch(r"77\d{9}", digits):
            raise ValueError("Phone must match +7 (7XX) XXX-XX-XX format")
        return v

    @field_validator("allergy")
    @classmethod
    def allergy_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("allergy is required")
        return v

    @field_validator("signature_base64")
    @classmethod
    def signature_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("signature_base64 is required")
        return v
