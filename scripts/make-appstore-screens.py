#!/usr/bin/env python3
"""Compose App Store 6.9" framed screenshots (1320x2868).

Layout (per user spec): solid theme-color background; a single bold headline
centered in the top band; the device screenshot anchored flush to the bottom
edge with slight side margins and rounded TOP corners + soft shadow.

Marketing-only asset — background colors are literals here (NOT app tokens).
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = os.path.expanduser("~/Desktop/amatta-assets/screen_shots")
OUT = os.path.expanduser("~/Desktop/amatta-assets/appstore")
# NOTE: PretendardStd-Bold.otf renders as tofu boxes under Pillow's FreeType
# (CFF outline issue), so we use Apple SD Gothic Neo Bold (TTC face index 6),
# which is geometrically very close to Pretendard.
FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
FONT_INDEX = 6  # Bold

CANVAS_W, CANVAS_H = 1320, 2868
SIDE_MARGIN_FRAC = 0.085          # device side inset (살짝 비는)
TEXT_MAX_W = CANVAS_W - 2 * 120   # headline wrap width
TOP_CORNER_RADIUS = 56
WHITE = (255, 255, 255)
DARK = (35, 34, 32)

# (screenshot, background hex, text color, headline)
# Per-screen color scheme (user-specified).
# NOTE: screen 3 text color is a PLACEHOLDER — user wrote #C0F0AB (== bg, invisible).
SCREENS = [
    # bg unchanged; text darkened within the same hue family for higher contrast.
    ("IMG_8453.PNG", "#C8B0FF", "#4E2E8F",  # was #FBF2FF (white) → deep lavender
     "여러 자녀의 일정과 픽업을\n한눈에 관리하세요"),
    ("IMG_8456.PNG", "#D9E7FE", "#29355C",  # was #3B4B7A → deeper navy
     "한 주 모든 자녀 일정을 한눈에,\n가족을 위한 시간을 찾아볼까요?"),
    ("IMG_8454.PNG", "#C0F0AB", "#1F3320",  # was #33473B → deeper green
     "자녀들의 준비물과 할일까지\n간편하게 챙기세요"),
    ("IMG_8462.PNG", "#FFE8D2", "#8E5238",  # was #BD7A65 → deeper brown
     "가입 없이,\n귀여운 캐릭터와 함께"),
]


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def wrap_to_lines(draw, text, font, max_w):
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        trial = w if cur == "" else cur + " " + w
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit_headline(draw, text, max_w):
    """Honor explicit "\\n" breaks; pick a uniform size (cap 64) that fits.

    Each paragraph (split on "\\n") becomes its own line; if a paragraph is
    still too wide it soft-wraps. Capping at 64 keeps headline size consistent
    across all 6 screens regardless of 1- vs 2-line copy.
    """
    paras = text.split("\n")
    for size in range(64, 41, -2):
        font = ImageFont.truetype(FONT, size, index=FONT_INDEX)
        lines = []
        for p in paras:
            lines.extend(wrap_to_lines(draw, p, font, max_w))
        if all(draw.textlength(ln, font=font) <= max_w for ln in lines):
            return font, lines
    font = ImageFont.truetype(FONT, 42, index=FONT_INDEX)
    lines = []
    for p in paras:
        lines.extend(wrap_to_lines(draw, p, font, max_w))
    return font, lines


def rounded_top_mask(size, radius):
    """Mask with rounded TOP corners, square BOTTOM (flush to canvas edge)."""
    w, h = size
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, w, h], radius=radius, fill=255)
    # square off the bottom corners
    d.rectangle([0, h - radius, w, h], fill=255)
    return mask


def compose(screenshot, bg_hex, text_color, headline, out_path):
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), hex2rgb(bg_hex))
    draw = ImageDraw.Draw(canvas)

    # --- device screenshot ---
    shot = Image.open(os.path.join(SRC, screenshot)).convert("RGBA")
    dev_w = int(CANVAS_W * (1 - 2 * SIDE_MARGIN_FRAC))
    scale = dev_w / shot.width
    dev_h = int(shot.height * scale)
    shot = shot.resize((dev_w, dev_h), Image.LANCZOS)

    mask = rounded_top_mask((dev_w, dev_h), TOP_CORNER_RADIUS)
    shot.putalpha(mask)

    x = (CANVAS_W - dev_w) // 2
    y = CANVAS_H - dev_h  # flush to bottom

    # --- soft shadow ---
    shadow = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [x, y - 8, x + dev_w, CANVAS_H], radius=TOP_CORNER_RADIUS,
        fill=(0, 0, 0, 70),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(34))
    canvas.paste(shadow, (0, 0), shadow)

    canvas.paste(shot, (x, y), shot)

    # --- headline in the top band (0 .. y) ---
    font, lines = fit_headline(draw, headline, TEXT_MAX_W)
    asc, desc = font.getmetrics()
    line_h = int((asc + desc) * 1.1)
    block_h = line_h * len(lines)
    # Center the headline block within the top band, nudged up slightly so it
    # sits comfortably above the device rather than crowding it.
    ty = int((y - block_h) * 0.46)
    for ln in lines:
        w = draw.textlength(ln, font=font)
        draw.text(((CANVAS_W - w) / 2, ty), ln, font=font, fill=text_color)
        ty += line_h

    canvas.save(out_path, "PNG")
    return out_path


def main():
    os.makedirs(OUT, exist_ok=True)
    for i, (shot, bg, tc, head) in enumerate(SCREENS, 1):
        out = os.path.join(OUT, f"{i:02d}.png")
        compose(shot, bg, tc, head, out)
        print(f"  ✓ {out}  ({bg})  {head}")


if __name__ == "__main__":
    main()
