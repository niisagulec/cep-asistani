from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin
from app.routers import attendance
from app.routers import auth
from app.routers import feedback
from app.routers import menu
from app.routers import shuttle

app = FastAPI(title="Cep Asistanı API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(attendance.router)
app.include_router(auth.router)
app.include_router(feedback.router)
app.include_router(menu.router)
app.include_router(shuttle.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
