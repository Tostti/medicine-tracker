from fastapi import FastAPI
from app.api import medications, drugs, existences

app = FastAPI()


@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI + PostgreSQL CRUD API"}


app.include_router(medications.router)
app.include_router(drugs.router)
app.include_router(existences.router)
