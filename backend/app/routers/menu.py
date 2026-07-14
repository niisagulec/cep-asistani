from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.auth import require_admin, require_password_changed
from app.database import get_db
from app.models import DailyMenu, MenuItem, MenuPlan, User
from app.schemas import (
    DailyMenuResponse,
    DailyMenuUpsert,
    MenuItemResponse,
    MenuPlanResponse,
)


router = APIRouter(tags=["menus"])

ALLOWED_MENU_ITEM_TYPES = {"SOUP", "MAIN", "SIDE", "MEZE", "DESSERT", "DRINK", "OTHER"}


def validate_menu_item_type(item_type: str) -> str:
    normalized_item_type = item_type.upper()

    if normalized_item_type not in ALLOWED_MENU_ITEM_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid menu item type",
        )

    return normalized_item_type


def get_week_range(target_date: date) -> tuple[date, date]:
    week_start = target_date - timedelta(days=target_date.weekday())
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def build_default_plan_title(target_date: date) -> str:
    week_start, week_end = get_week_range(target_date)
    return (
        f"{week_start.strftime('%d.%m.%Y')} - "
        f"{week_end.strftime('%d.%m.%Y')} Yemekhane Menüsü"
    )


def get_or_create_menu_plan_for_date(
    target_date: date,
    db: Session,
) -> MenuPlan:
    menu_plan = (
        db.query(MenuPlan)
        .filter(
            MenuPlan.start_date <= target_date,
            MenuPlan.end_date >= target_date,
        )
        .order_by(MenuPlan.start_date.desc())
        .first()
    )

    if menu_plan:
        return menu_plan

    week_start, week_end = get_week_range(target_date)
    menu_plan = MenuPlan(
        title=build_default_plan_title(target_date),
        start_date=week_start,
        end_date=week_end,
    )
    db.add(menu_plan)
    db.flush()

    return menu_plan


def build_menu_item_response(item: MenuItem) -> MenuItemResponse:
    return MenuItemResponse(
        id=item.id,
        daily_menu_id=item.daily_menu_id,
        name=item.name,
        item_type=item.item_type,
        display_order=item.display_order,
    )


def build_daily_menu_response(daily_menu: DailyMenu) -> DailyMenuResponse:
    sorted_items = sorted(
        daily_menu.items,
        key=lambda item: (item.display_order, item.id),
    )

    return DailyMenuResponse(
        id=daily_menu.id,
        menu_plan_id=daily_menu.menu_plan_id,
        menu_date=daily_menu.menu_date,
        total_calories=daily_menu.total_calories,
        note=daily_menu.note,
        items=[build_menu_item_response(item) for item in sorted_items],
    )


def build_menu_plan_response(menu_plan: MenuPlan) -> MenuPlanResponse:
    sorted_daily_menus = sorted(
        menu_plan.daily_menus,
        key=lambda daily_menu: daily_menu.menu_date,
    )

    return MenuPlanResponse(
        id=menu_plan.id,
        title=menu_plan.title,
        start_date=menu_plan.start_date,
        end_date=menu_plan.end_date,
        created_at=menu_plan.created_at,
        daily_menus=[
            build_daily_menu_response(daily_menu)
            for daily_menu in sorted_daily_menus
        ],
    )


def get_daily_menu_with_items(daily_menu_id: int, db: Session) -> DailyMenu:
    return (
        db.query(DailyMenu)
        .options(joinedload(DailyMenu.items))
        .filter(DailyMenu.id == daily_menu_id)
        .first()
    )


@router.post(
    "/admin/daily-menu",
    response_model=DailyMenuResponse,
    status_code=status.HTTP_201_CREATED,
)
def upsert_daily_menu_with_items(
    payload: DailyMenuUpsert,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    valid_items = [
        item
        for item in payload.items
        if item.name and item.name.strip()
    ]

    has_menu_info = bool(valid_items) or bool(payload.note) or payload.total_calories is not None

    if not has_menu_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Daily menu must include at least one item, note or calorie information",
        )

    daily_menu = (
        db.query(DailyMenu)
        .options(joinedload(DailyMenu.items))
        .filter(DailyMenu.menu_date == payload.menu_date)
        .first()
    )

    if daily_menu:
        daily_menu.note = payload.note
        daily_menu.total_calories = payload.total_calories
        for item in list(daily_menu.items):
            db.delete(item)
        db.flush()
    else:
        menu_plan = get_or_create_menu_plan_for_date(
            target_date=payload.menu_date,
            db=db,
        )
        daily_menu = DailyMenu(
            menu_plan_id=menu_plan.id,
            menu_date=payload.menu_date,
            total_calories=payload.total_calories,
            note=payload.note,
        )
        db.add(daily_menu)
        db.flush()

    for index, item in enumerate(valid_items, start=1):
        db.add(
            MenuItem(
                daily_menu_id=daily_menu.id,
                name=item.name.strip(),
                item_type=validate_menu_item_type(item.item_type),
                display_order=item.display_order or index,
            )
        )

    db.commit()

    return build_daily_menu_response(get_daily_menu_with_items(daily_menu.id, db))


@router.get("/admin/menu-plans", response_model=List[MenuPlanResponse])
def list_menu_plans_for_admin(
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    menu_plans = (
        db.query(MenuPlan)
        .options(joinedload(MenuPlan.daily_menus).joinedload(DailyMenu.items))
        .order_by(MenuPlan.start_date.desc())
        .all()
    )

    return [build_menu_plan_response(menu_plan) for menu_plan in menu_plans]


@router.get("/menus/today", response_model=Optional[DailyMenuResponse])
def get_today_menu(
    target_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_password_changed),
):
    selected_date = target_date or date.today()
    daily_menu = (
        db.query(DailyMenu)
        .options(joinedload(DailyMenu.items))
        .filter(DailyMenu.menu_date == selected_date)
        .first()
    )

    if not daily_menu:
        return None

    return build_daily_menu_response(daily_menu)


@router.get("/menus/week", response_model=List[DailyMenuResponse])
def get_weekly_menu(
    date_from: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_password_changed),
):
    start_date = date_from or date.today()
    end_date = start_date + timedelta(days=6)

    daily_menus = (
        db.query(DailyMenu)
        .options(joinedload(DailyMenu.items))
        .filter(
            DailyMenu.menu_date >= start_date,
            DailyMenu.menu_date <= end_date,
        )
        .order_by(DailyMenu.menu_date.asc())
        .all()
    )

    return [build_daily_menu_response(daily_menu) for daily_menu in daily_menus]


@router.get("/menus", response_model=List[DailyMenuResponse])
def list_menus_by_date_range(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_password_changed),
):
    if date_to < date_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be earlier than start date",
        )

    daily_menus = (
        db.query(DailyMenu)
        .options(joinedload(DailyMenu.items))
        .filter(
            DailyMenu.menu_date >= date_from,
            DailyMenu.menu_date <= date_to,
        )
        .order_by(DailyMenu.menu_date.asc())
        .all()
    )

    return [build_daily_menu_response(daily_menu) for daily_menu in daily_menus]
