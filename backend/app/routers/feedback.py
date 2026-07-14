from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import require_admin, require_password_changed
from app.database import get_db
from app.models import Employee, Feedback, FeedbackCategory, User
from app.schemas import (
    FeedbackAdminUpdate,
    FeedbackAnalyzeRequest,
    FeedbackAnalyzeResponse,
    FeedbackCategoryCreate,
    FeedbackCategoryResponse,
    FeedbackCategoryUpdate,
    FeedbackCreate,
    FeedbackResponse,
)
from app.services.category_prediction_service import (
    predict_feedback_category,
    should_suggest_category_change,
)
from app.services.content_filter_service import validate_feedback_message_content
from app.services.feedback_relevance_service import (
    NOT_FEEDBACK_LABEL,
    UNCERTAIN_LABEL,
    analyze_feedback_relevance,
)
from app.services.nlp_service import analyze_feedback_message


router = APIRouter(tags=["feedback"])


def calculate_sender_priority_score(position: Optional[str]) -> int:
    if not position:
        return 1

    normalized_position = position.lower()

    if "müdür" in normalized_position or "mudur" in normalized_position:
        return 4
    if "başkan" in normalized_position or "baskan" in normalized_position:
        return 4
    if "yönetici" in normalized_position or "yonetici" in normalized_position:
        return 3
    if "uzman" in normalized_position and "yardımcı" in normalized_position:
        return 2
    if "uzman" in normalized_position:
        return 3

    return 1


def calculate_total_priority_score(
    sender_priority_score: int,
    message_priority_score: int,
) -> int:
    if message_priority_score == 5:
        return 10

    return sender_priority_score + message_priority_score


def build_feedback_response(feedback: Feedback, show_sender: bool) -> FeedbackResponse:
    employee = feedback.employee
    reviewer = feedback.reviewer
    sender_name = None
    sender_department = None
    sender_position = None
    reviewer_name = None

    if show_sender and employee:
        sender_name = f"{employee.first_name} {employee.last_name}"
        sender_department = employee.department
        sender_position = employee.position

    if reviewer:
        if reviewer.employee:
            reviewer_name = (
                f"{reviewer.employee.first_name} {reviewer.employee.last_name}".strip()
            )
        else:
            reviewer_name = reviewer.email

    return FeedbackResponse(
        id=feedback.id,
        category_id=feedback.category_id,
        category_name=feedback.category.name,
        message=feedback.message,
        is_anonymous=feedback.is_anonymous,
        category_source=feedback.category_source,
        prediction_confidence=feedback.prediction_confidence,
        nlp_detail=feedback.nlp_detail,
        sender_priority_score=feedback.sender_priority_score,
        message_priority_score=feedback.message_priority_score,
        total_priority_score=feedback.total_priority_score,
        status=feedback.status,
        admin_note=feedback.admin_note,
        reviewed_by=feedback.reviewed_by,
        reviewer_name=reviewer_name,
        reviewed_at=feedback.reviewed_at,
        created_at=feedback.created_at,
        updated_at=feedback.updated_at,
        sender_name=sender_name,
        sender_department=sender_department,
        sender_position=sender_position,
    )


def build_feedback_analysis_user_message(
    needs_manual_review: bool,
    relevance_label: str,
    detail_confidence: float,
) -> str:
    if not needs_manual_review:
        return "Mesaj analiz edildi."

    if detail_confidence < 0.45:
        return (
            "Mesaj düşük güvenle analiz edildi. "
            "Göndermeden önce mesajınızı kontrol etmeniz önerilir."
        )

    if relevance_label == UNCERTAIN_LABEL:
        return (
            "Mesaj kısa veya bağlamı sınırlı görünüyor. "
            "Göndermeden önce mesajınızı kontrol etmeniz önerilir."
        )

    return "Göndermeden önce mesajınızı kontrol etmeniz önerilir."


def build_category_suggestion_message(suggested_category_name: str) -> str:
    return f"Bu mesaj {suggested_category_name} kategorisine daha uygun görünüyor."


UNCERTAIN_RELEVANCE_DETAIL_ACCEPT_THRESHOLD = 0.60


@router.post("/feedbacks/analyze", response_model=FeedbackAnalyzeResponse)
def analyze_feedback(
    payload: FeedbackAnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    clean_message = validate_feedback_message_content(payload.message)

    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only users with an employee profile can send feedback",
        )

    category = (
        db.query(FeedbackCategory)
        .filter(
            FeedbackCategory.id == payload.category_id,
            FeedbackCategory.is_active.is_(True),
        )
        .first()
    )
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active feedback category not found",
        )

    relevance_result = analyze_feedback_relevance(clean_message)

    if relevance_result.label == NOT_FEEDBACK_LABEL:
        return FeedbackAnalyzeResponse(
            action="WARN_OR_REJECT",
            clean_message=clean_message,
            selected_category_id=category.id,
            selected_category_name=category.name,
            suggested_category_name=None,
            suggested_category_confidence=None,
            category_mismatch=False,
            relevance_label=relevance_result.label,
            relevance_confidence=relevance_result.confidence,
            relevance_reason=relevance_result.reason,
            needs_manual_review=False,
            suggested_detail=None,
            detail_confidence=None,
            message_priority_score=None,
            user_message="Bu mesaj kurumsal geri bildirim gibi görünmüyor.",
        )

    category_prediction = predict_feedback_category(clean_message)
    should_suggest_category = should_suggest_category_change(
        selected_category_name=category.name,
        predicted_category_name=category_prediction.category_name,
        prediction_confidence=category_prediction.confidence,
    )

    if should_suggest_category:
        return FeedbackAnalyzeResponse(
            action="SUGGEST_CATEGORY_CHANGE",
            clean_message=clean_message,
            selected_category_id=category.id,
            selected_category_name=category.name,
            suggested_category_name=category_prediction.category_name,
            suggested_category_confidence=category_prediction.confidence,
            category_mismatch=True,
            relevance_label=relevance_result.label,
            relevance_confidence=relevance_result.confidence,
            relevance_reason=relevance_result.reason,
            needs_manual_review=True,
            suggested_detail=None,
            detail_confidence=None,
            message_priority_score=None,
            user_message=build_category_suggestion_message(
                category_prediction.category_name
            ),
        )

    analysis_result = analyze_feedback_message(
        message=clean_message,
        category_name=category.name,
    )
    needs_manual_review = (
        analysis_result.prediction_confidence < 0.45
        or (
            relevance_result.label == UNCERTAIN_LABEL
            and analysis_result.prediction_confidence
            < UNCERTAIN_RELEVANCE_DETAIL_ACCEPT_THRESHOLD
        )
    )
    action = "ACCEPT_WITH_MANUAL_REVIEW" if needs_manual_review else "ACCEPT"

    return FeedbackAnalyzeResponse(
        action=action,
        clean_message=clean_message,
        selected_category_id=category.id,
        selected_category_name=category.name,
        suggested_category_name=None,
        suggested_category_confidence=None,
        category_mismatch=False,
        relevance_label=relevance_result.label,
        relevance_confidence=relevance_result.confidence,
        relevance_reason=relevance_result.reason,
        needs_manual_review=needs_manual_review,
        suggested_detail=analysis_result.nlp_detail,
        detail_confidence=round(analysis_result.prediction_confidence, 2),
        message_priority_score=analysis_result.message_priority_score,
        user_message=build_feedback_analysis_user_message(
            needs_manual_review=needs_manual_review,
            relevance_label=relevance_result.label,
            detail_confidence=analysis_result.prediction_confidence,
        ),
    )


@router.post(
    "/admin/feedback-categories",
    response_model=FeedbackCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_feedback_category(
    payload: FeedbackCategoryCreate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    existing_category = (
        db.query(FeedbackCategory)
        .filter(FeedbackCategory.name == payload.name)
        .first()
    )
    if existing_category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback category already exists",
        )

    category = FeedbackCategory(
        name=payload.name,
        description=payload.description,
        is_active=True,
    )
    db.add(category)
    db.commit()
    db.refresh(category)

    return category


@router.get("/feedback-categories", response_model=List[FeedbackCategoryResponse])
def list_active_feedback_categories(db: Session = Depends(get_db)):
    return (
        db.query(FeedbackCategory)
        .filter(FeedbackCategory.is_active.is_(True))
        .order_by(FeedbackCategory.name)
        .all()
    )


@router.get(
    "/admin/feedback-categories",
    response_model=List[FeedbackCategoryResponse],
)
def list_all_feedback_categories(
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    return (
        db.query(FeedbackCategory)
        .order_by(FeedbackCategory.name)
        .all()
    )


@router.patch(
    "/admin/feedback-categories/{category_id}",
    response_model=FeedbackCategoryResponse,
)
def update_feedback_category(
    category_id: int,
    payload: FeedbackCategoryUpdate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    category = (
        db.query(FeedbackCategory)
        .filter(FeedbackCategory.id == category_id)
        .first()
    )
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback category not found",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data:
        existing_category = (
            db.query(FeedbackCategory)
            .filter(
                FeedbackCategory.name == update_data["name"],
                FeedbackCategory.id != category.id,
            )
            .first()
        )
        if existing_category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Feedback category already exists",
            )

    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)

    return category


@router.post(
    "/feedbacks",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    clean_message = validate_feedback_message_content(payload.message)

    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only users with an employee profile can send feedback",
        )

    category = (
        db.query(FeedbackCategory)
        .filter(
            FeedbackCategory.id == payload.category_id,
            FeedbackCategory.is_active.is_(True),
        )
        .first()
    )
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active feedback category not found",
        )

    relevance_result = analyze_feedback_relevance(clean_message)
    if relevance_result.label == NOT_FEEDBACK_LABEL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu mesaj kurumsal geri bildirim gibi görünmüyor.",
        )

    sender_score = calculate_sender_priority_score(current_user.employee.position)
    analysis_result = analyze_feedback_message(
        message=clean_message,
        category_name=category.name,
    )

    feedback = Feedback(
        employee_id=current_user.employee.id,
        category_id=payload.category_id,
        message=clean_message,
        is_anonymous=payload.is_anonymous,
        category_source="NLP",
        prediction_confidence=round(analysis_result.prediction_confidence, 2),
        nlp_detail=analysis_result.nlp_detail,
        sender_priority_score=sender_score,
        message_priority_score=analysis_result.message_priority_score,
        total_priority_score=calculate_total_priority_score(
            sender_priority_score=sender_score,
            message_priority_score=analysis_result.message_priority_score,
        ),
        status="NEW",
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return build_feedback_response(feedback, show_sender=True)


@router.get("/feedbacks/mine", response_model=List[FeedbackResponse])
def list_my_feedbacks(
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only users with an employee profile can view feedback",
        )

    query = db.query(Feedback).filter(
        Feedback.employee_id == current_user.employee.id,
        Feedback.status != "CANCELLED",
        Feedback.is_deleted_by_user.is_(False),
    )

    if date_from:
        query = query.filter(Feedback.created_at >= date_from)

    if date_to:
        query = query.filter(Feedback.created_at <= date_to)

    feedbacks = query.order_by(Feedback.created_at.desc()).offset(offset).limit(limit).all()

    return [build_feedback_response(feedback, show_sender=True) for feedback in feedbacks]


@router.patch("/feedbacks/{feedback_id}/cancel", response_model=FeedbackResponse)
def cancel_my_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only users with an employee profile can cancel feedback",
        )

    feedback = (
        db.query(Feedback)
        .filter(
            Feedback.id == feedback_id,
            Feedback.employee_id == current_user.employee.id,
        )
        .first()
    )
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found",
        )

    if feedback.status != "NEW":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only new feedback can be cancelled",
        )

    feedback.status = "CANCELLED"
    db.commit()
    db.refresh(feedback)

    return build_feedback_response(feedback, show_sender=True)


@router.patch("/feedbacks/{feedback_id}/anonymity", response_model=FeedbackResponse)
def toggle_my_feedback_anonymity(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only employees can edit feedback anonymity",
        )

    feedback = (
        db.query(Feedback)
        .filter(
            Feedback.id == feedback_id,
            Feedback.employee_id == current_user.employee.id,
            Feedback.is_deleted_by_user.is_(False),
        )
        .first()
    )
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found",
        )

    if feedback.status != "NEW":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only new feedback anonymity can be edited",
        )

    feedback.is_anonymous = not feedback.is_anonymous
    db.commit()
    db.refresh(feedback)

    return build_feedback_response(feedback, show_sender=True)


@router.delete("/feedbacks/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only users with an employee profile can delete feedback",
        )

    feedback = (
        db.query(Feedback)
        .filter(
            Feedback.id == feedback_id,
            Feedback.employee_id == current_user.employee.id,
        )
        .first()
    )
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found",
        )

    feedback.is_deleted_by_user = True
    db.commit()
    return


@router.get("/admin/feedbacks", response_model=List[FeedbackResponse])
def list_feedbacks_for_admin(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    category_id: Optional[int] = Query(default=None),
    is_anonymous: Optional[bool] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    query = db.query(Feedback).join(FeedbackCategory).outerjoin(Employee)

    if status_filter:
        query = query.filter(Feedback.status == status_filter)

    if category_id is not None:
        query = query.filter(Feedback.category_id == category_id)

    if is_anonymous is not None:
        query = query.filter(Feedback.is_anonymous == is_anonymous)

    if date_from:
        query = query.filter(Feedback.created_at >= date_from)

    if date_to:
        query = query.filter(Feedback.created_at <= date_to)

    feedbacks = (
        query.order_by(Feedback.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        build_feedback_response(feedback, show_sender=not feedback.is_anonymous)
        for feedback in feedbacks
    ]


@router.patch("/admin/feedbacks/{feedback_id}", response_model=FeedbackResponse)
def update_feedback_for_admin(
    feedback_id: int,
    payload: FeedbackAdminUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "status" in update_data:
        allowed_statuses = {"NEW", "IN_REVIEW", "RESOLVED", "CANCELLED"}
        if update_data["status"] not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid feedback status",
            )
        feedback.status = update_data["status"]

    if "admin_note" in update_data:
        feedback.admin_note = update_data["admin_note"]

    feedback.reviewed_by = current_admin.id
    feedback.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(feedback)

    return build_feedback_response(feedback, show_sender=not feedback.is_anonymous)
