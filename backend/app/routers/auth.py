from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from app.database import get_db
from app.models import User
from app.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    TokenResponse,
    UserAccountResponse,
)


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role}
    )

    return TokenResponse(
        access_token=access_token,
        role=user.role,
        user_id=user.id,
        must_change_password=user.must_change_password,
    )


def build_current_user_response(user: User) -> UserAccountResponse:
    employee = user.employee

    return UserAccountResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        employee_id=employee.id if employee else None,
        shift_id=employee.shift_id if employee else None,
        shift_name=employee.shift.name if employee and employee.shift else None,
        shift_start_time=employee.shift.start_time if employee and employee.shift else None,
        shift_end_time=employee.shift.end_time if employee and employee.shift else None,
        personnel_no=employee.personnel_no if employee else None,
        first_name=employee.first_name if employee else None,
        last_name=employee.last_name if employee else None,
        department=employee.department if employee else None,
        position=employee.position if employee else None,
        phone=employee.phone if employee else None,
        must_change_password=user.must_change_password,
        created_at=employee.created_at if employee else user.created_at,
        updated_at=employee.updated_at if employee else user.updated_at,
    )


@router.get("/me", response_model=UserAccountResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return build_current_user_response(current_user)


@router.get("/admin-check", response_model=UserAccountResponse)
def admin_check(current_user: User = Depends(require_admin)):
    return build_current_user_response(current_user)


@router.patch("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if verify_password(payload.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.commit()

    return MessageResponse(message="Password changed successfully")
