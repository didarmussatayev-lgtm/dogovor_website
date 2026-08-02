from __future__ import annotations

import logging
import shutil
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import settings
from .docgen import convert_to_pdf, generate_docx
from .drive import upload_files
from .models import AgreementRequest

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Electronic Consent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/v1/agreements")
async def create_agreement(body: AgreementRequest):
    """
    Accept form data, generate DOCX+PDF, upload to Google Drive,
    and return the PDF to the client as a downloadable file.
    """
    agreement_id = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
    logger.info("Processing agreement %s for %s", agreement_id, body.full_name)

    tmp_dir = Path(tempfile.mkdtemp(prefix="agreement_"))
    try:
        # 1. Generate DOCX
        template_path = Path(settings.template_path)
        if not template_path.exists():
            logger.error("Template not found: %s", template_path)
            raise HTTPException(
                status_code=500,
                detail="Document template not found on server. Please contact support.",
            )

        try:
            docx_path = generate_docx(
                template_path=template_path,
                full_name=body.full_name,
                phone=body.phone,
                iin=body.iin,
                allergy=body.allergy,
                signature_base64=body.signature_base64,
                agreement_id=agreement_id,
                output_dir=tmp_dir,
            )
        except Exception as exc:
            logger.exception("DOCX generation failed")
            raise HTTPException(status_code=500, detail=f"Document generation failed: {exc}") from exc

        # 2. Convert to PDF
        try:
            pdf_path = convert_to_pdf(docx_path, tmp_dir)
        except Exception as exc:
            logger.exception("PDF conversion failed")
            raise HTTPException(status_code=500, detail=f"PDF conversion failed: {exc}") from exc

        # 3. Upload to Google Drive (best-effort — don't fail the request on Drive error)
        drive_error: str | None = None
        if settings.google_drive_folder_id:
            try:
                upload_files(
                    docx_path=docx_path,
                    pdf_path=pdf_path,
                    folder_id=settings.google_drive_folder_id,
                    agreement_id=agreement_id,
                    full_name=body.full_name,
                    service_account_info=settings.service_account_info,
                    service_account_file=settings.google_service_account_file,
                )
            except Exception as exc:
                drive_error = str(exc)
                logger.error("Drive upload failed for %s: %s", agreement_id, exc)
        else:
            logger.warning("GOOGLE_DRIVE_FOLDER_ID not set — skipping Drive upload")

        # 4. Return PDF to client
        # Sanitize name: keep only word chars to prevent path injection
        import re as _re
        safe_name = _re.sub(r"[^\w]", "_", body.full_name)[:40]
        filename = f"soglasie_{agreement_id}_{safe_name}.pdf"

        headers: dict[str, str] = {}
        if drive_error:
            headers["X-Drive-Error"] = drive_error[:200]

        # Copy PDF to a fixed name inside the temp dir (never derived from raw user input)
        stable_pdf = tmp_dir / f"{agreement_id}_output.pdf"
        shutil.copy2(pdf_path, stable_pdf)

        return FileResponse(
            path=str(stable_pdf),
            media_type="application/pdf",
            filename=filename,
            headers=headers,
            background=_cleanup_background(tmp_dir),
        )

    except HTTPException:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        logger.exception("Unexpected error for agreement %s", agreement_id)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


def _cleanup_background(tmp_dir: Path):
    """Return a BackgroundTask that removes the temp directory."""
    from starlette.background import BackgroundTask

    def _cleanup():
        shutil.rmtree(tmp_dir, ignore_errors=True)
        logger.debug("Cleaned up temp dir: %s", tmp_dir)

    return BackgroundTask(_cleanup)
