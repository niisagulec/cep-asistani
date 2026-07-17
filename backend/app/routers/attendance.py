from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.auth import (
    create_attendance_qr_token,
    decode_attendance_qr_token,
    require_admin,
    require_password_changed,
)
from app.database import get_db
from app.models import (
    AttendanceCorrectionRequest,
    AttendanceRecord,
    Employee,
    LeaveRequest,
    Shift,
    User,
)
from app.schemas import (
    AttendanceCorrectionAdminUpdate,
    AttendanceCorrectionCreate,
    AttendanceCorrectionResponse,
    AttendanceDailySummaryItem,
    AttendanceDailySummaryResponse,
    AttendanceQrResponse,
    AttendanceRecordResponse,
    AttendanceScanRequest,
    AttendanceScanResponse,
    EmployeeShiftUpdate,
    LeaveRequestAdminUpdate,
    LeaveRequestCreate,
    LeaveRequestResponse,
    ShiftCreate,
    ShiftResponse,
    ShiftUpdate,
)


router = APIRouter(tags=["attendance"])

ALLOWED_ATTENDANCE_STATUSES = {"PENDING", "APPROVED", "REJECTED"}
ALLOWED_LEAVE_TYPES = {"ANNUAL", "HEALTH", "EXCUSE", "UNPAID"}
ALLOWED_LEAVE_STATUSES = {"PENDING", "APPROVED", "REJECTED"}
ATTENDANCE_SCAN_COOLDOWN_SECONDS = 60
MAX_CORRECTION_AGE_DAYS = 30
ISTANBUL_TIMEZONE = ZoneInfo("Europe/Istanbul")


def employee_full_name(employee: Employee) -> str:
    return f"{employee.first_name} {employee.last_name}".strip()


def reviewer_full_name(user: Optional[User]) -> Optional[str]:
    if not user or not user.employee:
        return None
    return employee_full_name(user.employee)


def build_attendance_record_response(record: AttendanceRecord) -> AttendanceRecordResponse:
    employee = record.employee
    return AttendanceRecordResponse(
        id=record.id,
        employee_id=employee.id,
        employee_name=employee_full_name(employee),
        personnel_no=employee.personnel_no,
        department=employee.department,
        position=employee.position,
        event_type=record.event_type,
        event_time=record.event_time,
        is_voided=record.is_voided,
        created_at=record.created_at,
    )


def build_correction_response(request: AttendanceCorrectionRequest) -> AttendanceCorrectionResponse:
    employee = request.employee
    return AttendanceCorrectionResponse(
        id=request.id,
        employee_id=employee.id,
        employee_name=employee_full_name(employee),
        personnel_no=employee.personnel_no,
        department=employee.department,
        attendance_record_id=request.attendance_record_id,
        requested_event_type=request.requested_event_type,
        requested_time=request.requested_time,
        reason=request.reason,
        status=request.status,
        review_note=request.review_note,
        reviewed_by=request.reviewed_by,
        reviewer_name=reviewer_full_name(request.reviewer),
        reviewed_at=request.reviewed_at,
        created_at=request.created_at,
    )


def build_leave_response(leave: LeaveRequest) -> LeaveRequestResponse:
    employee = leave.employee
    return LeaveRequestResponse(
        id=leave.id,
        employee_id=employee.id,
        employee_name=employee_full_name(employee),
        personnel_no=employee.personnel_no,
        department=employee.department,
        position=employee.position,
        leave_type=leave.leave_type,
        start_date=leave.start_date,
        end_date=leave.end_date,
        total_days=leave.total_days,
        reason=leave.reason,
        status=leave.status,
        reviewed_by=leave.reviewed_by,
        reviewer_name=reviewer_full_name(leave.reviewer),
        review_note=leave.review_note,
        reviewed_at=leave.reviewed_at,
        created_at=leave.created_at,
        updated_at=leave.updated_at,
    )


def build_shift_response(shift: Shift) -> ShiftResponse:
    return ShiftResponse(
        id=shift.id,
        name=shift.name,
        start_time=shift.start_time,
        end_time=shift.end_time,
        description=shift.description,
        is_active=shift.is_active,
        created_at=shift.created_at,
    )


def validate_date_range(start_date: date, end_date: date) -> None:
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be earlier than start date",
        )


def validate_leave_dates(start_date: date, end_date: date) -> None:
    validate_date_range(start_date, end_date)
    today = datetime.now(ISTANBUL_TIMEZONE).date()
    if start_date < today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçmiş tarihli izin talebi oluşturulamaz.",
        )


def attendance_day_bounds(selected_date: date):
    local_start = datetime.combine(selected_date, time.min).replace(
        tzinfo=ISTANBUL_TIMEZONE,
    )
    local_end = local_start + timedelta(days=1)
    return local_start.astimezone(timezone.utc), local_end.astimezone(timezone.utc)


def build_daily_attendance_summary(employee: Employee, records):
    chronological_records = sorted(records, key=lambda record: record.event_time)
    valid_records = [record for record in chronological_records if not record.is_voided]
    first_check_in = next(
        (record.event_time for record in valid_records if record.event_type == "CHECK_IN"),
        None,
    )
    last_check_out = next(
        (
            record.event_time
            for record in reversed(valid_records)
            if record.event_type == "CHECK_OUT"
        ),
        None,
    )
    open_check_in = None
    total_seconds = 0
    for record in valid_records:
        if record.event_type == "CHECK_IN":
            open_check_in = record.event_time
        elif record.event_type == "CHECK_OUT" and open_check_in:
            total_seconds += max(0, (record.event_time - open_check_in).total_seconds())
            open_check_in = None

    return AttendanceDailySummaryItem(
        employee_id=employee.id,
        employee_name=employee_full_name(employee),
        personnel_no=employee.personnel_no,
        department=employee.department,
        first_check_in=first_check_in,
        last_check_out=last_check_out,
        total_minutes=int(total_seconds // 60),
        status=(
            "OPEN"
            if valid_records and valid_records[-1].event_type == "CHECK_IN"
            else "COMPLETED"
        ),
        record_count=len(valid_records),
        records=[build_attendance_record_response(record) for record in chronological_records],
    )


@router.get("/admin/attendance-qr", response_model=AttendanceQrResponse)
def get_attendance_qr(
    _current_admin: User = Depends(require_admin),
):
    return AttendanceQrResponse(
        qr_token=create_attendance_qr_token(),
        workplace="Ana iş yeri girişi",
    )


@router.get("/attendance/me", response_model=List[AttendanceRecordResponse])
def list_my_attendance_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee profile not found",
        )

    records = (
        db.query(AttendanceRecord)
        .options(joinedload(AttendanceRecord.employee))
        .filter(AttendanceRecord.employee_id == current_user.employee.id)
        .order_by(AttendanceRecord.event_time.desc())
        .all()
    )
    return [build_attendance_record_response(record) for record in records]


@router.post("/attendance/scan", response_model=AttendanceScanResponse)
def scan_attendance_qr(
    payload: AttendanceScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee profile not found",
        )

    if not decode_attendance_qr_token(payload.qr_token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attendance QR code",
        )

    last_record = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.employee_id == current_user.employee.id,
            AttendanceRecord.is_voided.is_(False),
        )
        .order_by(AttendanceRecord.event_time.desc())
        .first()
    )
    now = datetime.now(timezone.utc)
    if last_record:
        last_event_time = last_record.event_time
        if last_event_time.tzinfo is None:
            last_event_time = last_event_time.replace(tzinfo=timezone.utc)
        if now - last_event_time < timedelta(seconds=ATTENDANCE_SCAN_COOLDOWN_SECONDS):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Attendance QR was scanned too recently",
            )

    local_today = now.astimezone(ISTANBUL_TIMEZONE).date()
    local_day_start = datetime.combine(local_today, time.min).replace(
        tzinfo=ISTANBUL_TIMEZONE,
    )
    next_local_day_start = local_day_start + timedelta(days=1)
    last_today_record = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.employee_id == current_user.employee.id,
            AttendanceRecord.is_voided.is_(False),
            AttendanceRecord.event_time >= local_day_start.astimezone(timezone.utc),
            AttendanceRecord.event_time < next_local_day_start.astimezone(timezone.utc),
        )
        .order_by(AttendanceRecord.event_time.desc())
        .first()
    )
    event_type = (
        "CHECK_OUT"
        if last_today_record and last_today_record.event_type == "CHECK_IN"
        else "CHECK_IN"
    )
    record = AttendanceRecord(
        employee_id=current_user.employee.id,
        event_type=event_type,
        event_time=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    next_event_type = "CHECK_OUT" if event_type == "CHECK_IN" else "CHECK_IN"
    return AttendanceScanResponse(
        record=build_attendance_record_response(record),
        next_event_type=next_event_type,
        message="Giriş kaydı oluşturuldu" if event_type == "CHECK_IN" else "Çıkış kaydı oluşturuldu",
    )


@router.get("/admin/attendance-records", response_model=List[AttendanceRecordResponse])
def list_attendance_records(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    department: Optional[str] = Query(default=None),
    employee_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    query = (
        db.query(AttendanceRecord)
        .join(Employee)
        .options(joinedload(AttendanceRecord.employee))
    )

    if date_from:
        date_from_start = datetime.combine(date_from, time.min).replace(
            tzinfo=ISTANBUL_TIMEZONE,
        )
        query = query.filter(
            AttendanceRecord.event_time >= date_from_start.astimezone(timezone.utc),
        )
    if date_to:
        date_to_end = datetime.combine(date_to + timedelta(days=1), time.min).replace(
            tzinfo=ISTANBUL_TIMEZONE,
        )
        query = query.filter(
            AttendanceRecord.event_time < date_to_end.astimezone(timezone.utc),
        )
    if department:
        query = query.filter(Employee.department == department)
    if employee_id:
        query = query.filter(AttendanceRecord.employee_id == employee_id)

    records = query.order_by(AttendanceRecord.event_time.desc()).all()
    return [build_attendance_record_response(record) for record in records]


@router.get(
    "/admin/attendance-daily-summary",
    response_model=AttendanceDailySummaryResponse,
)
def get_attendance_daily_summary(
    selected_date: date = Query(alias="date"),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    day_start, day_end = attendance_day_bounds(selected_date)
    employee_query = (
        db.query(Employee)
        .join(AttendanceRecord)
        .filter(
            AttendanceRecord.event_time >= day_start,
            AttendanceRecord.event_time < day_end,
            AttendanceRecord.is_voided.is_(False),
        )
    )
    total_employees = employee_query.with_entities(
        func.count(func.distinct(Employee.id)),
    ).scalar() or 0

    cleaned_search = search.strip() if search else ""
    if cleaned_search:
        search_pattern = f"%{cleaned_search}%"
        employee_query = employee_query.filter(
            or_(
                Employee.first_name.ilike(search_pattern),
                Employee.last_name.ilike(search_pattern),
                Employee.personnel_no.ilike(search_pattern),
                Employee.department.ilike(search_pattern),
                func.concat(Employee.first_name, " ", Employee.last_name).ilike(search_pattern),
            )
        )

    matched_employees = employee_query.with_entities(
        func.count(func.distinct(Employee.id)),
    ).scalar() or 0
    employees = (
        employee_query.distinct()
        .order_by(Employee.last_name, Employee.first_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    employee_ids = [employee.id for employee in employees]
    records = []
    if employee_ids:
        records = (
            db.query(AttendanceRecord)
            .options(joinedload(AttendanceRecord.employee))
            .filter(
                AttendanceRecord.employee_id.in_(employee_ids),
                AttendanceRecord.event_time >= day_start,
                AttendanceRecord.event_time < day_end,
            )
            .order_by(AttendanceRecord.event_time)
            .all()
        )

    records_by_employee = {employee_id: [] for employee_id in employee_ids}
    for record in records:
        records_by_employee[record.employee_id].append(record)

    total_records = (
        db.query(func.count(AttendanceRecord.id))
        .filter(
            AttendanceRecord.event_time >= day_start,
            AttendanceRecord.event_time < day_end,
            AttendanceRecord.is_voided.is_(False),
        )
        .scalar()
        or 0
    )
    ranked_records = (
        db.query(
            AttendanceRecord.employee_id.label("employee_id"),
            AttendanceRecord.event_type.label("event_type"),
            func.row_number()
            .over(
                partition_by=AttendanceRecord.employee_id,
                order_by=AttendanceRecord.event_time.desc(),
            )
            .label("row_number"),
        )
        .filter(
            AttendanceRecord.event_time >= day_start,
            AttendanceRecord.event_time < day_end,
            AttendanceRecord.is_voided.is_(False),
        )
        .subquery()
    )
    open_employees = (
        db.query(func.count())
        .select_from(ranked_records)
        .filter(
            ranked_records.c.row_number == 1,
            ranked_records.c.event_type == "CHECK_IN",
        )
        .scalar()
        or 0
    )
    return AttendanceDailySummaryResponse(
        items=[
            build_daily_attendance_summary(employee, records_by_employee[employee.id])
            for employee in employees
        ],
        total_employees=total_employees,
        matched_employees=matched_employees,
        total_records=total_records,
        open_employees=open_employees,
        checked_out_employees=max(0, total_employees - open_employees),
        page=page,
        page_size=page_size,
    )


@router.post(
    "/attendance-corrections",
    response_model=AttendanceCorrectionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_attendance_correction(
    payload: AttendanceCorrectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee profile not found",
        )

    event_type = payload.requested_event_type.upper()
    if event_type not in {"CHECK_IN", "CHECK_OUT"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attendance event type",
        )

    requested_time = payload.requested_time
    if requested_time.tzinfo is None:
        requested_time = requested_time.replace(tzinfo=ISTANBUL_TIMEZONE)
    requested_time = requested_time.astimezone(timezone.utc)
    now = datetime.now(timezone.utc)
    if requested_time > now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance correction time cannot be in the future",
        )
    if requested_time < now - timedelta(days=MAX_CORRECTION_AGE_DAYS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yalnızca son 30 güne ait mesai kayıtları için düzeltme talebi oluşturulabilir.",
        )

    attendance_record = None
    if payload.attendance_record_id is not None:
        attendance_record = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.id == payload.attendance_record_id,
                AttendanceRecord.employee_id == current_user.employee.id,
                AttendanceRecord.is_voided.is_(False),
            )
            .first()
        )
        if not attendance_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance record not found",
            )

    correction = AttendanceCorrectionRequest(
        employee_id=current_user.employee.id,
        attendance_record_id=attendance_record.id if attendance_record else None,
        requested_event_type=event_type,
        requested_time=requested_time,
        reason=payload.reason,
        status="PENDING",
    )
    db.add(correction)
    db.commit()
    db.refresh(correction)

    return build_correction_response(correction)


@router.get("/attendance-corrections/me", response_model=List[AttendanceCorrectionResponse])
def list_my_attendance_corrections(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee profile not found",
        )

    requests = (
        db.query(AttendanceCorrectionRequest)
        .options(
            joinedload(AttendanceCorrectionRequest.employee),
            joinedload(AttendanceCorrectionRequest.reviewer).joinedload(User.employee),
        )
        .filter(AttendanceCorrectionRequest.employee_id == current_user.employee.id)
        .order_by(AttendanceCorrectionRequest.created_at.desc())
        .all()
    )
    return [build_correction_response(request) for request in requests]


@router.get("/admin/attendance-corrections", response_model=List[AttendanceCorrectionResponse])
def list_attendance_corrections(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    query = db.query(AttendanceCorrectionRequest).options(
        joinedload(AttendanceCorrectionRequest.employee),
        joinedload(AttendanceCorrectionRequest.reviewer).joinedload(User.employee),
    )

    if status_filter:
        query = query.filter(AttendanceCorrectionRequest.status == status_filter.upper())

    requests = query.order_by(AttendanceCorrectionRequest.created_at.desc()).all()
    return [build_correction_response(request) for request in requests]


@router.patch(
    "/admin/attendance-corrections/{request_id}",
    response_model=AttendanceCorrectionResponse,
)
def review_attendance_correction(
    request_id: int,
    payload: AttendanceCorrectionAdminUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    new_status = payload.status.upper()
    if new_status not in ALLOWED_ATTENDANCE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attendance correction status",
        )

    correction = (
        db.query(AttendanceCorrectionRequest)
        .options(
            joinedload(AttendanceCorrectionRequest.employee),
            joinedload(AttendanceCorrectionRequest.reviewer).joinedload(User.employee),
        )
        .filter(AttendanceCorrectionRequest.id == request_id)
        .first()
    )
    if not correction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance correction request not found",
        )

    was_already_approved = correction.status == "APPROVED"
    correction.status = new_status
    correction.review_note = payload.review_note
    correction.reviewed_by = current_admin.id
    correction.reviewed_at = datetime.now(timezone.utc)

    if new_status == "APPROVED" and not was_already_approved:
        if correction.attendance_record_id:
            original_record = (
                db.query(AttendanceRecord)
                .filter(AttendanceRecord.id == correction.attendance_record_id)
                .first()
            )
            if original_record:
                original_record.is_voided = True

        replacement_record = AttendanceRecord(
            employee_id=correction.employee_id,
            event_type=correction.requested_event_type,
            event_time=correction.requested_time,
        )
        db.add(replacement_record)
        db.flush()
        correction.replacement_record_id = replacement_record.id

    if new_status != "APPROVED" and was_already_approved:
        replacement_record = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.id == correction.replacement_record_id)
            .first()
        )
        if replacement_record:
            db.delete(replacement_record)
        correction.replacement_record_id = None

        if correction.attendance_record_id:
            original_record = (
                db.query(AttendanceRecord)
                .filter(AttendanceRecord.id == correction.attendance_record_id)
                .first()
            )
            if original_record:
                original_record.is_voided = False

    db.commit()
    db.refresh(correction)

    try:
        from app.services.notification_service import create_and_send_notification
        status_tr = "onaylandı" if new_status == "APPROVED" else "reddedildi"
        employee_user_id = correction.employee.user_id

        body_text = f"{correction.requested_time.strftime('%d.%m.%Y %H:%M')} tarihli mesai düzeltme talebiniz İK tarafından {status_tr}."
        if payload.review_note:
            body_text += f" Not: {payload.review_note}"

        create_and_send_notification(
            db=db,
            user_id=employee_user_id,
            type="CORRECTION_STATUS",
            title=f"Düzeltme Talebi {status_tr.capitalize()}",
            body=body_text,
            data={"screen": "attendance", "request_id": correction.id, "status": new_status},
            send_push=True
        )
    except Exception as e:
        pass

    return build_correction_response(correction)


@router.post("/leaves", response_model=LeaveRequestResponse, status_code=status.HTTP_201_CREATED)
def create_leave_request(
    payload: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee profile not found",
        )

    leave_type = payload.leave_type.upper()
    if leave_type not in ALLOWED_LEAVE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid leave type",
        )

    validate_leave_dates(payload.start_date, payload.end_date)

    overlapping_leave = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == current_user.employee.id,
            LeaveRequest.status.in_(["PENDING", "APPROVED"]),
            LeaveRequest.start_date <= payload.end_date,
            LeaveRequest.end_date >= payload.start_date,
        )
        .first()
    )
    if overlapping_leave:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Leave request overlaps with an existing leave request",
        )

    leave = LeaveRequest(
        employee_id=current_user.employee.id,
        leave_type=leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        total_days=(payload.end_date - payload.start_date).days + 1,
        reason=payload.reason,
        status="PENDING",
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    return build_leave_response(leave)


@router.get("/leaves/me", response_model=List[LeaveRequestResponse])
def list_my_leave_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee profile not found",
        )

    leaves = (
        db.query(LeaveRequest)
        .options(joinedload(LeaveRequest.employee), joinedload(LeaveRequest.reviewer).joinedload(User.employee))
        .filter(LeaveRequest.employee_id == current_user.employee.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )
    return [build_leave_response(leave) for leave in leaves]


@router.get("/admin/leaves", response_model=List[LeaveRequestResponse])
def list_leave_requests(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    department: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    query = (
        db.query(LeaveRequest)
        .join(Employee)
        .options(
            joinedload(LeaveRequest.employee),
            joinedload(LeaveRequest.reviewer).joinedload(User.employee),
        )
    )

    if status_filter:
        query = query.filter(LeaveRequest.status == status_filter.upper())
    if department:
        query = query.filter(Employee.department == department)

    leaves = query.order_by(LeaveRequest.created_at.desc()).all()
    return [build_leave_response(leave) for leave in leaves]


@router.patch("/admin/leaves/{leave_id}", response_model=LeaveRequestResponse)
def review_leave_request(
    leave_id: int,
    payload: LeaveRequestAdminUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    new_status = payload.status.upper()
    if new_status not in ALLOWED_LEAVE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid leave status",
        )

    leave = (
        db.query(LeaveRequest)
        .options(joinedload(LeaveRequest.employee), joinedload(LeaveRequest.reviewer).joinedload(User.employee))
        .filter(LeaveRequest.id == leave_id)
        .first()
    )
    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    leave.status = new_status
    leave.review_note = payload.review_note
    leave.reviewed_by = current_admin.id
    leave.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(leave)

    try:
        from app.services.notification_service import create_and_send_notification
        status_tr = "onaylandı" if new_status == "APPROVED" else "reddedildi"
        employee_user_id = leave.employee.user_id

        body_text = f"{leave.start_date.strftime('%d.%m.%Y')} tarihli izin talebiniz İK tarafından {status_tr}."
        if payload.review_note:
            body_text += f" Not: {payload.review_note}"

        create_and_send_notification(
            db=db,
            user_id=employee_user_id,
            type="LEAVE_STATUS",
            title=f"İzin Talebi {status_tr.capitalize()}",
            body=body_text,
            data={"screen": "leave", "request_id": leave.id, "status": new_status},
            send_push=True
        )
    except Exception as e:
        pass

    return build_leave_response(leave)


@router.get("/admin/shifts", response_model=List[ShiftResponse])
def list_shifts(
    include_inactive: bool = Query(default=True),
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    query = db.query(Shift)
    if not include_inactive:
        query = query.filter(Shift.is_active.is_(True))

    shifts = query.order_by(Shift.start_time, Shift.name).all()
    return [build_shift_response(shift) for shift in shifts]


@router.post("/admin/shifts", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
def create_shift(
    payload: ShiftCreate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    existing_shift = db.query(Shift).filter(Shift.name == payload.name).first()
    if existing_shift:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shift name is already in use",
        )

    shift = Shift(
        name=payload.name,
        start_time=payload.start_time,
        end_time=payload.end_time,
        description=payload.description,
        is_active=payload.is_active,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)

    return build_shift_response(shift)


@router.patch("/admin/shifts/{shift_id}", response_model=ShiftResponse)
def update_shift(
    shift_id: int,
    payload: ShiftUpdate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data:
        existing_shift = (
            db.query(Shift)
            .filter(Shift.name == update_data["name"], Shift.id != shift.id)
            .first()
        )
        if existing_shift:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shift name is already in use",
            )

    for field, value in update_data.items():
        setattr(shift, field, value)

    db.commit()
    db.refresh(shift)

    return build_shift_response(shift)


@router.patch("/admin/employees/{employee_id}/shift", response_model=Optional[ShiftResponse])
def assign_employee_shift(
    employee_id: int,
    payload: EmployeeShiftUpdate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    if payload.shift_id is None:
        employee.shift_id = None
        db.commit()
        return None

    shift = db.query(Shift).filter(Shift.id == payload.shift_id).first()
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found",
        )

    if not shift.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive shift cannot be assigned",
        )

    employee.shift_id = shift.id
    db.commit()
    db.refresh(shift)

    return build_shift_response(shift)
