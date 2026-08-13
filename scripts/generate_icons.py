#!/usr/bin/env python3
"""
Generates placeholder app icons for MachinistCalc (build/icon.png/.ico/.icns).
Renders an "MC" monogram badge using the app's own font (Segoe UI Bold, the
first cross-platform-available face in src/css/style.css's --font stack) —
not final branding, just enough to give the packaged app a real icon on all
three platforms instead of a dangling reference to a file that doesn't exist.
Uses only Pillow (already installed).
"""

import os
from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
BG = (224, 138, 44, 255)   # #e08a2c — matches the in-app sidebar .brand-mark background
ACCENT = (26, 27, 31, 255)  # #1a1b1f — matches the in-app sidebar .brand-mark text color

# Segoe UI Bold — the first face in style.css's --font stack that's actually
# present on this build machine (Windows). Falls back to Arial Bold if the
# build ever runs somewhere without Segoe UI installed.
FONT_CANDIDATES = [
    r'C:\Windows\Fonts\segoeuib.ttf',
    r'C:\Windows\Fonts\arialbd.ttf',
]

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'build')


def load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.isfile(path):
            return ImageFont.truetype(path, size)
    raise FileNotFoundError('No bold sans-serif font found: ' + ', '.join(FONT_CANDIDATES))


def build_base_image():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = 40
    draw.rounded_rectangle(
        [margin, margin, SIZE - margin, SIZE - margin],
        radius=180, fill=BG
    )

    text = 'MC'
    font = load_font(560)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (SIZE - text_w) / 2 - bbox[0]
    y = (SIZE - text_h) / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=ACCENT)

    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    img = build_base_image()

    png_path = os.path.join(OUT_DIR, 'icon.png')
    img.save(png_path, format='PNG')
    print('wrote', png_path)

    ico_path = os.path.join(OUT_DIR, 'icon.ico')
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(ico_path, format='ICO', sizes=ico_sizes)
    print('wrote', ico_path)

    icns_path = os.path.join(OUT_DIR, 'icon.icns')
    img.save(icns_path, format='ICNS')
    print('wrote', icns_path)


if __name__ == '__main__':
    main()
