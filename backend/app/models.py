from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


role_enum = Enum("ADMIN", "EMPLOYEE", name="user_role", native_enum=False)
attendance_event_enum = Enum("CHECK_IN", "CHECK_OUT", name="attendance_event_type", native_enum=False)
correction_status_enum = Enum("PENDING", "APPROVED", "REJECTED", name="correction_status", native_enum=False)
leave_type_enum = Enum("ANNUAL", "HEALTH", "EXCUSE", "UNPAID", name="leave_type", native_enum=False)
leave_status_enum = Enum("PENDING", "APPROVED", "REJECTED", name="leave_status", native_enum=False)
menu_item_type_enum = Enum("SOUP", "MAIN", "SIDE", "MEZE", "DESSERT", "DRINK", "OTHER", name="menu_item_type", native_enum=False)
feedback_status_enum = Enum(
    "NEW",
    "IN_REVIEW",
    "RESOLVED",
    "CANCELLED",
    name="feedback_status",
    native_enum=False,
)
category_source_enum = Enum("MANUAL", "NLP", name="category_source", native_enum=False)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(role_enum, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    must_change_password = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    employee = relationship("Employee", back_populates="user", uselist=False)
    reviewed_correction_requests = relationship("AttendanceCorrectionRequest", back_populates="reviewer")


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    employees = relationship("Employee", back_populates="shift")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True, index=True)
    personnel_no = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    department = Column(String(100), nullable=True)
    position = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="employee")
    shift = relationship("Shift", back_populates="employees")
    attendance_records = relationship("AttendanceRecord", back_populates="employee")
    correction_requests = relationship("AttendanceCorrectionRequest", back_populates="employee")
    leave_requests = relationship("LeaveRequest", back_populates="employee")
    feedbacks = relationship("Feedback", back_populates="employee")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    event_type = Column(attendance_event_enum, nullable=False)
    event_time = Column(DateTime(timezone=True), nullable=False, index=True)
    is_voided = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="attendance_records")
    correction_requests = relationship(
        "AttendanceCorrectionRequest",
        back_populates="attendance_record",
        foreign_keys="AttendanceCorrectionRequest.attendance_record_id",
    )
    replacement_for_corrections = relationship(
        "AttendanceCorrectionRequest",
        back_populates="replacement_record",
        foreign_keys="AttendanceCorrectionRequest.replacement_record_id",
    )


class AttendanceCorrectionRequest(Base):
    __tablename__ = "attendance_correction_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    attendance_record_id = Column(Integer, ForeignKey("attendance_records.id"), nullable=True)
    replacement_record_id = Column(Integer, ForeignKey("attendance_records.id"), nullable=True)
    requested_event_type = Column(attendance_event_enum, nullable=False)
    requested_time = Column(DateTime(timezone=True), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(correction_status_enum, nullable=False, default="PENDING")
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_note = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="correction_requests")
    attendance_record = relationship(
        "AttendanceRecord",
        back_populates="correction_requests",
        foreign_keys=[attendance_record_id],
    )
    replacement_record = relationship(
        "AttendanceRecord",
        back_populates="replacement_for_corrections",
        foreign_keys=[replacement_record_id],
    )
    reviewer = relationship("User", back_populates="reviewed_correction_requests")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    leave_type = Column(leave_type_enum, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(leave_status_enum, nullable=False, default="PENDING")
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_note = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    employee = relationship("Employee", back_populates="leave_requests")
    reviewer = relationship("User")


class MenuPlan(Base):
    __tablename__ = "menu_plans"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    daily_menus = relationship("DailyMenu", back_populates="menu_plan")


class DailyMenu(Base):
    __tablename__ = "daily_menus"
    __table_args__ = (UniqueConstraint("menu_plan_id", "menu_date", name="uq_daily_menu_plan_date"),)

    id = Column(Integer, primary_key=True, index=True)
    menu_plan_id = Column(Integer, ForeignKey("menu_plans.id"), nullable=False)
    menu_date = Column(Date, nullable=False, index=True)
    total_calories = Column(Integer, nullable=True)
    note = Column(Text, nullable=True)

    menu_plan = relationship("MenuPlan", back_populates="daily_menus")
    items = relationship("MenuItem", back_populates="daily_menu")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    daily_menu_id = Column(Integer, ForeignKey("daily_menus.id"), nullable=False)
    name = Column(String(150), nullable=False)
    item_type = Column(menu_item_type_enum, nullable=False, default="OTHER")
    display_order = Column(Integer, nullable=False, default=0)

    daily_menu = relationship("DailyMenu", back_populates="items")


class ShuttleRoute(Base):
    __tablename__ = "shuttle_routes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    evening_departure_time = Column(Time, nullable=False)
    driver_name = Column(String(100), nullable=True)
    driver_phone = Column(String(30), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    stops = relationship("ShuttleStop", back_populates="route")


class ShuttleStop(Base):
    __tablename__ = "shuttle_stops"
    __table_args__ = (UniqueConstraint("route_id", "morning_order", name="uq_shuttle_stop_route_order"),)

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("shuttle_routes.id"), nullable=False)
    name = Column(String(150), nullable=False)
    morning_order = Column(Integer, nullable=False)
    morning_time = Column(Time, nullable=False)

    route = relationship("ShuttleRoute", back_populates="stops")


class FeedbackCategory(Base):
    __tablename__ = "feedback_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    feedbacks = relationship("Feedback", back_populates="category")


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("feedback_categories.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_anonymous = Column(Boolean, nullable=False, default=False)
    category_source = Column(category_source_enum, nullable=False, default="MANUAL")
    prediction_confidence = Column(Float, nullable=True)
    nlp_detail = Column(String(150), nullable=True)
    sender_priority_score = Column(Integer, nullable=False, default=1)
    message_priority_score = Column(Integer, nullable=False, default=1)
    total_priority_score = Column(Integer, nullable=False, default=2)
    status = Column(feedback_status_enum, nullable=False, default="NEW")
    admin_note = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted_by_user = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    employee = relationship("Employee", back_populates="feedbacks")
    category = relationship("FeedbackCategory", back_populates="feedbacks")
    reviewer = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    data = Column(JSON, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")


class DevicePushToken(Base):
    __tablename__ = "device_push_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expo_push_token = Column(String(255), nullable=True)
    native_push_token = Column(String(255), nullable=True)
    platform = Column(String(50), nullable=False)
    device_identifier = Column(String(255), nullable=True)
    app_version = Column(String(50), nullable=True)
    environment = Column(String(50), nullable=False, default="development")
    is_active = Column(Boolean, nullable=False, default=True)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
