from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import hash_password, require_admin
from app.database import get_db
from app.models import Employee, User
from app.schemas import (
    ActiveStatusUpdate,
    AdminCreate,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    RoleUpdate,
    UserAccountResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def build_employee_response(employee: Employee) -> EmployeeResponse:
    return EmployeeResponse(
        id=employee.id,
        user_id=employee.user_id,
        email=employee.user.email,
        role=employee.user.role,
        shift_id=employee.shift_id,
        shift_name=employee.shift.name if employee.shift else None,
        personnel_no=employee.personnel_no,
        first_name=employee.first_name,
        last_name=employee.last_name,
        department=employee.department,
        position=employee.position,
        phone=employee.phone,
        is_active=employee.user.is_active,
        must_change_password=employee.user.must_change_password,
        created_at=employee.created_at,
        updated_at=employee.updated_at,
    )


def build_user_account_response(user: User) -> UserAccountResponse:
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
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def create_user_with_employee_profile(
    payload: EmployeeCreate,
    role: str,
    db: Session,
) -> Employee:
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already in use",
        )

    existing_employee = (
        db.query(Employee)
        .filter(Employee.personnel_no == payload.personnel_no)
        .first()
    )
    if existing_employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Personnel number is already in use",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.flush()

    employee = Employee(
        user_id=user.id,
        personnel_no=payload.personnel_no,
        first_name=payload.first_name,
        last_name=payload.last_name,
        department=payload.department,
        position=payload.position,
        phone=payload.phone,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    return employee


@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    employee = create_user_with_employee_profile(payload, "EMPLOYEE", db)
    return build_employee_response(employee)


@router.post("/admins", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_admin(
    payload: AdminCreate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    employee = create_user_with_employee_profile(payload, "ADMIN", db)
    return build_employee_response(employee)


@router.get("/users", response_model=List[UserAccountResponse])
def list_users(
    role: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    department: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    query = db.query(User).outerjoin(Employee)

    if role:
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if department:
        query = query.filter(Employee.department == department)

    users = query.order_by(User.id).all()
    return [build_user_account_response(user) for user in users]


@router.get("/employees", response_model=List[EmployeeResponse])
def list_employees(
    department: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    query = db.query(Employee).join(User).filter(User.role == "EMPLOYEE")

    if department:
        query = query.filter(Employee.department == department)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    employees = query.order_by(Employee.id).all()
    return [build_employee_response(employee) for employee in employees]


@router.patch("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "email" in update_data:
        existing_user = (
            db.query(User)
            .filter(User.email == update_data["email"], User.id != employee.user_id)
            .first()
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use",
            )
        employee.user.email = update_data.pop("email")

    if "personnel_no" in update_data:
        existing_employee = (
            db.query(Employee)
            .filter(
                Employee.personnel_no == update_data["personnel_no"],
                Employee.id != employee.id,
            )
            .first()
        )
        if existing_employee:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Personnel number is already in use",
            )

    old_shift_id = employee.shift_id

    for field, value in update_data.items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)

    if "shift_id" in update_data and old_shift_id != employee.shift_id:
        try:
            from app.services.notification_service import create_and_send_notification

            if employee.shift_id is None:
                noti_title = "Vardiya Kaldırıldı"
                noti_body = "Atanmış olan aktif vardiyanız kaldırıldı."
            else:
                from app.models import Shift
                shift = db.query(Shift).filter(Shift.id == employee.shift_id).first()
                shift_name = shift.name if shift else "Yeni Vardiya"
                start_str = shift.start_time.strftime('%H:%M') if shift and shift.start_time else '--:--'
                end_str = shift.end_time.strftime('%H:%M') if shift and shift.end_time else '--:--'

                if old_shift_id is None:
                    noti_title = "İlk Vardiya Atandı"
                    noti_body = f"Hesabınıza '{shift_name}' ({start_str} - {end_str}) vardiyası atandı."
                else:
                    noti_title = "Vardiya Değiştirildi"
                    noti_body = f"Vardiyanız '{shift_name}' ({start_str} - {end_str}) olarak güncellendi."

            create_and_send_notification(
                db=db,
                user_id=employee.user_id,
                type="SHIFT_ASSIGN",
                title=noti_title,
                body=noti_body,
                data={"screen": "shifts", "shift_id": employee.shift_id},
                send_push=True
            )
        except Exception as e:
            pass

    return build_employee_response(employee)


@router.patch("/users/{user_id}/active-status", response_model=UserAccountResponse)
def update_user_active_status(
    user_id: int,
    payload: ActiveStatusUpdate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.role == "ADMIN" and user.is_active and not payload.is_active:
        active_admin_count = (
            db.query(User)
            .filter(User.role == "ADMIN", User.is_active.is_(True))
            .count()
        )
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one active admin must remain",
            )

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)

    return build_user_account_response(user)


@router.patch("/users/{user_id}/role", response_model=UserAccountResponse)
def update_user_role(
    user_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    allowed_roles = {"EMPLOYEE", "ADMIN"}
    if payload.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role",
        )

    if user.role == "ADMIN" and payload.role == "EMPLOYEE":
        active_admin_count = (
            db.query(User)
            .filter(User.role == "ADMIN", User.is_active.is_(True))
            .count()
        )
        if user.is_active and active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one active admin must remain",
            )

    user.role = payload.role
    db.commit()
    db.refresh(user)

    return build_user_account_response(user)
