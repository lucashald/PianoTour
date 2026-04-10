"""
PianoTour Share Lambda — handles file sharing.

Actions:
  get_upload_url  — returns a presigned PUT URL + share code
  get_file        — takes a share code, returns a presigned GET URL
  download        — 302 redirect to presigned GET URL (triggers browser download)
  list_shares     — returns all shares (admin)
"""

import boto3
import json
import logging
import os
import secrets
import string
from datetime import datetime
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET = os.environ.get("BUCKET", "pianotour-share-bucket")
TABLE = os.environ.get("TABLE", "pianotour-shares")
REGION = os.environ.get("AWS_REGION", "us-east-1")

s3 = boto3.client("s3", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(TABLE)

HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

CODE_ALPHABET = string.ascii_lowercase + string.digits
CODE_LENGTH = 8
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

ALLOWED_CONTENT_TYPES = {
    "audio/wav":        ".wav",
    "audio/midi":       ".mid",
    "audio/x-midi":     ".mid",
    "application/json": ".json",
}

# Magic byte signatures for server-side fallback validation
WAV_MAGIC  = (b"RIFF", b"WAVE")  # bytes 0-3 and 8-11
MIDI_MAGIC = b"MThd"             # bytes 0-3


def _generate_code():
    return "PT-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def lambda_handler(event, context):
    # Handle OPTIONS preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {"statusCode": 200, "headers": HEADERS, "body": ""}

    params = event.get("queryStringParameters") or {}
    action = params.get("action")

    # ── Get presigned upload URL ──────────────────────────────────
    if action == "get_upload_url":
        name = params.get("name", "composition")
        content_type = params.get("content_type", "audio/wav")
        file_size = params.get("file_size", "0")
        duration = params.get("duration", "0")

        ext = ALLOWED_CONTENT_TYPES.get(content_type)
        if not ext:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"error": f"Unsupported content type: {content_type}"}),
            }

        share_code = _generate_code()
        file_type = ext.lstrip(".")  # "wav", "mid", "json"
        s3_key = f"exports/{share_code}{ext}"

        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": BUCKET,
                "Key": s3_key,
                "ContentType": content_type,
                "ContentLength": min(int(file_size), MAX_FILE_SIZE) if file_size and file_size != "0" else MAX_FILE_SIZE,
            },
            ExpiresIn=300,  # 5 minutes to upload
        )

        item = {
            "share_code": share_code,
            "s3_key": s3_key,
            "name": name,
            "content_type": content_type,
            "file_type": file_type,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        if file_size and file_size != "0":
            item["file_size"] = int(file_size)
        if duration and duration != "0":
            item["duration_seconds"] = Decimal(str(round(float(duration), 2)))

        table.put_item(Item=item)

        logger.info(f"Created share code {share_code} for {name} ({file_type})")

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({
                "share_code": share_code,
                "upload_url": upload_url,
            }),
        }

    # ── List all shares ─────────────────────────────────────────────
    if action == "list_shares":
        response = table.scan()
        items = response.get("Items", [])
        shares = []
        for item in items:
            shares.append({
                "share_code": item["share_code"],
                "name": item.get("name", "composition"),
                "file_type": item.get("file_type", "wav"),
                "created_at": item.get("created_at", ""),
                "duration_seconds": float(item["duration_seconds"]) if "duration_seconds" in item else None,
                "file_size": int(item["file_size"]) if "file_size" in item else None,
            })
        shares.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({"shares": shares}),
        }

    # ── Get file by share code ────────────────────────────────────
    if action in ("get_file", "get_audio"):  # get_audio kept for backwards compatibility
        share_code = params.get("code", "").strip()
        if not share_code:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"error": "code required"}),
            }

        response = table.get_item(Key={"share_code": share_code})
        item = response.get("Item")
        if not item:
            return {
                "statusCode": 404,
                "headers": HEADERS,
                "body": json.dumps({"error": "Share code not found"}),
            }

        s3_key = item["s3_key"]
        file_type = item.get("file_type", "wav")

        # Magic byte validation — runs regardless of validator lambda result
        try:
            if file_type == "wav":
                head = s3.get_object(Bucket=BUCKET, Key=s3_key, Range="bytes=0-11")
                header = head["Body"].read()
                if header[:4] != WAV_MAGIC[0] or header[8:12] != WAV_MAGIC[1]:
                    logger.warning(f"Invalid WAV for {share_code}: bad magic bytes")
                    s3.delete_object(Bucket=BUCKET, Key=s3_key)
                    table.delete_item(Key={"share_code": share_code})
                    return {
                        "statusCode": 400,
                        "headers": HEADERS,
                        "body": json.dumps({"error": "File is not a valid WAV"}),
                    }
            elif file_type == "mid":
                head = s3.get_object(Bucket=BUCKET, Key=s3_key, Range="bytes=0-3")
                header = head["Body"].read()
                if header[:4] != MIDI_MAGIC:
                    logger.warning(f"Invalid MIDI for {share_code}: bad magic bytes")
                    s3.delete_object(Bucket=BUCKET, Key=s3_key)
                    table.delete_item(Key={"share_code": share_code})
                    return {
                        "statusCode": 400,
                        "headers": HEADERS,
                        "body": json.dumps({"error": "File is not a valid MIDI"}),
                    }
            elif file_type == "json":
                head = s3.get_object(Bucket=BUCKET, Key=s3_key, Range="bytes=0-0")
                first_byte = head["Body"].read()
                if first_byte != b"{":
                    logger.warning(f"Invalid JSON for {share_code}: does not start with {{")
                    s3.delete_object(Bucket=BUCKET, Key=s3_key)
                    table.delete_item(Key={"share_code": share_code})
                    return {
                        "statusCode": 400,
                        "headers": HEADERS,
                        "body": json.dumps({"error": "File is not a valid JSON document"}),
                    }
        except s3.exceptions.NoSuchKey:
            # File was deleted (likely by validator lambda) — clean up orphan record
            table.delete_item(Key={"share_code": share_code})
            return {
                "statusCode": 404,
                "headers": HEADERS,
                "body": json.dumps({"error": "File not found in storage"}),
            }

        file_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": s3_key},
            ExpiresIn=3600,
        )

        result = {
            "name": item.get("name", "composition"),
            "file_type": file_type,
            "file_url": file_url,
            "created_at": item.get("created_at", ""),
        }
        if "file_size" in item:
            result["file_size"] = int(item["file_size"])
        if "duration_seconds" in item:
            result["duration_seconds"] = float(item["duration_seconds"])

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps(result),
        }

    # ── Download audio (302 redirect to presigned URL) ─────────
    if action == "download":
        share_code = params.get("code", "").strip()
        if not share_code:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"error": "code required"}),
            }

        response = table.get_item(Key={"share_code": share_code})
        item = response.get("Item")
        if not item:
            return {
                "statusCode": 404,
                "headers": HEADERS,
                "body": json.dumps({"error": "Share code not found"}),
            }

        s3_key = item["s3_key"]
        file_type = item.get("file_type", "wav")
        name = item.get("name", f"composition.{file_type}")

        audio_url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": BUCKET,
                "Key": s3_key,
                "ResponseContentDisposition": f'attachment; filename="{name}"',
            },
            ExpiresIn=3600,
        )

        return {
            "statusCode": 302,
            "headers": {
                **HEADERS,
                "Location": audio_url,
            },
            "body": "",
        }

    return {
        "statusCode": 400,
        "headers": HEADERS,
        "body": json.dumps({"error": f"Unknown action: {action}"}),
    }
