from collections.abc import Iterator
from contextlib import contextmanager

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.services import image as image_service
from app.services import storage

router = APIRouter(
    prefix="/images",
    tags=["images"],
)


@contextmanager
def storage_errors() -> Iterator[None]:
    """Map storage/image failures to HTTP errors. Shared with other routers."""
    try:
        yield
    except storage.StorageNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured",
        )
    except image_service.InvalidImageError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(e)
        )
    except (BotoCoreError, ClientError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Image storage error"
        )


def read_upload(file: UploadFile) -> bytes:
    # Read one byte past the limit to detect oversized files without loading them all.
    data = file.file.read(image_service.MAX_UPLOAD_BYTES + 1)
    if len(data) > image_service.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Image larger than {image_service.MAX_UPLOAD_BYTES // 2**20} MB",
        )
    return data


# Plain `def` (not async): Pillow and boto3 block, so FastAPI runs these in a thread pool.
@router.post("/", status_code=status.HTTP_201_CREATED)
def upload_image(file: UploadFile) -> dict[str, str]:
    """Store an image and return its key, to send as picture_uri when creating a medication."""
    data = read_upload(file)
    with storage_errors():
        key = image_service.store_image(data)
    return {"key": key}


@router.get("/{key:path}")
def get_image(key: str) -> StreamingResponse:
    if not image_service.is_image_key(key):
        raise HTTPException(status_code=404, detail="Image not found")
    with storage_errors():
        try:
            obj = storage.get_object(key)
        except storage.ObjectNotFoundError:
            raise HTTPException(status_code=404, detail="Image not found")
    return StreamingResponse(
        obj.chunks,
        media_type=obj.content_type,
        headers={
            "Content-Length": str(obj.content_length),
            # Keys are random and never reused, so browsers can cache forever.
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )
