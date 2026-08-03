from __future__ import annotations

import logging
import re
import shutil
import tempfile
import uuid
import zipfile
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import settings
from .docgen import convert_to_pdf, generate_docx
from .drive import upload_zip
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


def _candidate_paths(raw_path: str, app_dir: Path) -> list[Path]:
    path = Path(raw_path)
    if path.is_absolute():
        return [path]
    return [
        Path.cwd() / path,
        app_dir / path,
        app_dir.parent / path,
    ]


def _resolve_template_dir() -> Path:
    app_dir = Path(__file__).resolve().parent
    candidates: list[Path] = []

    if settings.template_dir.strip():
        candidates.extend(_candidate_paths(settings.template_dir.strip(), app_dir))
    if settings.template_path.strip():
        candidates.extend(_candidate_paths(str(Path(settings.template_path).parent), app_dir))
    candidates.append(app_dir / "templates")

    seen: set[Path] = set()
    checked: list[Path] = []
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        checked.append(resolved)
        if resolved.is_dir():
            logger.info("Using templates directory: %s", resolved)
            return resolved

    raise RuntimeError(
        "Templates directory not found. Checked: " + ", ".join(str(path) for path in checked)
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/v1/agreements")
async def create_agreement(body: AgreementRequest):
    """
    Accept form data, generate DOCX+PDF set, upload only ZIP to Google Drive,
    and return the ZIP to the client as a downloadable file.
    """
    agreement_id = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
    logger.info("Processing agreement %s for %s", agreement_id, body.full_name)

    tmp_dir = Path(tempfile.mkdtemp(prefix="agreement_"))
    try:
        # 1. Pick templates by business rule
        try:
            template_dir = _resolve_template_dir()
        except Exception as exc:
            logger.error("Template directory resolution failed: %s", exc)
            raise HTTPException(
                status_code=500,
                detail=f"Template directory not found. {exc}",
            ) from exc
        template_candidates = {
            "general": settings.template_general_filenames_list,
            "invasia": settings.template_invasia_filenames_list,
            "pregnant": settings.template_pregnant_filenames_list,
        }
        template_keys = ["general", "invasia"]
        if body.gender == "female":
            template_keys.append("pregnant")

        selected_templates: list[tuple[str, Path]] = []
        for key in template_keys:
            resolved: Path | None = None
            checked_paths: list[str] = []
            for candidate in template_candidates[key]:
                path = template_dir / candidate
                checked_paths.append(str(path))
                if path.exists():
                    resolved = path
                    break
            if not resolved:
                logger.error(
                    "Template not found for key='%s'. candidates=%s checked_paths=%s",
                    key,
                    template_candidates[key],
                    checked_paths,
                )
                raise HTTPException(
                    status_code=500,
                    detail=(
                        f"Document template not found for key '{key}'. "
                        f"Expected one of: {template_candidates[key]}. "
                        f"Checked in: {template_dir}"
                    ),
                )
            selected_templates.append((key, resolved))

        birth_date_text = body.birth_date.strftime("%d.%m.%Y")
        gender_display = "Женский" if body.gender == "female" else "Мужской"

        # 2. Generate DOCX and convert each one to PDF
        docx_paths: list[Path] = []
        pdf_paths: list[Path] = []
        for template_key, template_path in selected_templates:
            output_basename = f"{agreement_id}_{template_key}"
            try:
                docx_path = generate_docx(
                    template_path=template_path,
                    full_name=body.full_name,
                    phone=body.phone,
                    iin=body.iin,
                    birth_date=birth_date_text,
                    gender_display=gender_display,
                    allergy=body.allergy,
                    procedure=body.procedure,
                    signature_base64=body.signature_base64,
                    agreement_id=agreement_id,
                    output_basename=output_basename,
                    output_dir=tmp_dir,
                )
            except Exception as exc:
                logger.exception("DOCX generation failed for template '%s'", template_key)
                raise HTTPException(status_code=500, detail=f"Document generation failed: {exc}") from exc

            try:
                pdf_path = convert_to_pdf(docx_path, tmp_dir)
            except Exception as exc:
                logger.exception("PDF conversion failed for template '%s'", template_key)
                raise HTTPException(status_code=500, detail=f"PDF conversion failed: {exc}") from exc

            docx_paths.append(docx_path)
            pdf_paths.append(pdf_path)

        # 3. Build ZIP with generated DOCX and PDF files
        safe_name = re.sub(r"[^A-Za-z0-9_-]", "_", body.full_name)[:40] or "patient"
        zip_name = f"soglasie_{agreement_id}_{safe_name}.zip"
        zip_path = tmp_dir / zip_name
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for generated_file in [*docx_paths, *pdf_paths]:
                archive.write(generated_file, arcname=generated_file.name)
        logger.info("ZIP generated: %s", zip_path)

        # 4. Upload ZIP to Google Drive (best-effort — don't fail the request on Drive error)
        drive_error: str | None = None
        if settings.google_drive_folder_id:
            try:
                upload_zip(
                    zip_path=zip_path,
                    folder_id=settings.google_drive_folder_id,
                    agreement_id=agreement_id,
                    full_name=body.full_name,
                    service_account_info=settings.service_account_info,
                    service_account_file=settings.google_service_account_file,
                    oauth_credentials_info=settings.oauth_credentials_info,
                )
            except Exception as exc:
                drive_error = str(exc)
                logger.error("Drive upload failed for %s: %s", agreement_id, exc)
        else:
            logger.warning("GOOGLE_DRIVE_FOLDER_ID not set — skipping Drive upload")

        # 5. Return ZIP to client
        headers: dict[str, str] = {}
        if drive_error:
            headers["X-Drive-Error"] = drive_error[:200]

        return FileResponse(
            path=str(zip_path),
            media_type="application/zip",
            filename=zip_name,
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
