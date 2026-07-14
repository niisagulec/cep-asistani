from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth import require_admin, require_password_changed
from app.database import get_db
from app.models import ShuttleRoute, ShuttleStop, User
from app.schemas import (
    MessageResponse,
    ShuttleRouteCreate,
    ShuttleRouteResponse,
    ShuttleRouteUpdate,
    ShuttleStopCreate,
    ShuttleStopResponse,
    ShuttleStopUpdate,
)


router = APIRouter(tags=["shuttles"])


def build_shuttle_stop_response(stop: ShuttleStop) -> ShuttleStopResponse:
    return ShuttleStopResponse(
        id=stop.id,
        route_id=stop.route_id,
        name=stop.name,
        morning_order=stop.morning_order,
        morning_time=stop.morning_time,
    )


def build_shuttle_route_response(route: ShuttleRoute) -> ShuttleRouteResponse:
    sorted_stops = sorted(
        route.stops,
        key=lambda stop: (stop.morning_order, stop.id),
    )

    return ShuttleRouteResponse(
        id=route.id,
        name=route.name,
        evening_departure_time=route.evening_departure_time,
        driver_name=route.driver_name,
        driver_phone=route.driver_phone,
        is_active=route.is_active,
        created_at=route.created_at,
        stops=[build_shuttle_stop_response(stop) for stop in sorted_stops],
    )


def validate_unique_stop_orders(stops: List[ShuttleStopCreate]) -> None:
    stop_orders = [stop.morning_order for stop in stops]
    if len(stop_orders) != len(set(stop_orders)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stop orders must be unique for the route",
        )


def get_route_or_404(route_id: int, db: Session) -> ShuttleRoute:
    route = (
        db.query(ShuttleRoute)
        .options(joinedload(ShuttleRoute.stops))
        .filter(ShuttleRoute.id == route_id)
        .first()
    )

    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shuttle route not found",
        )

    return route


def replace_route_stops(
    route: ShuttleRoute,
    stops: List[ShuttleStopCreate],
    db: Session,
) -> None:
    validate_unique_stop_orders(stops)

    for existing_stop in list(route.stops):
        db.delete(existing_stop)
    db.flush()

    for stop in stops:
        db.add(
            ShuttleStop(
                route_id=route.id,
                name=stop.name,
                morning_order=stop.morning_order,
                morning_time=stop.morning_time,
            )
        )


@router.get("/admin/shuttle-routes", response_model=List[ShuttleRouteResponse])
def list_shuttle_routes_for_admin(
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    routes = (
        db.query(ShuttleRoute)
        .options(joinedload(ShuttleRoute.stops))
        .order_by(ShuttleRoute.id.desc())
        .all()
    )

    return [build_shuttle_route_response(route) for route in routes]


@router.post(
    "/admin/shuttle-routes",
    response_model=ShuttleRouteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shuttle_route(
    payload: ShuttleRouteCreate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    validate_unique_stop_orders(payload.stops)

    route = ShuttleRoute(
        name=payload.name,
        evening_departure_time=payload.evening_departure_time,
        driver_name=payload.driver_name,
        driver_phone=payload.driver_phone,
        is_active=payload.is_active,
    )
    db.add(route)
    db.flush()

    for stop in payload.stops:
        db.add(
            ShuttleStop(
                route_id=route.id,
                name=stop.name,
                morning_order=stop.morning_order,
                morning_time=stop.morning_time,
            )
        )

    db.commit()

    return build_shuttle_route_response(get_route_or_404(route.id, db))


@router.patch("/admin/shuttle-routes/{route_id}", response_model=ShuttleRouteResponse)
def update_shuttle_route(
    route_id: int,
    payload: ShuttleRouteUpdate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    route = get_route_or_404(route_id, db)
    update_data = payload.model_dump(exclude_unset=True)
    stops = update_data.pop("stops", None)

    for field, value in update_data.items():
        setattr(route, field, value)

    if stops is not None:
        replace_route_stops(route, payload.stops or [], db)

    db.commit()

    return build_shuttle_route_response(get_route_or_404(route.id, db))


@router.delete("/admin/shuttle-routes/{route_id}", response_model=MessageResponse)
def delete_shuttle_route(
    route_id: int,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    route = get_route_or_404(route_id, db)

    for stop in list(route.stops):
        db.delete(stop)

    db.delete(route)
    db.commit()

    return MessageResponse(message="Shuttle route deleted successfully")


@router.post(
    "/admin/shuttle-routes/{route_id}/stops",
    response_model=ShuttleStopResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shuttle_stop(
    route_id: int,
    payload: ShuttleStopCreate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    get_route_or_404(route_id, db)

    existing_stop = (
        db.query(ShuttleStop)
        .filter(
            ShuttleStop.route_id == route_id,
            ShuttleStop.morning_order == payload.morning_order,
        )
        .first()
    )
    if existing_stop:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stop order already exists for this route",
        )

    stop = ShuttleStop(
        route_id=route_id,
        name=payload.name,
        morning_order=payload.morning_order,
        morning_time=payload.morning_time,
    )
    db.add(stop)
    db.commit()
    db.refresh(stop)

    return build_shuttle_stop_response(stop)


@router.patch("/admin/shuttle-stops/{stop_id}", response_model=ShuttleStopResponse)
def update_shuttle_stop(
    stop_id: int,
    payload: ShuttleStopUpdate,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    stop = db.query(ShuttleStop).filter(ShuttleStop.id == stop_id).first()
    if not stop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shuttle stop not found",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "morning_order" in update_data:
        existing_stop = (
            db.query(ShuttleStop)
            .filter(
                ShuttleStop.route_id == stop.route_id,
                ShuttleStop.morning_order == update_data["morning_order"],
                ShuttleStop.id != stop.id,
            )
            .first()
        )
        if existing_stop:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stop order already exists for this route",
            )

    for field, value in update_data.items():
        setattr(stop, field, value)

    db.commit()
    db.refresh(stop)

    return build_shuttle_stop_response(stop)


@router.delete("/admin/shuttle-stops/{stop_id}", response_model=MessageResponse)
def delete_shuttle_stop(
    stop_id: int,
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    stop = db.query(ShuttleStop).filter(ShuttleStop.id == stop_id).first()
    if not stop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shuttle stop not found",
        )

    db.delete(stop)
    db.commit()

    return MessageResponse(message="Shuttle stop deleted successfully")


@router.get("/shuttle-routes", response_model=List[ShuttleRouteResponse])
def list_active_shuttle_routes(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_password_changed),
):
    routes = (
        db.query(ShuttleRoute)
        .options(joinedload(ShuttleRoute.stops))
        .filter(ShuttleRoute.is_active.is_(True))
        .order_by(ShuttleRoute.name.asc())
        .all()
    )

    return [build_shuttle_route_response(route) for route in routes]
