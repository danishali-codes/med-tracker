"""Draws Sabr's icon (a two-tone capsule on purple) into assets/ and the website.

The same mark as website/public/favicon.svg. Run: python3 scripts/make-icons.py (needs Pillow).
"""
from PIL import Image, ImageDraw

PURPLE = '#6A4DF4'
WHITE = '#FFFFFF'
LILAC = '#C9BEFF'
SS = 4  # draw big, then scale down for smooth edges


def pill(size, length, width, two_tone=True, seam=0):
    """A capsule centred in a transparent square, tilted 40 degrees."""
    n = size * SS
    L, W = length * SS, width * SS
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, y0 = (n - L) / 2, (n - W) / 2
    x1, y1 = x0 + L, y0 + W
    d.rounded_rectangle([x0, y0, x1, y1], radius=W / 2, fill=WHITE)
    if two_tone:
        mid = n / 2
        d.rounded_rectangle([mid, y0, x1, y1], radius=W / 2, fill=LILAC)
        d.rectangle([mid, y0, mid + W / 2, y1], fill=LILAC)
    if seam:
        s = seam * SS / 2
        d.rectangle([n / 2 - s, y0, n / 2 + s, y1], fill=(0, 0, 0, 0))
    im = im.rotate(40, resample=Image.BICUBIC, center=(n / 2, n / 2))
    return im.resize((size, size), Image.LANCZOS)


def on_square(size, radius=0):
    n = size * SS
    bg = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    ImageDraw.Draw(bg).rounded_rectangle([0, 0, n - 1, n - 1], radius=radius * SS, fill=PURPLE)
    bg = bg.resize((size, size), Image.LANCZOS)
    # Same proportions as favicon.svg: 40 x 18 on a 64 square.
    bg.alpha_composite(pill(size, size * 40 / 64, size * 18 / 64))
    return bg


# App icon (Android masks the corners itself).
on_square(1024).convert('RGB').save('assets/icon.png', optimize=True)
# Adaptive icon: the launcher shows roughly the middle 66%, so the capsule is smaller here.
pill(512, 290, 130).save('assets/android-icon-foreground.png', optimize=True)
Image.new('RGBA', (512, 512), PURPLE).save('assets/android-icon-background.png', optimize=True)
pill(432, 245, 110, two_tone=False, seam=10).save('assets/android-icon-monochrome.png', optimize=True)
pill(1024, 560, 250).save('assets/splash-icon.png', optimize=True)
on_square(48, radius=12).save('assets/favicon.png', optimize=True)
# Website
on_square(180).convert('RGB').save('website/public/apple-touch-icon.png', optimize=True)
on_square(512, radius=128).save('website/public/icon-512.png', optimize=True)
print('icons written')
