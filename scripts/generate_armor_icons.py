"""Recolor existing 16px armor icons into missing helmet/chestplate variants."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "src" / "assets" / "mc"

TINTS = {
    "leather": (0.72, 0.42, 0.22),
    "iron": (0.78, 0.80, 0.84),
    "gold": (0.98, 0.78, 0.18),
    "diamond": (0.28, 0.86, 0.82),
    "netherite": (0.28, 0.22, 0.24),
    "chain": (0.55, 0.58, 0.60),
}


def tint(src: Image.Image, rgb: tuple[float, float, float]) -> Image.Image:
    img = src.convert("RGBA")
    px = img.load()
    w, h = img.size
    tr, tg, tb = rgb
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            lum = (r * 0.35 + g * 0.45 + b * 0.20) / 255.0
            lum = 0.18 + lum * 0.82
            px[x, y] = (
                max(0, min(255, int(tr * lum * 255))),
                max(0, min(255, int(tg * lum * 255))),
                max(0, min(255, int(tb * lum * 255))),
                a,
            )
    return img


def main() -> None:
    helm = Image.open(ROOT / "iron_helmet.png")
    chest = Image.open(ROOT / "diamond_chestplate.png")
    jobs = [
        ("leather_helmet.png", helm, "leather"),
        ("golden_helmet.png", helm, "gold"),
        ("diamond_helmet.png", helm, "diamond"),
        ("netherite_helmet.png", helm, "netherite"),
        ("chainmail_helmet.png", helm, "chain"),
        ("iron_chestplate.png", chest, "iron"),
        ("golden_chestplate.png", chest, "gold"),
        ("chainmail_chestplate.png", chest, "chain"),
    ]
    for name, src, key in jobs:
        out = ROOT / name
        if out.exists() and name in {
            "leather_chestplate.png",
            "iron_helmet.png",
            "diamond_chestplate.png",
            "netherite_chestplate.png",
            "turtle_helmet.png",
        }:
            continue
        tint(src, TINTS[key]).save(out)
        print("wrote", out.name)


if __name__ == "__main__":
    main()
