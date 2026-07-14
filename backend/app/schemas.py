import re
from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.auth import validate_password_strength


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    must_change_password: bool


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_active: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime


class EmployeeCreate(BaseModel):
    email: EmailStr
    password: str
    personnel_no: str
    first_name: str
    last_name: str
    department: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, password: str) -> str:
        return validate_password_strength(password)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, phone: Optional[str]) -> Optional[str]:
        if phone is None:
            return phone
        if not re.fullmatch(r"0\d{10}", phone):
            raise ValueError("Phone number must be 11 digits and start with 0")
        return phone


class AdminCreate(EmployeeCreate):
    pass


class EmployeeUpdate(BaseModel):
    email: Optional[EmailStr] = None
    personnel_no: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, phone: Optional[str]) -> Optional[str]:
        if phone is None:
            return phone
        if not re.fullmatch(r"0\d{10}", phone):
            raise ValueError("Phone number must be 11 digits and start with 0")
        return phone


class EmployeeResponse(BaseModel):
    id: int
    user_id: int
    email: EmailStr
    role: str
    shift_id: Optional[int] = None
    shift_name: Optional[str] = None
    personnel_no: str
    first_name: str
    last_name: str
    department: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime


class UserAccountResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_active: bool
    employee_id: Optional[int] = None
    shift_id: Optional[int] = None
    shift_name: Optional[str] = None
    shift_start_time: Optional[time] = None
    shift_end_time: Optional[time] = None
    personnel_no: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    must_change_password: bool
    created_at: datetime
    updated_at: datetime


class ActiveStatusUpdate(BaseModel):
    is_active: bool


class RoleUpdate(BaseModel):
    role: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, password: str) -> str:
        return validate_password_strength(password)


class MessageResponse(BaseModel):
    message: str


class AttendanceRecordResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    personnel_no: str
    department: Optional[str] = None
    position: Optional[str] = None
    event_type: str
    event_time: datetime
    is_voided: bool = False
    created_at: datetime


class AttendanceDailySummaryItem(BaseModel):
    employee_id: int
    employee_name: str
    personnel_no: str
    department: Optional[str] = None
    first_check_in: Optional[datetime] = None
    last_check_out: Optional[datetime] = None
    total_minutes: int
    status: str
    record_count: int
    records: List[AttendanceRecordResponse]


class AttendanceDailySummaryResponse(BaseModel):
    items: List[AttendanceDailySummaryItem]
    total_employees: int
    matched_employees: int
    total_records: int
    open_employees: int
    checked_out_employees: int
    page: int
    page_size: int


class AttendanceQrResponse(BaseModel):
    qr_token: str
    workplace: str


class AttendanceScanRequest(BaseModel):
    qr_token: str


class AttendanceScanResponse(BaseModel):
    record: AttendanceRecordResponse
    next_event_type: str
    message: str


class AttendanceCorrectionResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    personnel_no: str
    department: Optional[str] = None
    attendance_record_id: Optional[int] = None
    requested_event_type: str
    requested_time: datetime
    reason: str
    status: str
    review_note: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime


class AttendanceCorrectionCreate(BaseModel):
    attendance_record_id: Optional[int] = None
    requested_event_type: str
    requested_time: datetime
    reason: str

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, reason: str) -> str:
        cleaned_reason = reason.strip()
        if not cleaned_reason:
            raise ValueError("Reason is required")
        return cleaned_reason


class AttendanceCorrectionAdminUpdate(BaseModel):
    status: str
    review_note: Optional[str] = None


class LeaveRequestCreate(BaseModel):
    leave_type: str
    start_date: date
    end_date: date
    total_days: float
    reason: Optional[str] = None

    @field_validator("total_days")
    @classmethod
    def validate_total_days(cls, total_days: float) -> float:
        if total_days <= 0:
            raise ValueError("Total days must be greater than 0")
        return total_days


class LeaveRequestAdminUpdate(BaseModel):
    status: str
    review_note: Optional[str] = None


class LeaveRequestResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    personnel_no: str
    department: Optional[str] = None
    position: Optional[str] = None
    leave_type: str
    start_date: date
    end_date: date
    total_days: float
    reason: Optional[str] = None
    status: str
    reviewed_by: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ShiftCreate(BaseModel):
    name: str
    start_time: time
    end_time: time
    description: Optional[str] = None
    is_active: bool = True


class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ShiftResponse(BaseModel):
    id: int
    name: str
    start_time: time
    end_time: time
    description: Optional[str] = None
    is_active: bool
    created_at: datetime


class EmployeeShiftUpdate(BaseModel):
    shift_id: Optional[int] = None


class MenuItemInput(BaseModel):
    name: str
    item_type: str = "OTHER"
    display_order: int = 0


class MenuItemResponse(BaseModel):
    id: int
    daily_menu_id: int
    name: str
    item_type: str
    display_order: int


class DailyMenuUpsert(BaseModel):
    menu_date: date
    total_calories: Optional[int] = None
    note: Optional[str] = None
    items: List[MenuItemInput]


class DailyMenuResponse(BaseModel):
    id: int
    menu_plan_id: int
    menu_date: date
    total_calories: Optional[int] = None
    note: Optional[str] = None
    items: List[MenuItemResponse] = []


class MenuPlanResponse(BaseModel):
    id: int
    title: str
    start_date: date
    end_date: date
    created_at: datetime
    daily_menus: List[DailyMenuResponse] = []


class ShuttleStopCreate(BaseModel):
    name: str
    morning_order: int
    morning_time: time

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: str) -> str:
        cleaned_name = name.strip()
        if not cleaned_name:
            raise ValueError("Stop name is required")
        return cleaned_name


class ShuttleStopUpdate(BaseModel):
    name: Optional[str] = None
    morning_order: Optional[int] = None
    morning_time: Optional[time] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: Optional[str]) -> Optional[str]:
        if name is None:
            return name

        cleaned_name = name.strip()
        if not cleaned_name:
            raise ValueError("Stop name is required")
        return cleaned_name


class ShuttleStopResponse(BaseModel):
    id: int
    route_id: int
    name: str
    morning_order: int
    morning_time: time


class ShuttleRouteCreate(BaseModel):
    name: str
    evening_departure_time: time
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    is_active: bool = True
    stops: List[ShuttleStopCreate] = []

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: str) -> str:
        cleaned_name = name.strip()
        if not cleaned_name:
            raise ValueError("Route name is required")
        return cleaned_name

    @field_validator("driver_phone")
    @classmethod
    def validate_driver_phone(cls, driver_phone: Optional[str]) -> Optional[str]:
        if driver_phone is None:
            return driver_phone

        cleaned_phone = driver_phone.strip()
        if not cleaned_phone:
            return None

        if not re.fullmatch(r"0\d{10}", cleaned_phone):
            raise ValueError("Driver phone number must be 11 digits and start with 0")

        return cleaned_phone


class ShuttleRouteUpdate(BaseModel):
    name: Optional[str] = None
    evening_departure_time: Optional[time] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    is_active: Optional[bool] = None
    stops: Optional[List[ShuttleStopCreate]] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: Optional[str]) -> Optional[str]:
        if name is None:
            return name

        cleaned_name = name.strip()
        if not cleaned_name:
            raise ValueError("Route name is required")
        return cleaned_name

    @field_validator("driver_phone")
    @classmethod
    def validate_driver_phone(cls, driver_phone: Optional[str]) -> Optional[str]:
        if driver_phone is None:
            return driver_phone

        cleaned_phone = driver_phone.strip()
        if not cleaned_phone:
            return None

        if not re.fullmatch(r"0\d{10}", cleaned_phone):
            raise ValueError("Driver phone number must be 11 digits and start with 0")

        return cleaned_phone


class ShuttleRouteResponse(BaseModel):
    id: int
    name: str
    evening_departure_time: time
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    is_active: bool
    created_at: datetime
    stops: List[ShuttleStopResponse] = []


class FeedbackCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class FeedbackCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class FeedbackCategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime


class FeedbackCreate(BaseModel):
    category_id: int
    message: str
    is_anonymous: bool = False


class FeedbackAnalyzeRequest(BaseModel):
    category_id: int
    message: str


class FeedbackAnalyzeResponse(BaseModel):
    action: str
    clean_message: str
    selected_category_id: int
    selected_category_name: str
    suggested_category_name: Optional[str] = None
    suggested_category_confidence: Optional[float] = None
    category_mismatch: bool
    relevance_label: str
    relevance_confidence: float
    relevance_reason: str
    needs_manual_review: bool
    suggested_detail: Optional[str] = None
    detail_confidence: Optional[float] = None
    message_priority_score: Optional[int] = None
    user_message: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: int
    category_id: int
    category_name: str
    message: str
    is_anonymous: bool
    category_source: str
    prediction_confidence: Optional[float] = None
    nlp_detail: Optional[str] = None
    sender_priority_score: int
    message_priority_score: int
    total_priority_score: int
    status: str
    admin_note: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    sender_name: Optional[str] = None
    sender_department: Optional[str] = None
    sender_position: Optional[str] = None


class FeedbackAdminUpdate(BaseModel):
    status: Optional[str] = None
    admin_note: Optional[str] = None
