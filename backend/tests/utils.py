from io import BytesIO

from PIL import Image


def image_bytes(
    size: tuple[int, int] = (10, 10),
    mode: str = "RGB",
    fmt: str = "PNG",
    exif_orientation: int | None = None,
) -> bytes:
    """A small generated image, as a phone or a browser would upload it."""
    color = (255, 0, 0, 128) if "A" in mode else (255, 0, 0)
    img = Image.new(mode, size, color[: len(mode)])
    out = BytesIO()
    if exif_orientation is None:
        img.save(out, fmt)
    else:
        exif = Image.Exif()
        exif[0x0112] = exif_orientation  # Orientation tag
        img.save(out, fmt, exif=exif)
    return out.getvalue()


def open_image(data: bytes) -> Image.Image:
    img = Image.open(BytesIO(data))
    img.load()
    return img
