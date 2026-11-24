"""The image conversion on its own: no database or HTTP involved."""

import pytest
from PIL import Image

from app.services import image as image_service
from app.services import storage
from tests.utils import image_bytes, open_image


def test_to_webp_converts_the_format():
    out = open_image(image_service.to_webp(image_bytes(fmt="JPEG")))

    assert out.format == "WEBP"
    assert out.mode == "RGB"


def test_to_webp_shrinks_large_photos_keeping_the_aspect_ratio():
    out = open_image(image_service.to_webp(image_bytes(size=(4000, 3000), fmt="JPEG")))

    assert out.size == (image_service.MAX_SIDE, 900)


def test_to_webp_never_enlarges_small_images():
    out = open_image(image_service.to_webp(image_bytes(size=(50, 20))))

    assert out.size == (50, 20)


def test_to_webp_keeps_transparency():
    out = open_image(image_service.to_webp(image_bytes(mode="RGBA")))

    assert out.mode == "RGBA"


def test_to_webp_applies_the_exif_rotation():
    # A landscape sensor image that the phone marked as "rotate 90°" (orientation 6).
    rotated = image_bytes(size=(40, 20), fmt="JPEG", exif_orientation=6)

    out = open_image(image_service.to_webp(rotated))

    assert out.size == (20, 40)
    assert not out.getexif()  # metadata (location, camera...) is not kept


@pytest.mark.parametrize("data", [b"", b"plain text", image_bytes()[:20]])
def test_to_webp_rejects_what_is_not_a_valid_image(data):
    with pytest.raises(image_service.InvalidImageError):
        image_service.to_webp(data)


def test_to_webp_rejects_decompression_bombs(monkeypatch):
    # Tiny file that would expand to a huge bitmap: Pillow refuses it past twice this limit.
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 100)

    with pytest.raises(image_service.InvalidImageError):
        image_service.to_webp(image_bytes(size=(100, 100)))


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("medications/" + "0123456789abcdef" * 2 + ".webp", True),
        ("medications/" + "A" * 32 + ".webp", False),  # uuid4().hex is lower case
        ("medications/" + "a" * 31 + ".webp", False),
        ("medications/" + "a" * 32 + ".png", False),
        ("other/" + "a" * 32 + ".webp", False),
        ("x/medications/" + "a" * 32 + ".webp", False),
        ("medications/" + "a" * 32 + ".webp/../x", False),
        ("https://example.com/a.webp", False),
    ],
)
def test_is_image_key(value, expected):
    assert image_service.is_image_key(value) is expected


def test_store_image_without_storage_configured_fails_before_converting(monkeypatch):
    def must_not_be_called(_data):
        raise AssertionError("converted anyway")

    monkeypatch.setattr(image_service, "to_webp", must_not_be_called)

    # Even with garbage, the error is about the configuration, not the image.
    with pytest.raises(storage.StorageNotConfiguredError):
        image_service.store_image(b"garbage")


def test_store_image_uploads_under_a_new_key_each_time(fake_storage):
    first = image_service.store_image(image_bytes())
    second = image_service.store_image(image_bytes())

    assert first != second
    assert set(fake_storage) == {first, second}
