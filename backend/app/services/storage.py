"""Thin wrapper around any S3-compatible store (RustFS, MinIO, AWS...)."""

import logging
from collections.abc import Iterator
from dataclasses import dataclass
from functools import lru_cache

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageNotConfiguredError(RuntimeError):
    pass


class ObjectNotFoundError(LookupError):
    pass


@dataclass
class StoredObject:
    chunks: Iterator[bytes]
    content_type: str
    content_length: int


def is_configured() -> bool:
    return bool(settings.S3_BUCKET)


@lru_cache
def _client():
    if not is_configured():
        raise StorageNotConfiguredError("S3_BUCKET is not set")

    endpoint = settings.S3_ENDPOINT_URL or None
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=settings.S3_REGION,
        # None lets boto3 fall back to IAM roles / ~/.aws on AWS.
        aws_access_key_id=settings.S3_ACCESS_KEY or None,
        aws_secret_access_key=settings.S3_SECRET_KEY or None,
        config=Config(
            signature_version="s3v4",
            # Self-hosted servers want http://host/bucket/key; AWS picks its own style.
            s3={"addressing_style": "path" if endpoint else "auto"},
        ),
    )


def put_object(key: str, data: bytes, content_type: str) -> None:
    _client().put_object(
        Bucket=settings.S3_BUCKET, Key=key, Body=data, ContentType=content_type
    )


def get_object(key: str) -> StoredObject:
    try:
        obj = _client().get_object(Bucket=settings.S3_BUCKET, Key=key)
    except ClientError as e:
        if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
            raise ObjectNotFoundError(key) from e
        raise
    return StoredObject(
        chunks=obj["Body"].iter_chunks(),
        content_type=obj.get("ContentType", "application/octet-stream"),
        content_length=obj["ContentLength"],
    )


def delete_object(key: str) -> None:
    _client().delete_object(Bucket=settings.S3_BUCKET, Key=key)


def ensure_bucket() -> None:
    """Create the bucket if S3_CREATE_BUCKET is on and it doesn't exist yet.

    Never crashes startup: if storage is down, the app still serves everything else.
    """
    if not (is_configured() and settings.S3_CREATE_BUCKET):
        return
    client = _client()
    try:
        client.head_bucket(Bucket=settings.S3_BUCKET)
        return
    except ClientError as e:
        if e.response["Error"]["Code"] not in ("404", "NoSuchBucket", "NotFound"):
            logger.warning("Can't check bucket %s: %s", settings.S3_BUCKET, e)
            return
    except BotoCoreError as e:
        logger.warning("Storage unreachable, skipping bucket check: %s", e)
        return

    kwargs = {}
    # AWS requires a location for every region except us-east-1.
    if not settings.S3_ENDPOINT_URL and settings.S3_REGION != "us-east-1":
        kwargs["CreateBucketConfiguration"] = {"LocationConstraint": settings.S3_REGION}
    client.create_bucket(Bucket=settings.S3_BUCKET, **kwargs)
    logger.info("Created bucket %s", settings.S3_BUCKET)
