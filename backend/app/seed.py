import os

from app.auth import hash_password
from app.database import SessionLocal
from app.models import User


DEFAULT_ADMIN_EMAIL = "admin@cepasistani.com"
DEFAULT_ADMIN_PASSWORD = "Admin123!"


def seed_admin():
    admin_email = os.getenv("FIRST_ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL)
    admin_password = os.getenv("FIRST_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)

    db = SessionLocal()
    try:
        existing_admin = db.query(User).filter(User.email == admin_email).first()
        if existing_admin:
            print(f"Admin user already exists: {admin_email}")
            return

        admin_user = User(
            email=admin_email,
            password_hash=hash_password(admin_password),
            role="ADMIN",
            is_active=True,
            must_change_password=True,
        )
        db.add(admin_user)
        db.commit()
        print(f"Admin user created: {admin_email}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
