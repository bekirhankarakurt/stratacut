"""One-off pixel sprites: steve + daytime animals."""
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "frontend" / "src" / "assets" / "mobs"


def save(name: str, img: Image.Image) -> None:
    p = OUT / name
    img.save(p)
    print(name, img.size, p.stat().st_size)


def animal(w: int, h: int, body: list[str], palette: dict[str, tuple[int, int, int, int]]) -> Image.Image:
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(body):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            px[x, y] = palette[ch]
    return im


def make_steve() -> Image.Image:
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    p = img.load()
    skin = (198, 134, 66, 255)
    hair = (107, 62, 38, 255)
    shirt = (61, 92, 153, 255)
    pants = (58, 58, 106, 255)
    eye = (59, 42, 30, 255)
    white = (242, 242, 242, 255)
    for y in range(0, 8):
        for x in range(4, 12):
            p[x, y] = hair if y < 2 else skin
    for x in range(4, 12):
        p[x, 1] = hair
    p[6, 4] = white
    p[7, 4] = eye
    p[8, 4] = eye
    p[9, 4] = white
    p[6, 5] = eye
    p[9, 5] = eye
    p[7, 6] = hair
    p[8, 6] = hair
    for y in range(8, 20):
        for x in range(4, 12):
            p[x, y] = shirt
        p[2, y] = skin
        p[3, y] = skin
        p[12, y] = skin
        p[13, y] = skin
    for y in range(20, 32):
        for x in range(4, 8):
            p[x, y] = pants
        for x in range(8, 12):
            p[x, y] = pants
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    save("steve.png", make_steve())
    save(
        "pig.png",
        animal(
            20,
            12,
            [
                "....................",
                "......HHHHHH........",
                ".....HSSSSSSH.......",
                "....HSSSSSSSSH......",
                "....HSOOSSSSSHN.....",
                "....HSSSSSSSSHN.....",
                ".....HSSSSSSH.......",
                "......HHHHHH........",
                "......L....L........",
                "......L....L........",
                "......F....F........",
                "....................",
            ],
            {
                "H": (232, 150, 168, 255),
                "S": (241, 164, 180, 255),
                "O": (40, 20, 20, 255),
                "N": (232, 150, 168, 255),
                "L": (210, 120, 140, 255),
                "F": (180, 90, 110, 255),
            },
        ),
    )
    save(
        "chicken.png",
        animal(
            16,
            12,
            [
                "................",
                "......YY........",
                ".....YYYY.......",
                "....WYYYYO......",
                ".....YYYYB......",
                "......WWWW......",
                ".....WWWWWW.....",
                "....WWWWWWWW....",
                ".....WW..WW.....",
                ".....LL..LL.....",
                ".....FF..FF.....",
                "................",
            ],
            {
                "Y": (252, 232, 80, 255),
                "W": (248, 248, 248, 255),
                "O": (40, 30, 20, 255),
                "B": (232, 140, 40, 255),
                "L": (220, 60, 50, 255),
                "F": (232, 180, 50, 255),
            },
        ),
    )
    save(
        "cow.png",
        animal(
            24,
            12,
            [
                "........................",
                ".......WWWWWWW..........",
                "......WBBWWWWWW.........",
                ".....WWWWWBWWWWW........",
                "....WWWWWWWWWWWW.H......",
                "....WWBWWWWWWWWWWH......",
                ".....WWWWWBWWWWW.O......",
                "......WWWWWWWWW.........",
                "......L.L...L.L.........",
                "......F.F...F.F.........",
                "........................",
                "........................",
            ],
            {
                "W": (245, 245, 245, 255),
                "B": (40, 30, 28, 255),
                "H": (90, 70, 55, 255),
                "O": (30, 20, 18, 255),
                "L": (70, 55, 45, 255),
                "F": (50, 40, 32, 255),
            },
        ),
    )


if __name__ == "__main__":
    main()
