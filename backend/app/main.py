from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import dashboard, patients, interactions, portal, medicines

app = FastAPI(title="MedTrack API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router,     prefix="/api/dashboard",  tags=["Dashboard"])
app.include_router(patients.router,      prefix="/api/patients",   tags=["Patients"])
app.include_router(interactions.router,  prefix="/api",            tags=["Interactions"])
app.include_router(portal.router,        prefix="/api/portal",     tags=["Patient Portal"])
app.include_router(medicines.router,     prefix="/api",            tags=["Medicines"])

@app.get("/")
def root():
    return {"status": "MedTrack API running"}
