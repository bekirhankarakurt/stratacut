"""PNG -> Windows .ico (transparent bg, multi-size)."""

from __future__ import annotations

import struct
import sys
from pathlib import Path

from PIL import Image, ImageDraw


def _count_ico_images(data: bytes) -> int:
    if len(data) < 6:
        return 0
    return struct.unpack_from("<H", data, 4)[0]


def _prepare_icon_image(src: Path) -> Image.Image:
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))

    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if r < 40 and g < 40 and b < 40:
                px[x, y] = (0, 0, 0, 0)

    # Soft rounded tile behind icon — readable at 16px in Explorer.
    tile = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)
    margin = max(8, side // 16)
    draw.rounded_rectangle(
        (margin, margin, side - margin, side - margin),
        radius=side // 6,
        fill=(224, 242, 241, 255),
    )
    composed = Image.alpha_composite(tile, img)

    if max(composed.size) < 512:
        composed = composed.resize((512, 512), Image.Resampling.LANCZOS)
    return composed


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: generate_icon.py <input.png> <output.ico>")

    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    if not src.is_file():
        raise SystemExit(f"PNG bulunamadi: {src}")

    img = _prepare_icon_image(src)
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, format="ICO", sizes=sizes)

    count = _count_ico_images(out.read_bytes())
    print(f"Wrote {out} ({out.stat().st_size} bytes, {count} embedded sizes)")


if __name__ == "__main__":
    main()
