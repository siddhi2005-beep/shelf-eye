from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.planogram_agent import router as planogram_router
from backend.routes.api import router as api_router
from backend.services.storage import store


app = FastAPI(
    title="Walmart Shelf-Eye",
    description="Autonomous Vision-AI store monitoring agent for shelf availability, layout drift, and restock automation.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
app.include_router(planogram_router, prefix="/api")


@app.on_event("startup")
def seed_demo_data() -> None:
    store.seed()


@app.get("/health", tags=["System"])
def health() -> dict:
    return {
        "status": "healthy",
        "service": "Walmart Shelf-Eye",
        "version": app.version,
    }


app.mount("/", StaticFiles(directory="backend/static", html=True), name="dashboard")
