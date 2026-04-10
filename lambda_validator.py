"""
PianoTour Share Validator Lambda

Triggered by S3 ObjectCreated events on the exports/ prefix.
Validates uploaded files by type and deletes anything that fails.

Supported types:  .wav  .mid  .json
No external dependencies — safe to paste directly into the AWS console.

Local testing:
    python lambda_validator.py path/to/file.mid
    python lambda_validator.py path/to/file.wav
    python lambda_validator.py path/to/file.json
"""

import json
import logging
import os
import sys

TABLE = os.environ.get("TABLE", "pianotour-shares")
REGION = os.environ.get("AWS_REGION", "us-east-1")

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Required top-level keys for PianoTour JSON files
JSON_REQUIRED_KEYS = {"keySignature", "tempo", "timeSignature", "instrument", "midiChannel", "measures"}

# How many bytes to read for magic byte checks
MAGIC_BYTE_LENGTH = 12

# Max bytes to read for JSON validation (64 KB is plenty for the top-level structure)
JSON_READ_LIMIT = 64 * 1024


# ── Validators ────────────────────────────────────────────────────────────────

def validate_wav(header: bytes) -> tuple[bool, str]:
    if len(header) < 12:
        return False, "File too short to be a valid WAV"
    if header[:4] != b"RIFF":
        return False, f"Bad WAV header: expected RIFF, got {header[:4]}"
    if header[8:12] != b"WAVE":
        return False, f"Bad WAV header: expected WAVE at offset 8, got {header[8:12]}"
    return True, "OK"


def validate_mid(header: bytes) -> tuple[bool, str]:
    if len(header) < 4:
        return False, "File too short to be a valid MIDI"
    if header[:4] != b"MThd":
        return False, f"Bad MIDI header: expected MThd, got {header[:4]}"
    return True, "OK"


def validate_json(content: bytes) -> tuple[bool, str]:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        return False, "JSON file is not valid UTF-8"

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        return False, f"JSON parse error: {e}"

    if not isinstance(data, dict):
        return False, "JSON root must be an object"

    missing = JSON_REQUIRED_KEYS - data.keys()
    if missing:
        return False, f"JSON missing required keys: {missing}"

    if not isinstance(data["measures"], list):
        return False, "'measures' must be an array"

    return True, "OK"


def validate_file(ext: str, content: bytes) -> tuple[bool, str]:
    if ext == ".wav":
        return validate_wav(content)
    if ext == ".mid":
        return validate_mid(content)
    if ext == ".json":
        return validate_json(content)
    return False, f"Unsupported file type: '{ext}'"


# ── Lambda handler ────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    import boto3
    s3 = boto3.client("s3")
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table(TABLE)

    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = record["s3"]["object"]["key"]
        ext = os.path.splitext(key)[1].lower()

        logger.info("Validating s3://%s/%s (type: %s)", bucket, key, ext)

        # Read only what we need
        read_length = JSON_READ_LIMIT if ext == ".json" else MAGIC_BYTE_LENGTH
        try:
            resp = s3.get_object(Bucket=bucket, Key=key, Range=f"bytes=0-{read_length - 1}")
            content = resp["Body"].read()
        except s3.exceptions.NoSuchKey:
            logger.warning("Object already gone: %s", key)
            continue

        valid, reason = validate_file(ext, content)

        # Parse share code from key: "exports/PT-xxxxxxxx.ext" → "PT-xxxxxxxx"
        share_code = os.path.splitext(os.path.basename(key))[0]

        if valid:
            logger.info("PASS: %s", key)
            table.update_item(
                Key={"share_code": share_code},
                UpdateExpression="SET validated = :v",
                ExpressionAttributeValues={":v": True},
            )
        else:
            logger.warning("FAIL: %s — %s. Deleting.", key, reason)
            s3.delete_object(Bucket=bucket, Key=key)


# ── Local testing ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python lambda_validator.py <path/to/file>")
        sys.exit(1)

    path = sys.argv[1]
    ext = os.path.splitext(path)[1].lower()

    read_length = JSON_READ_LIMIT if ext == ".json" else MAGIC_BYTE_LENGTH

    with open(path, "rb") as f:
        content = f.read(read_length)

    valid, reason = validate_file(ext, content)

    if valid:
        print(f"PASS ({ext}): {path}")
    else:
        print(f"FAIL ({ext}): {reason}")
        sys.exit(1)
