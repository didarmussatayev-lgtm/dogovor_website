from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_DRIVE_AVAILABLE = False
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    _DRIVE_AVAILABLE = True
except ImportError:
    logger.warning("google-api-python-client not installed; Drive upload disabled")

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def _build_service(service_account_info: Optional[dict], service_account_file: Optional[str]):
    """Build and return a Google Drive service object."""
    if not _DRIVE_AVAILABLE:
        raise RuntimeError("Google API client library is not installed")

    if service_account_info:
        creds = service_account.Credentials.from_service_account_info(
            service_account_info, scopes=SCOPES
        )
    elif service_account_file and Path(service_account_file).exists():
        creds = service_account.Credentials.from_service_account_file(
            service_account_file, scopes=SCOPES
        )
    else:
        raise RuntimeError(
            "No Google service-account credentials found. "
            "Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE."
        )

    return build("drive", "v3", credentials=creds)


def _safe_filename(full_name: str) -> str:
    """Normalize a name for use in filenames."""
    return re.sub(r"[^\w\-]", "_", full_name.strip())[:50]


def upload_files(
    docx_path: Path,
    pdf_path: Path,
    folder_id: str,
    agreement_id: str,
    full_name: str,
    service_account_info: Optional[dict] = None,
    service_account_file: Optional[str] = None,
) -> dict:
    """
    Upload DOCX and PDF to Google Drive.

    Returns a dict with file IDs: {"docx_id": ..., "pdf_id": ...}
    Raises RuntimeError on failure.
    """
    service = _build_service(service_account_info, service_account_file)
    safe_name = _safe_filename(full_name)

    results = {}
    for file_path, mime_type, ext in [
        (docx_path, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
        (pdf_path, "application/pdf", "pdf"),
    ]:
        file_name = f"{agreement_id}_{safe_name}.{ext}"
        metadata = {
            "name": file_name,
            "parents": [folder_id] if folder_id else [],
        }
        media = MediaFileUpload(str(file_path), mimetype=mime_type, resumable=False)
        uploaded = (
            service.files()
            .create(body=metadata, media_body=media, fields="id,name")
            .execute()
        )
        logger.info("Uploaded %s to Drive as %s (id=%s)", file_path.name, file_name, uploaded.get("id"))
        results[f"{ext}_id"] = uploaded.get("id")

    return results
