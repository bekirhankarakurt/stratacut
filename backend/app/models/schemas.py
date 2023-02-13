from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PdfOpenResponse(BaseModel):
    id: str
    filename: str
    pageCount: int


class PdfInfoResponse(BaseModel):
    id: str
    filename: str
    pageCount: int


class PdfOpenByPathRequest(BaseModel):
    path: str = Field(..., description="Absolute or relative path to a PDF file.")


class PageAdjustmentEntry(BaseModel):
    page: int = Field(..., ge=1)
    rotate: int = Field(default=0, description="0/90/180/270")
    mirrorH: bool = Field(default=False, description="Horizontal mirror (flip left-right).")
    mirrorV: bool = Field(default=False, description="Vertical mirror (flip top-bottom).")
    contrast: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Contrast multiplier (1.0 = unchanged).",
    )


class SplitRequest(BaseModel):
    splitMode: Literal["range", "basket"] = "range"
    startPage: int = Field(1, ge=1, description="Range mode: start. Basket mode: should match min of basket; ignored for export.")
    endPage: int = Field(1, ge=1, description="Range mode: end. Basket mode: should match max of basket.")
    sectionNo: int = Field(..., ge=1)
    outputDir: str = Field(..., description="Target output directory path.")
    basketPages: list[int] | None = Field(
        default=None,
        description="Basket mode: 1-based page numbers to export (order preserved, deduped).",
    )
    excludedPages: list[int] | None = Field(
        default=None,
        description=(
            "Range only: 1-indexed pages within [startPage,endPage] to skip. "
            "Ignored in basket mode."
        ),
    )
    firstPage: int | None = Field(
        default=None,
        ge=1,
        description="Optional: first in output. Must be in exported page set.",
    )
    secondPage: int | None = Field(
        default=None,
        ge=1,
        description="Optional: second in output. Must be in exported page set and not equal to firstPage.",
    )
    rotate: int = Field(
        default=0,
        description="Fallback rotate for pages without pageAdjustments (0/90/180/270).",
    )
    pageAdjustments: list[PageAdjustmentEntry] | None = Field(
        default=None,
        description="Per-page rotate/mirror/contrast applied on export.",
    )
    allowOverwrite: bool = Field(
        default=False,
        description="If true and target file exists, overwrite it (used for edit flow).",
    )

    @model_validator(mode="after")
    def _split_mode_basket(self) -> SplitRequest:
        if self.splitMode == "basket":
            if not self.basketPages or len(self.basketPages) < 1:
                raise ValueError("Sepet modunda en az bir sayfa (basketPages) gerekli.")
        return self


class SplitResponse(BaseModel):
    outputPath: str
    filename: str
    sectionNo: int
    startPage: int
    endPage: int


class PickFolderResponse(BaseModel):
    path: str | None = Field(default=None)


class PickPdfResponse(BaseModel):
    path: str | None = Field(default=None)


class OutputScanRequest(BaseModel):
    outputDir: str = Field(..., description="Output directory to scan for previously created split files.")
    notFoundDir: str | None = Field(
        default=None,
        description="Optional bulunamadı folder; pages there are returned separately, not as done/skipped.",
    )


class OutputScanFile(BaseModel):
    filename: str
    pages: list[int] = Field(default_factory=list)


class OutputScanResponse(BaseModel):
    coveredPages: list[int] = Field(default_factory=list, description="1-indexed pages that already exist in outputs.")
    ranges: list[tuple[int, int]] = Field(default_factory=list, description="Detected page ranges (start,end).")
    maxSectionNo: int = Field(default=0, description="Max bolum number found in output directory (0 if none).")
    notFoundPages: list[int] = Field(default_factory=list, description="Pages found in the bulunamadı folder.")
    notFoundMaxSectionNo: int = Field(default=0, description="Max bolum number in the bulunamadı folder.")
    notFoundFiles: list[OutputScanFile] = Field(default_factory=list)


class DeleteOutputRequest(BaseModel):
    outputDir: str = Field(..., description="Directory containing the split output file.")
    filename: str = Field(..., description="Basename of the bolum_XXX_sayfa_*.pdf file to delete.")


class DeleteOutputResponse(BaseModel):
    ok: bool = True


class CursorPosRequest(BaseModel):
    x: int
    y: int


class CursorPosResponse(BaseModel):
    ok: bool = True


class SaveBody(BaseModel):
    data: dict = Field(default_factory=dict)


class SaveResponse(BaseModel):
    ok: bool = True
    data: dict | None = None


class LanProfileBody(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str = ""
    level: int = 1
    xp: int = 0
    achievements: int = 0
    coins: int = 0
    aliveDays: int = 0
    splits: int = 0
    deaths: int = 0
    rank: str = ""
    theme: str = ""
    activity: str = ""
    deadly: bool = False
    minecraftMs: int = 0
    classicMs: int = 0
    mobKills: int = 0
    bossKills: int = 0
    pdfsOpened: int = 0
    pagesSaved: int = 0
    bio: str = ""
    unlocked: list[str] = Field(default_factory=list)
    hasAvatar: bool = False
    avatarAt: int = 0


class LanAvatarBody(BaseModel):
    dataUrl: str = ""


class LanBoardResponse(BaseModel):
    selfId: str
    username: str
    hostname: str
    players: list[dict] = Field(default_factory=list)


class LanIdentityResponse(BaseModel):
    id: str
    username: str
    hostname: str

