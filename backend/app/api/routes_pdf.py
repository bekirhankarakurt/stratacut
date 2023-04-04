from __future__ import annotations

import asyncio
import functools
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Body, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.app.core.config import settings
from backend.app.core.errors import ConflictError, NotFoundError, ValidationError
from backend.app.models.schemas import (
    PdfInfoResponse,
    PdfOpenByPathRequest,
    PdfOpenResponse,
    SplitRequest,
    SplitResponse,
)
from backend.app.services import pdf_service
from backend.app.services.storage_service import ensure_workdir, normalize_existing_file_path

router = APIRouter(prefix="/api/pdf", tags=["pdf"])
logger = logging.getLogger("pdfsplitterpro.pdf")


def _to_http_exc(e: Exception) -> HTTPException:
    if isinstance(e, ValidationError):
        return HTTPException(status_code=422, detail=str(e))
    if isinstance(e, NotFoundError):
        return HTTPException(status_code=404, detail=str(e))
    if isinstance(e, ConflictError):
        return HTTPException(status_code=409, detail=str(e))
    logger.exception("Unhandled error", exc_info=e)
    return HTTPException(status_code=500, detail=f"Beklenmeyen hata: {e}")


@router.post("/open", response_model=PdfOpenResponse)
async def open_pdf_upload(file: UploadFile = File(...)):
    dest: Path | None = None
    try:
        ensure_workdir()
        name = (file.filename or "document.pdf").strip() or "document.pdf"
        if not name.lower().endswith(".pdf"):
            raise ValidationError("Sadece .pdf dosyaları desteklenir.")
        dest = settings.workdir / "sessions" / f"{uuid.uuid4().hex}.pdf"
        dest.parent.mkdir(parents=True, exist_ok=True)
        written = 0
        with dest.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                out.write(chunk)
        if written < 32:
            raise ValidationError("PDF dosyası boş veya okunamadı.")
        session = await asyncio.to_thread(pdf_service.open_pdf, dest, Path(name).name)
        dest = None
        return PdfOpenResponse(id=session.id, filename=session.filename, pageCount=session.page_count)
    except Exception as e:  # noqa: BLE001
        if dest is not None:
            try:
                dest.unlink(missing_ok=True)
            except OSError:
                pass
        raise _to_http_exc(e)


@router.post("/open-path", response_model=PdfOpenResponse)
async def open_pdf_by_path(body: PdfOpenByPathRequest = Body(...)):
    try:
        ensure_workdir()
        pdf_path = normalize_existing_file_path(body.path)
        session = await asyncio.to_thread(pdf_service.open_pdf, pdf_path)
        return PdfOpenResponse(id=session.id, filename=session.filename, pageCount=session.page_count)
    except Exception as e:  # noqa: BLE001
        raise _to_http_exc(e)


@router.get("/{sid}", response_model=PdfInfoResponse)
def get_pdf_info(sid: str):
    try:
        session = pdf_service.get_session(sid)
        return PdfInfoResponse(id=session.id, filename=session.filename, pageCount=session.page_count)
    except Exception as e:  # noqa: BLE001
        raise _to_http_exc(e)


@router.get("/{sid}/page/{page}/thumb")
async def get_thumb(
    sid: str,
    page: int,
    width: int = settings.default_thumb_width,
    rotate: int = 0,
    mirrorH: bool = False,
    mirrorV: bool = False,
    contrast: float = 1.0,
):
    try:
        img_path = await asyncio.get_running_loop().run_in_executor(
            pdf_service.RENDER_POOL,
            functools.partial(
                pdf_service.render_thumbnail,
                sid,
                page,
                width,
                rotate,
                mirrorH,
                mirrorV,
                contrast,
            ),
        )
        return FileResponse(
            img_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, max-age=120"},
        )
    except Exception as e:  # noqa: BLE001
        raise _to_http_exc(e)


@router.get("/{sid}/page/{page}/image")
async def get_image(
    sid: str,
    page: int,
    width: int = settings.default_image_width,
    rotate: int = 0,
    mirrorH: bool = False,
    mirrorV: bool = False,
    contrast: float = 1.0,
):
    try:
        img_path = await asyncio.get_running_loop().run_in_executor(
            pdf_service.RENDER_POOL,
            functools.partial(
                pdf_service.render_preview_image,
                sid,
                page,
                width,
                rotate,
                mirrorH,
                mirrorV,
                contrast,
            ),
        )
        return FileResponse(
            img_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, max-age=120"},
        )
    except Exception as e:  # noqa: BLE001
        raise _to_http_exc(e)


@router.post("/{sid}/split", response_model=SplitResponse)
async def split_endpoint(sid: str, req: SplitRequest):
    try:
        loop = asyncio.get_running_loop()
        if req.splitMode == "basket":
            out_path, span_start, span_end = await loop.run_in_executor(
                pdf_service.SPLIT_POOL,
                functools.partial(
                    pdf_service.split_pdf_basket,
                    session=pdf_service.get_session(sid),
                    basket_pages_1idx=req.basketPages or [],
                    section_no=req.sectionNo,
                    output_dir=req.outputDir,
                    first_page_1idx=req.firstPage,
                    second_page_1idx=req.secondPage,
                    rotate=req.rotate,
                    allow_overwrite=req.allowOverwrite,
                    page_adjustments=req.pageAdjustments,
                ),
            )
        else:
            out_path, span_start, span_end = await loop.run_in_executor(
                pdf_service.SPLIT_POOL,
                functools.partial(
                    pdf_service.split_pdf,
                    session=pdf_service.get_session(sid),
                    start_page_1idx=req.startPage,
                    end_page_1idx=req.endPage,
                    section_no=req.sectionNo,
                    output_dir=req.outputDir,
                    first_page_1idx=req.firstPage,
                    second_page_1idx=req.secondPage,
                    rotate=req.rotate,
                    allow_overwrite=req.allowOverwrite,
                    excluded_pages=req.excludedPages,
                    page_adjustments=req.pageAdjustments,
                ),
            )
        return SplitResponse(
            outputPath=str(out_path),
            filename=Path(out_path).name,
            sectionNo=req.sectionNo,
            startPage=span_start,
            endPage=span_end,
        )
    except Exception as e:  # noqa: BLE001
        raise _to_http_exc(e)

