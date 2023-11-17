"""Regenerate fist + paper-doll mob sprites so none render as empty blobs."""
from collections.abc import Callable
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MC = ROOT / "frontend" / "src" / "assets" / "mc"
MOBS = ROOT / "frontend" / "src" / "assets" / "mobs"


def px(img: Image.Image, x: int, y: int, w: int, h: int, color: tuple[int, ...]) -> None:
    draw = ImageDraw.Draw(img)
    draw.rectangle([x, y, x + w - 1, y + h - 1], fill=color)


def noise_rect(img: Image.Image, x: int, y: int, w: int, h: int, colors: list[tuple[int, int, int, int]]) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            img.putpixel((xx, yy), colors[(xx * 13 + yy * 7) % len(colors)])


def make_fist() -> None:
    """16x16 Minecraft-style clenched hand (Steve skin)."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    skin = (198, 134, 66, 255)
    skin_d = (160, 98, 45, 255)
    skin_l = (219, 162, 99, 255)
    outline = (62, 36, 18, 255)
    # palm
    px(img, 4, 5, 8, 8, skin)
    px(img, 5, 6, 6, 6, skin_l)
    # knuckles
    px(img, 4, 4, 2, 2, skin_d)
    px(img, 7, 3, 2, 3, skin)
    px(img, 10, 4, 2, 2, skin_d)
    # thumb
    px(img, 11, 8, 3, 4, skin)
    px(img, 12, 9, 2, 2, skin_l)
    # outline
    for x, y in [
        (3, 5), (3, 6), (3, 7), (3, 8), (3, 9), (3, 10), (3, 11), (3, 12),
        (4, 4), (5, 3), (6, 3), (7, 2), (8, 2), (9, 3), (10, 3), (11, 4),
        (12, 5), (13, 7), (14, 8), (14, 9), (14, 10), (13, 11), (12, 12),
        (11, 13), (10, 13), (9, 13), (8, 13), (7, 13), (6, 12), (5, 12), (4, 12),
    ]:
        if 0 <= x < 16 and 0 <= y < 16:
            img.putpixel((x, y), outline)
    img.save(MC / "fist.png")
    print("wrote fist.png")


def paper_doll(
    path: Path,
    head: list[tuple[int, int, int, int]],
    body: list[tuple[int, int, int, int]],
    arms: list[tuple[int, int, int, int]],
    legs: list[tuple[int, int, int, int]],
    face: Callable[[Image.Image], None],
    scale: int = 6,
) -> None:
    """Classic Minecraft paper-doll: 16x32 units (head 8, body 12, legs 12)."""
    u, v = 16, 32
    base = Image.new("RGBA", (u, v), (0, 0, 0, 0))
    # head 8x8 centered
    noise_rect(base, 4, 0, 8, 8, head)
    face(base)
    # body 8x12
    noise_rect(base, 4, 8, 8, 12, body)
    # arms 4x12
    noise_rect(base, 0, 8, 4, 12, arms)
    noise_rect(base, 12, 8, 4, 12, arms)
    # legs 4x12
    noise_rect(base, 4, 20, 4, 12, legs)
    noise_rect(base, 8, 20, 4, 12, legs)
    out = base.resize((u * scale, v * scale), Image.Resampling.NEAREST)
    out.save(path)
    print("wrote", path.name, out.size)


def zombie_face(img: Image.Image) -> None:
    eye = (20, 18, 16, 255)
    px(img, 5, 3, 2, 1, eye)
    px(img, 9, 3, 2, 1, eye)
    px(img, 7, 5, 2, 2, (90, 40, 40, 255))


def skeleton_face(img: Image.Image) -> None:
    px(img, 5, 3, 2, 2, (20, 20, 20, 255))
    px(img, 9, 3, 2, 2, (20, 20, 20, 255))
    px(img, 6, 6, 4, 1, (40, 40, 40, 255))
    # ribs
    for y in (10, 12, 14, 16):
        px(img, 5, y, 6, 1, (90, 90, 85, 255))


def make_creeper() -> None:
    """Front-facing creeper: square head, body, 4 legs. Not a thin UV strip."""
    scale = 6
    u, v = 16, 28
    base = Image.new("RGBA", (u, v), (0, 0, 0, 0))
    greens = [
        (77, 166, 61, 255),
        (61, 140, 48, 255),
        (90, 188, 72, 255),
        (48, 110, 38, 255),
        (110, 180, 90, 255),
        (70, 120, 55, 255),
    ]
    noise_rect(base, 4, 0, 8, 8, greens)  # head
    noise_rect(base, 4, 8, 8, 12, greens)  # body
    noise_rect(base, 3, 20, 4, 6, greens)  # left legs
    noise_rect(base, 9, 20, 4, 6, greens)  # right legs
    # face
    px(base, 5, 2, 2, 2, (16, 16, 16, 255))
    px(base, 9, 2, 2, 2, (16, 16, 16, 255))
    px(base, 7, 4, 2, 1, (16, 16, 16, 255))
    px(base, 6, 5, 4, 2, (16, 16, 16, 255))
    px(base, 7, 7, 2, 1, (16, 16, 16, 255))
    out = base.resize((u * scale, v * scale), Image.Resampling.NEAREST)
    out.save(MOBS / "creeper.png")
    print("wrote creeper.png", out.size)


def lift_enderman() -> None:
    """Raise near-black body so it reads at night; keep magenta eyes."""
    path = MOBS / "enderman.png"
    im = Image.open(path).convert("RGBA")
    pxd = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pxd[x, y]
            if a < 12:
                continue
            # magenta eyes stay
            if r > 80 and b > 80 and g < 90:
                continue
            # lift body from #000 to visible charcoal
            lum = (r + g + b) / 3
            if lum < 40:
                n = 36 + int(lum)
                pxd[x, y] = (n, n, min(n + 8, 255), a)
    # faint outline via max-filter on alpha
    im.save(path)
    print("lifted enderman.png")


def main() -> None:
    make_fist()
    paper_doll(
        MOBS / "zombie.png",
        head=[(70, 108, 52, 255), (58, 92, 42, 255), (82, 122, 60, 255), (48, 78, 36, 255)],
        body=[(0, 170, 170, 255), (0, 148, 148, 255), (20, 186, 186, 255), (0, 130, 130, 255)],
        arms=[(70, 108, 52, 255), (58, 92, 42, 255), (82, 122, 60, 255)],
        legs=[(70, 42, 92, 255), (58, 32, 78, 255), (90, 54, 110, 255)],
        face=zombie_face,
    )
    paper_doll(
        MOBS / "skeleton.png",
        head=[(186, 186, 170, 255), (210, 210, 198, 255), (160, 160, 148, 255)],
        body=[(186, 186, 170, 255), (210, 210, 198, 255), (150, 150, 140, 255)],
        arms=[(186, 186, 170, 255), (168, 168, 154, 255)],
        legs=[(186, 186, 170, 255), (168, 168, 154, 255)],
        face=skeleton_face,
    )
    make_creeper()
    lift_enderman()


if __name__ == "__main__":
    main()
