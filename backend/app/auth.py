import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User


SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


def validate_password_strength(password: str) -> str:
    if len(password) < 7:
        raise ValueError("Şifre en az 7 karakter uzunluğunda olmalıdır")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Şifre en az bir büyük harf içermelidir")
    if not re.search(r"[a-z]", password):
        raise ValueError("Şifre en az bir küçük harf içermelidir")
    if not re.search(r"\d", password):
        raise ValueError("Şifre en az bir rakam içermelidir")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError("Şifre en az bir özel karakter içermelidir")
    return password


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def create_attendance_qr_token() -> str:
    return jwt.encode(
        {"purpose": "attendance", "workplace": "main-office"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_attendance_qr_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

    if payload.get("purpose") != "attendance":
        return None
    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş oturum jetonu",
        )

    try:
        user_id = int(payload["sub"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz oturum konusu",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı bulunamadı",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabı aktif değil",
        )

    return user


def require_password_changed(current_user: User = Depends(get_current_user)) -> User:
    if current_user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Şifre değişimi zorunludur",
        )

    return current_user


def require_admin(current_user: User = Depends(require_password_changed)) -> User:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yönetici yetkisi gerekiyor",
        )

    return current_user
