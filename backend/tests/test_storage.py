"""The S3 wrapper, with a fake boto3 client: no real storage involved."""

from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError

from app.core.config import settings
from app.services import storage


def client_error(code: str, operation: str = "Op") -> ClientError:
    return ClientError({"Error": {"Code": code}}, operation)


@pytest.fixture
def s3(monkeypatch) -> MagicMock:
    """A configured bucket, and a mock in place of the boto3 client."""
    monkeypatch.setattr(settings, "S3_BUCKET", "test-bucket")
    monkeypatch.setattr(settings, "S3_CREATE_BUCKET", True)
    monkeypatch.setattr(settings, "S3_ENDPOINT_URL", "http://storage:9000")
    fake = MagicMock()
    monkeypatch.setattr(storage, "_client", lambda: fake)
    return fake


def test_is_configured_depends_on_the_bucket(monkeypatch):
    monkeypatch.setattr(settings, "S3_BUCKET", "")
    assert storage.is_configured() is False

    monkeypatch.setattr(settings, "S3_BUCKET", "bucket")
    assert storage.is_configured() is True


def test_client_without_a_bucket_raises(monkeypatch):
    monkeypatch.setattr(settings, "S3_BUCKET", "")
    storage._client.cache_clear()

    with pytest.raises(storage.StorageNotConfiguredError):
        storage._client()


def test_put_object(s3):
    storage.put_object("k", b"data", "image/webp")

    s3.put_object.assert_called_once_with(
        Bucket="test-bucket", Key="k", Body=b"data", ContentType="image/webp"
    )


def test_get_object(s3):
    body = MagicMock()
    body.iter_chunks.return_value = iter([b"ab", b"c"])
    s3.get_object.return_value = {
        "Body": body,
        "ContentType": "image/webp",
        "ContentLength": 3,
    }

    obj = storage.get_object("k")

    assert b"".join(obj.chunks) == b"abc"
    assert obj.content_type == "image/webp"
    assert obj.content_length == 3


def test_get_object_without_content_type(s3):
    s3.get_object.return_value = {"Body": MagicMock(), "ContentLength": 0}

    assert storage.get_object("k").content_type == "application/octet-stream"


@pytest.mark.parametrize("code", ["NoSuchKey", "404"])
def test_get_missing_object(s3, code):
    s3.get_object.side_effect = client_error(code, "GetObject")

    with pytest.raises(storage.ObjectNotFoundError):
        storage.get_object("k")


def test_get_object_passes_other_errors_through(s3):
    s3.get_object.side_effect = client_error("AccessDenied", "GetObject")

    with pytest.raises(ClientError):
        storage.get_object("k")


def test_delete_object(s3):
    storage.delete_object("k")

    s3.delete_object.assert_called_once_with(Bucket="test-bucket", Key="k")


# --- ensure_bucket (runs on startup) ---


def test_ensure_bucket_does_nothing_unless_enabled(s3, monkeypatch):
    monkeypatch.setattr(settings, "S3_CREATE_BUCKET", False)

    storage.ensure_bucket()

    s3.head_bucket.assert_not_called()
    s3.create_bucket.assert_not_called()


def test_ensure_bucket_does_nothing_without_a_bucket(s3, monkeypatch):
    monkeypatch.setattr(settings, "S3_BUCKET", "")

    storage.ensure_bucket()

    s3.head_bucket.assert_not_called()


def test_ensure_bucket_keeps_an_existing_bucket(s3):
    storage.ensure_bucket()

    s3.head_bucket.assert_called_once_with(Bucket="test-bucket")
    s3.create_bucket.assert_not_called()


@pytest.mark.parametrize("code", ["404", "NoSuchBucket", "NotFound"])
def test_ensure_bucket_creates_a_missing_bucket(s3, code):
    s3.head_bucket.side_effect = client_error(code, "HeadBucket")

    storage.ensure_bucket()

    s3.create_bucket.assert_called_once_with(Bucket="test-bucket")


def test_ensure_bucket_on_aws_outside_us_east_1_sets_the_region(s3, monkeypatch):
    monkeypatch.setattr(settings, "S3_ENDPOINT_URL", None)
    monkeypatch.setattr(settings, "S3_REGION", "sa-east-1")
    s3.head_bucket.side_effect = client_error("404", "HeadBucket")

    storage.ensure_bucket()

    s3.create_bucket.assert_called_once_with(
        Bucket="test-bucket",
        CreateBucketConfiguration={"LocationConstraint": "sa-east-1"},
    )


@pytest.mark.parametrize(
    "error",
    [
        client_error("AccessDenied", "HeadBucket"),
        EndpointConnectionError(endpoint_url="http://x"),
    ],
)
def test_ensure_bucket_never_crashes_startup(s3, error, caplog):
    s3.head_bucket.side_effect = error

    storage.ensure_bucket()  # no exception

    s3.create_bucket.assert_not_called()
    assert "bucket" in caplog.text.lower()
