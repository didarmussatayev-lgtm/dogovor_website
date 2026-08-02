from __future__ import annotations

import base64
import logging
import os
import subprocess
import tempfile
from datetime import date
from io import BytesIO
from pathlib import Path

from docxtpl import DocxTemplate, InlineImage
from docx.shared import Mm

logger = logging.getLogger(__name__)


def _decode_signature(signature_base64: str) -> bytes:
    """Strip optional data-URL prefix and return raw PNG bytes."""
    if "," in signature_base64:
        signature_base64 = signature_base64.split(",", 1)[1]
    return base64.b64decode(signature_base64)


def generate_docx(
    template_path: str | Path,
    full_name: str,
    phone: str,
    iin: str,
    allergy: str,
    signature_base64: str,
    agreement_id: str,
    output_dir: str | Path,
) -> Path:
    """Fill the DOCX template and return the path to the generated file."""
    tpl = DocxTemplate(template_path)

    # Decode signature and write to a temp PNG so InlineImage can read it
    sig_bytes = _decode_signature(signature_base64)
    sig_tmp = Path(output_dir) / f"{agreement_id}_sig.png"
    sig_tmp.write_bytes(sig_bytes)

    context = {
        "full_name": full_name,
        "phone": phone,
        "iin": iin,
        "allergy": allergy,
        "date": date.today().strftime("%d.%m.%Y"),
        "agreement_id": agreement_id,
        "signature": InlineImage(tpl, str(sig_tmp), width=Mm(50)),
    }

    tpl.render(context)

    docx_path = Path(output_dir) / f"{agreement_id}.docx"
    tpl.save(str(docx_path))
    logger.info("DOCX generated: %s", docx_path)
    return docx_path


def convert_to_pdf(docx_path: Path, output_dir: Path) -> Path:
    """Convert a DOCX file to PDF using LibreOffice headless."""
    cmd = [
        "libreoffice",
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        str(output_dir),
        str(docx_path),
    ]
    logger.info("Running LibreOffice: %s", " ".join(cmd))
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "LibreOffice is not installed or not found in PATH"
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("LibreOffice conversion timed out") from exc

    if result.returncode != 0:
        logger.error("LibreOffice stderr: %s", result.stderr)
        raise RuntimeError(f"LibreOffice conversion failed: {result.stderr.strip()}")

    pdf_path = output_dir / (docx_path.stem + ".pdf")
    if not pdf_path.exists():
        raise RuntimeError(f"PDF not found after conversion: {pdf_path}")

    logger.info("PDF generated: %s", pdf_path)
    return pdf_path
