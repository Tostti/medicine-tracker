import logging

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError

from app.services import image as image_service
from app.services import storage
from tests.utils import image_bytes, open_image

OTHER_KEY = "medications/" + "b" * 32 + ".webp"


def upload(client, data: bytes, url: str = "/images/", method: str = "post"):
    return client.request(
        method, url, files={"file": ("photo.jpg", data, "image/jpeg")}
    )


# --- POST /images/ ---


def test_upload_stores_a_webp_and_returns_its_key(client, fake_storage):
    response = upload(client, image_bytes(fmt="JPEG"))

    assert response.status_code == 201
    key = response.json()["key"]
    assert image_service.is_image_key(key)
    data, content_type = fake_storage[key]
    assert content_type == "image/webp"
    assert open_image(data).format == "WEBP"


def test_upload_rejects_a_file_that_is_not_an_image(client, fake_storage):
    response = upload(client, b"%PDF-1.7 definitely not a picture")

    assert response.status_code == 422
    assert response.json() == {"detail": "File is not a supported image"}
    assert fake_storage == {}


def test_upload_rejects_files_over_the_limit(client, fake_storage, monkeypatch):
    monkeypatch.setattr(image_service, "MAX_UPLOAD_BYTES", 2 * 2**20)

    response = upload(client, b"x" * (2 * 2**20 + 1))

    assert response.status_code == 413
    assert response.json() == {"detail": "Image larger than 2 MB"}
    assert fake_storage == {}


def test_upload_without_storage_configured_is_503(client):
    # No `fake_storage`: S3_BUCKET is empty in tests.
    response = upload(client, image_bytes())

    assert response.status_code == 503
    assert response.json() == {"detail": "Image storage is not configured"}


@pytest.mark.parametrize(
    "error",
    [
        EndpointConnectionError(endpoint_url="http://storage:9000"),
        ClientError({"Error": {"Code": "AccessDenied"}}, "PutObject"),
    ],
)
def test_upload_when_storage_fails_is_502(client, fake_storage, monkeypatch, error):
    def broken_put(*args, **kwargs):
        raise error

    monkeypatch.setattr(storage, "put_object", broken_put)

    response = upload(client, image_bytes())

    assert response.status_code == 502
    assert response.json() == {"detail": "Image storage error"}


# --- GET /images/{key} ---


def test_get_image(client, fake_storage):
    key = upload(client, image_bytes()).json()["key"]

    response = client.get(f"/images/{key}")

    assert response.status_code == 200
    assert response.content == fake_storage[key][0]
    assert response.headers["content-type"] == "image/webp"
    assert response.headers["content-length"] == str(len(response.content))
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_get_missing_image_is_404(client, fake_storage):
    response = client.get(f"/images/{OTHER_KEY}")

    assert response.status_code == 404


@pytest.mark.parametrize(
    "key", ["secret.txt", "medications/abc.webp", "other/" + "a" * 32 + ".webp"]
)
def test_get_image_only_serves_our_own_keys(client, fake_storage, monkeypatch, key):
    # Anything else in the bucket must not be reachable, so storage isn't even asked.
    def must_not_be_called(_key):
        raise AssertionError("storage was called")

    monkeypatch.setattr(storage, "get_object", must_not_be_called)

    assert client.get(f"/images/{key}").status_code == 404


# --- PUT /medications/{id}/picture ---


def test_set_picture(client, create_medication, fake_storage):
    med = create_medication()

    response = upload(client, image_bytes(), f"/medications/{med['id']}/picture", "put")

    assert response.status_code == 200
    key = response.json()["picture_uri"]
    assert image_service.is_image_key(key)
    assert key in fake_storage
    assert client.get(f"/medications/{med['id']}").json()["picture_uri"] == key


def test_set_picture_deletes_the_previous_upload(
    client, create_medication, fake_storage
):
    old_key = upload(client, image_bytes()).json()["key"]
    med = create_medication(picture_uri=old_key)

    new_key = upload(
        client, image_bytes(), f"/medications/{med['id']}/picture", "put"
    ).json()["picture_uri"]

    assert new_key != old_key
    assert list(fake_storage) == [new_key]


def test_set_picture_leaves_external_urls_alone(
    client, create_medication, fake_storage, monkeypatch
):
    med = create_medication(picture_uri="https://example.com/box.jpg")
    deleted = []
    monkeypatch.setattr(storage, "delete_object", deleted.append)

    response = upload(client, image_bytes(), f"/medications/{med['id']}/picture", "put")

    assert response.status_code == 200
    assert deleted == []


def test_set_picture_survives_failing_to_delete_the_old_one(
    client, create_medication, fake_storage, monkeypatch, caplog
):
    old_key = upload(client, image_bytes()).json()["key"]
    med = create_medication(picture_uri=old_key)

    def broken_delete(_key):
        raise EndpointConnectionError(endpoint_url="http://storage:9000")

    monkeypatch.setattr(storage, "delete_object", broken_delete)

    with caplog.at_level(logging.WARNING):
        response = upload(
            client, image_bytes(), f"/medications/{med['id']}/picture", "put"
        )

    assert response.status_code == 200
    assert response.json()["picture_uri"] != old_key
    assert f"Couldn't delete old picture {old_key}" in caplog.text


def test_set_picture_with_a_bad_file_keeps_the_old_picture(
    client, create_medication, fake_storage
):
    med = create_medication(picture_uri="https://example.com/box.jpg")

    response = upload(
        client, b"not an image", f"/medications/{med['id']}/picture", "put"
    )

    assert response.status_code == 422
    assert (
        client.get(f"/medications/{med['id']}").json()["picture_uri"]
        == med["picture_uri"]
    )


def test_set_picture_of_missing_medication_is_404(client, fake_storage):
    response = upload(client, image_bytes(), "/medications/999999/picture", "put")

    assert response.status_code == 404
    assert fake_storage == {}
