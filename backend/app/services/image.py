"""Turn an uploaded photo into a small WebP and store it."""

import re
import uuid
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.services import storage

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # phone photos are 3-8 MB
MAX_SIDE = 1200  # px; plenty for a list thumbnail and a detail page
WEBP_QUALITY = 80

# Keys we generate. Anything else in picture_uri must be an external http(s) URL.
IMAGE_KEY_RE = re.compile(r"^medications/[0-9a-f]{32}\.webp$")


class InvalidImageError(ValueError):
    pass


def is_image_key(value: str) -> bool:
    return bool(IMAGE_KEY_RE.match(value))


def to_webp(data: bytes) -> bytes:
    try:
        with Image.open(BytesIO(data)) as img:
            # Phones store rotation as EXIF metadata; apply it before stripping metadata.
            img = ImageOps.exif_transpose(img)
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            has_alpha = img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info
            img = img.convert("RGBA" if has_alpha else "RGB")

            out = BytesIO()
            img.save(out, "WEBP", quality=WEBP_QUALITY)
            return out.getvalue()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as e:
        raise InvalidImageError("File is not a supported image") from e


def store_image(data: bytes) -> str:
    """Convert and upload; returns the object key to save in picture_uri."""
    # Check first, so a missing config isn't reported as a bad image.
    if not storage.is_configured():
        raise storage.StorageNotConfiguredError("S3_BUCKET is not set")
    webp = to_webp(data)
    key = f"medications/{uuid.uuid4().hex}.webp"
    storage.put_object(key, webp, "image/webp")
    return key
