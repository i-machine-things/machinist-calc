#!/usr/bin/env python3
"""
Generates placeholder app icons for MachinistCalc (build/icon.png/.ico/.icns).
Draws a simple "MC" monogram badge — not final branding, just enough to give
the packaged app a real icon on all three platforms instead of a dangling
reference to a file that doesn't exist. Uses only Pillow (already installed).
"""

import os
from PIL import Image, ImageDraw

SIZE = 1024
BG = (224, 138, 44, 255)   # #e08a2c — matches the in-app sidebar .brand-mark background
ACCENT = (26, 27, 31, 255)  # #1a1b1f — matches the in-app sidebar .brand-mark text color

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'build')


def build_base_image():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = 40
    draw.rounded_rectangle(
        [margin, margin, SIZE - margin, SIZE - margin],
        radius=180, fill=BG
    )

    stroke = 88
    top = 340
    bottom = 684
    mid_y = 460

    # "M": left leg -> down to a mid dip -> up -> right leg (single polyline).
    m_left = 210
    m_right = 470
    m_mid = (m_left + m_right) // 2
    draw.line(
        [(m_left, bottom), (m_left, top), (m_mid, mid_y), (m_right, top), (m_right, bottom)],
        fill=ACCENT, width=stroke, joint='curve'
    )
    for pt in [(m_left, bottom), (m_left, top), (m_mid, mid_y), (m_right, top), (m_right, bottom)]:
        r = stroke // 2
        draw.ellipse([pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r], fill=ACCENT)

    # "C": open arc on the right side.
    c_box = [560, top - 20, 860, bottom + 20]
    draw.arc(c_box, start=55, end=305, fill=ACCENT, width=stroke)
    # Round off the arc endpoints (PIL's arc has flat caps).
    import math
    cx, cy = (c_box[0] + c_box[2]) / 2, (c_box[1] + c_box[3]) / 2
    rx, ry = (c_box[2] - c_box[0]) / 2, (c_box[3] - c_box[1]) / 2
    for ang in (55, 305):
        rad = math.radians(ang)
        px, py = cx + rx * math.cos(rad), cy + ry * math.sin(rad)
        r = stroke // 2
        draw.ellipse([px - r, py - r, px + r, py + r], fill=ACCENT)

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
