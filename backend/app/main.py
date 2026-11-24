from contextlib import asynccontextmanager

from fastapi import FastAPI
from app.api import medications, drugs, existences, images
from app.services import storage


@asynccontextmanager
async def lifespan(_: FastAPI):
    storage.ensure_bucket()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI + PostgreSQL CRUD API"}


app.include_router(medications.router)
app.include_router(drugs.router)
app.include_router(existences.router)
app.include_router(images.router)
