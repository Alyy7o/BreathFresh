from PIL import Image
from pathlib import Path

src = Path(r"D:\FYP\QG\BreathFresh\frontend\src\assets\logo-options\breathfresh-logo-leaf.jpg")
assets = Path(r"D:\FYP\QG\BreathFresh\frontend\src\assets")
public = Path(r"D:\FYP\QG\BreathFresh\frontend\public")
options = Path(r"D:\FYP\QG\BreathFresh\frontend\src\assets\logo-options")


def remove_white_bg(img: Image.Image, threshold: int = 240) -> Image.Image:
    """Make near-white pixels transparent."""
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # Pure / near-white background → transparent
            if r >= threshold and g >= threshold and b >= threshold:
                pixels[x, y] = (r, g, b, 0)
            else:
                # Soft edge for almost-white fringe
                whiteness = min(r, g, b)
                if whiteness > 200:
                    fade = int(255 * (threshold - whiteness) / max(threshold - 200, 1))
                    fade = max(0, min(255, fade))
                    pixels[x, y] = (r, g, b, fade)
    return rgba


def trim_transparent(img: Image.Image, padding: int = 16) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(img.width, right + padding)
    bottom = min(img.height, bottom + padding)
    return img.crop((left, top, right, bottom))


def to_square(img: Image.Image, size: int, fill=(0, 0, 0, 0)) -> Image.Image:
    """Fit image into a transparent square canvas."""
    img = img.copy()
    img.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), fill)
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    canvas.paste(img, (x, y), img)
    return canvas


base = remove_white_bg(Image.open(src))
base = trim_transparent(base, padding=24)

# Transparent PNG for app use
app_logo = to_square(base, 512)
app_logo.save(assets / "app-logo.png", "PNG", optimize=True)

# Also keep a transparent copy in logo-options
app_logo.save(options / "breathfresh-logo-leaf.png", "PNG", optimize=True)

# PWA icons (transparent)
to_square(base, 192).save(public / "icon-192.png", "PNG", optimize=True)
to_square(base, 512).save(public / "icon-512.png", "PNG", optimize=True)

icon32 = to_square(base, 32)
icon16 = to_square(base, 16)
icon48 = to_square(base, 48)
icon32.save(
    public / "favicon.ico",
    format="ICO",
    sizes=[(32, 32), (16, 16), (48, 48)],
    append_images=[icon16, icon48],
)

# Remove leftover jpg copy of app logo if present
jpg_copy = assets / "app-logo.jpg"
if jpg_copy.exists():
    jpg_copy.unlink()

print("transparent png ready")
print("app-logo:", (assets / "app-logo.png").stat().st_size)
print("leaf png:", (options / "breathfresh-logo-leaf.png").stat().st_size)
