"""
Cover image generator — procedural WebP covers for blog posts.

Design language (matches apps/web/public/icon-512.png brand mark):
  - Blue rounded-square (#2D6BFF) gradient backdrop
  - White tool icon glyph (geometric, brand-coherent)
  - Tool name as overlay (large, bold, sans-serif)
  - "GetPDFPro" wordmark in the corner
  - Small "blog" tag to differentiate from tool icons

Why procedural (and not AI image generation):
  - Cost: 35+ images/month × $0.02/image = $8/month. Free is better.
  - Consistency: every cover follows the same brand language. AI gen
    gives you different styles per image.
  - Speed: PIL runs in <500ms per image.
  - Determinism: same tool = same cover. Easy to regenerate if the
    brand changes.

Image SEO:
  - Output: 1280x720 (16:9), WebP, <100 KB
  - Filename: cover-<slug>.webp (matches existing /blog/cover-*.webp
    convention used by the static blog code)
  - alt text: written to <slug>.alt.txt alongside the image so the
    publisher can wire it into the post cover alt attribute
  - The image has no actual text in it that the alt needs to repeat;
    alt is descriptive of the visual.

Dependencies:
  - Pillow (PIL) — pip install Pillow
  - A font that supports Latin + numerals. macOS ships /System/Library/Fonts/Helvetica.ttc
    and SF Pro. We try a few common paths.
"""

from __future__ import annotations

import hashlib
import os
import pathlib
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Style constants — match the brand mark in apps/web/public/icon-512.png
# ---------------------------------------------------------------------------
COVER_W = 1280
COVER_H = 720
BRAND_BLUE = (45, 107, 255)         # #2D6BFF
BRAND_BLUE_DARK = (28, 80, 220)     # #1C50DC
BRAND_BLUE_LIGHT = (94, 145, 255)   # #5E91FF
WHITE = (255, 255, 255)
SOFT_WHITE = (235, 245, 255)
INK = (15, 23, 42)
INK_SOFT = (71, 85, 105)


# ---------------------------------------------------------------------------
# Per-category glyphs — simple geometric icons drawn in PIL, not AI art.
# Each category gets 1-2 icon variants so 35 covers don't look identical.
# ---------------------------------------------------------------------------
CATEGORY_GLYPHS = {
    "organize": [
        # stack-of-pages + arrow (combine / split metaphor)
        "stack",
    ],
    "optimize": [
        # shrinking arrow + dots
        "compress",
    ],
    "convert-to": [
        # arrow into rectangle
        "convert_to",
    ],
    "convert-from": [
        # rectangle into arrow
        "convert_from",
    ],
    "edit": [
        # pen-tip on page
        "pen",
    ],
    "security": [
        # shield + lock
        "shield",
    ],
    "intelligence": [
        # sparkle / 4-pointed star
        "sparkle",
    ],
    "accessibility": [
        # ear / wave (read-aloud) and mic (dictate) variants
        "wave",
        "mic",
    ],
}


@dataclass
class GlyphSpec:
    name: str
    category: str
    """Hash of (toolSlug) → which glyph variant to draw. Keeps the same
    tool looking the same on regeneration, and gives different tools
    within the same category a chance of variation."""

    @staticmethod
    def for_tool(tool_slug: str, category: str) -> str:
        variants = CATEGORY_GLYPHS.get(category, ["stack"])
        h = int(hashlib.sha1(tool_slug.encode()).hexdigest(), 16)
        return variants[h % len(variants)]


# ---------------------------------------------------------------------------
# Font discovery — try a few likely paths for a sans-serif bold font.
# Falls back to PIL's default bitmap font (ugly but always works).
# ---------------------------------------------------------------------------
FONT_PATHS = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/SFNS.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
]


def _find_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_PATHS:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Glyph drawing — one function per variant. Each draws into the given
# ImageDraw, centered at (cx, cy) with the given size.
# ---------------------------------------------------------------------------
def _draw_glyph(draw: ImageDraw.ImageDraw, glyph: str, cx: int, cy: int, size: int):
    if glyph == "stack":
        # 3 stacked rounded rectangles, offset diagonally like a deck of papers
        w = size
        h = int(size * 0.78)
        offsets = [
            (size * 0.15, size * 0.15),    # back
            (size * 0.075, size * 0.075),  # middle
            (0, 0),                        # front
        ]
        for ox, oy in offsets:
            x0 = cx - w / 2 + ox
            y0 = cy - h / 2 + oy
            x1 = x0 + w
            y1 = y0 + h
            r = int(size * 0.08)
            draw.rounded_rectangle(
                [(x0, y0), (x1, y1)], radius=r,
                outline=WHITE, width=int(size * 0.025),
            )
    elif glyph == "compress":
        # Downward arrow + 3 horizontal bars
        arrow_w = int(size * 0.4)
        arrow_h = int(size * 0.55)
        x0 = cx - arrow_w / 2
        y0 = cy - arrow_h / 2
        # arrow body
        draw.polygon(
            [
                (cx - arrow_w * 0.25, y0),
                (cx + arrow_w * 0.25, y0),
                (cx + arrow_w * 0.25, cy - arrow_w * 0.05),
                (cx + arrow_w * 0.5, cy - arrow_w * 0.05),
                (cx, y0 + arrow_h),
                (cx - arrow_w * 0.5, cy - arrow_w * 0.05),
                (cx - arrow_w * 0.25, cy - arrow_w * 0.05),
            ],
            fill=WHITE,
        )
        # 3 small horizontal bars below
        bar_w = int(size * 0.7)
        bar_h = int(size * 0.06)
        for i in range(3):
            by = cy + arrow_h / 2 + size * 0.05 + i * (bar_h + size * 0.04)
            bx0 = cx - bar_w / 2
            draw.rounded_rectangle(
                [(bx0, by), (bx0 + bar_w, by + bar_h)],
                radius=bar_h // 2, fill=WHITE,
            )
    elif glyph == "convert_to":
        # Page + arrow pointing into it
        page_w = int(size * 0.55)
        page_h = int(size * 0.7)
        px = cx + size * 0.05
        py = cy - page_h / 2
        draw.rounded_rectangle(
            [(px, py), (px + page_w, py + page_h)],
            radius=int(size * 0.04),
            outline=WHITE, width=int(size * 0.03),
        )
        # 3 text lines inside
        line_w = page_w * 0.7
        for i in range(3):
            ly = py + page_h * (0.25 + i * 0.18)
            draw.rounded_rectangle(
                [(px + page_w * 0.15, ly), (px + page_w * 0.15 + line_w, ly + size * 0.025)],
                radius=int(size * 0.012), fill=WHITE,
            )
        # arrow into page
        ay = cy
        ax_start = cx - page_w / 2
        ax_end = px - size * 0.05
        draw.line([(ax_start, ay), (ax_end - size * 0.05, ay)], fill=WHITE, width=int(size * 0.04))
        # arrowhead
        draw.polygon(
            [
                (ax_end - size * 0.05, ay - size * 0.08),
                (ax_end + size * 0.05, ay),
                (ax_end - size * 0.05, ay + size * 0.08),
            ],
            fill=WHITE,
        )
    elif glyph == "convert_from":
        # Mirror of convert_to — page + arrow pointing out
        page_w = int(size * 0.55)
        page_h = int(size * 0.7)
        px = cx - page_w / 2 - size * 0.05
        py = cy - page_h / 2
        draw.rounded_rectangle(
            [(px, py), (px + page_w, py + page_h)],
            radius=int(size * 0.04),
            outline=WHITE, width=int(size * 0.03),
        )
        line_w = page_w * 0.7
        for i in range(3):
            ly = py + page_h * (0.25 + i * 0.18)
            draw.rounded_rectangle(
                [(px + page_w * 0.15, ly), (px + page_w * 0.15 + line_w, ly + size * 0.025)],
                radius=int(size * 0.012), fill=WHITE,
            )
        ay = cy
        ax_start = px + page_w + size * 0.05
        ax_end = cx + page_w / 2
        draw.line([(ax_start, ay), (ax_end + size * 0.05, ay)], fill=WHITE, width=int(size * 0.04))
        draw.polygon(
            [
                (ax_end + size * 0.05, ay - size * 0.08),
                (ax_end - size * 0.05, ay),
                (ax_end + size * 0.05, ay + size * 0.08),
            ],
            fill=WHITE,
        )
    elif glyph == "pen":
        # Pen / edit icon — diagonal pen body + nib
        pen_len = int(size * 0.85)
        pen_w = int(size * 0.18)
        angle = -45  # diagonal
        # We approximate with a rotated rectangle via 4 corners
        import math
        rad = math.radians(angle)
        cos_a, sin_a = math.cos(rad), math.sin(rad)
        # Pen body corners (centered at 0,0, rotated by angle)
        half_l, half_w = pen_len / 2, pen_w / 2
        corners_local = [
            (-half_l, -half_w), (half_l, -half_w), (half_l, half_w), (-half_l, half_w),
        ]
        corners = [
            (cx + x * cos_a - y * sin_a, cy + x * sin_a + y * cos_a)
            for x, y in corners_local
        ]
        draw.polygon(corners, fill=WHITE, outline=WHITE)
        # Nib — small triangle at the tip
        tip = (cx + half_l * cos_a, cy + half_l * sin_a)
        base1 = (cx + (half_l - pen_w * 1.2) * cos_a - pen_w * 0.3 * sin_a,
                 cy + (half_l - pen_w * 1.2) * sin_a + pen_w * 0.3 * cos_a)
        base2 = (cx + (half_l - pen_w * 1.2) * cos_a + pen_w * 0.3 * sin_a,
                 cy + (half_l - pen_w * 1.2) * sin_a - pen_w * 0.3 * cos_a)
        draw.polygon([tip, base1, base2], fill=BRAND_BLUE, outline=WHITE)
    elif glyph == "shield":
        # Shield outline
        sw = int(size * 0.65)
        sh = int(size * 0.8)
        sx = cx - sw / 2
        sy = cy - sh / 2
        # Approximate shield with rounded top + pointed bottom
        draw.rounded_rectangle(
            [(sx, sy), (sx + sw, sy + sh * 0.7)],
            radius=int(sw * 0.15),
            outline=WHITE, width=int(size * 0.03),
        )
        # Pointed bottom — triangle
        draw.polygon(
            [
                (sx, sy + sh * 0.55),
                (sx + sw, sy + sh * 0.55),
                (cx, sy + sh),
            ],
            fill=WHITE,
        )
        # Inner lock-ish mark (a small rounded rect)
        lock_w = sw * 0.3
        lock_h = sh * 0.18
        lx = cx - lock_w / 2
        ly = cy - lock_h / 2 - size * 0.04
        draw.rounded_rectangle(
            [(lx, ly), (lx + lock_w, ly + lock_h)],
            radius=int(lock_w * 0.15),
            fill=BRAND_BLUE,
        )
        # Lock arc (small)
        arc_r = lock_w * 0.35
        arc_top = ly - arc_r * 0.5
        draw.arc(
            [(cx - arc_r, arc_top), (cx + arc_r, arc_top + arc_r * 2)],
            start=180, end=360,
            fill=WHITE, width=int(size * 0.025),
        )
    elif glyph == "sparkle":
        # 4-pointed star (AI sparkle)
        import math
        outer = size * 0.55
        inner = size * 0.18
        pts = []
        for i in range(8):
            r = outer if i % 2 == 0 else inner
            a = math.radians(i * 45 - 90)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        draw.polygon(pts, fill=WHITE)
        # A second smaller sparkle offset for "AI"
        cx2, cy2 = cx + size * 0.35, cy - size * 0.3
        outer2 = size * 0.18
        inner2 = size * 0.05
        pts2 = []
        for i in range(8):
            r = outer2 if i % 2 == 0 else inner2
            a = math.radians(i * 45 - 90)
            pts2.append((cx2 + r * math.cos(a), cy2 + r * math.sin(a)))
        draw.polygon(pts2, fill=WHITE)
    elif glyph == "wave":
        # Sound waves emanating from a speaker icon (read aloud)
        # Speaker body (left side)
        spk_w = size * 0.18
        spk_h = size * 0.28
        spk_x = cx - size * 0.18
        spk_y = cy - spk_h / 2
        draw.polygon(
            [
                (spk_x, cy - spk_h * 0.25),
                (spk_x + spk_w, cy - spk_h * 0.5),
                (spk_x + spk_w, cy + spk_h * 0.5),
                (spk_x, cy + spk_h * 0.25),
            ],
            fill=WHITE,
        )
        # 3 wave arcs to the right
        import math
        for i, r in enumerate([size * 0.16, size * 0.28, size * 0.4]):
            cx_a = spk_x + spk_w + r * 0.5
            cy_a = cy
            bbox = [(cx_a - r, cy_a - r), (cx_a + r, cy_a + r)]
            draw.arc(bbox, start=-45, end=45, fill=WHITE, width=int(size * 0.025))
    elif glyph == "mic":
        # Microphone (dictate)
        mic_w = size * 0.25
        mic_h = size * 0.5
        mx = cx - mic_w / 2
        my = cy - mic_h / 2 - size * 0.05
        draw.rounded_rectangle(
            [(mx, my), (mx + mic_w, my + mic_h)],
            radius=int(mic_w / 2),
            fill=WHITE,
        )
        # Stand — U-shape + vertical line
        arm_r = mic_w * 0.9
        arm_top = my + mic_h * 0.7
        draw.arc(
            [(cx - arm_r, arm_top - arm_r), (cx + arm_r, arm_top + arm_r)],
            start=180, end=360,
            fill=WHITE, width=int(size * 0.04),
        )
        # Vertical stem
        stem_h = mic_h * 0.25
        draw.line(
            [(cx, arm_top + arm_r * 0.5), (cx, arm_top + arm_r * 0.5 + stem_h)],
            fill=WHITE, width=int(size * 0.04),
        )
        # Base line
        base_w = mic_w * 1.6
        draw.line(
            [(cx - base_w / 2, arm_top + arm_r * 0.5 + stem_h),
             (cx + base_w / 2, arm_top + arm_r * 0.5 + stem_h)],
            fill=WHITE, width=int(size * 0.04),
        )


def generate_cover(
    tool_name: str,
    tool_slug: str,
    category: str,
    title: str,
    out_path: str,
) -> dict[str, str]:
    """Generate a 1280x720 WebP cover image.

    Returns dict with 'alt' (the alt-text SEO description) so the
    publisher can wire it into the post.
    """
    img = Image.new("RGB", (COVER_W, COVER_H), BRAND_BLUE)
    draw = ImageDraw.Draw(img)

    # Gradient background — draw vertical bands from BRAND_BLUE_DARK at top
    # to BRAND_BLUE_LIGHT at bottom-right. Cheap gradient, looks fine at
    # the thumbnail size we display at.
    for y in range(COVER_H):
        t = y / COVER_H
        r = int(BRAND_BLUE_DARK[0] * (1 - t) + BRAND_BLUE_LIGHT[0] * t)
        g = int(BRAND_BLUE_DARK[1] * (1 - t) + BRAND_BLUE_LIGHT[1] * t)
        b = int(BRAND_BLUE_DARK[2] * (1 - t) + BRAND_BLUE_LIGHT[2] * t)
        draw.line([(0, y), (COVER_W, y)], fill=(r, g, b))

    # Subtle radial highlight — top-right corner lighter circle
    overlay = Image.new("RGBA", (COVER_W, COVER_H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    odraw.ellipse(
        [(COVER_W * 0.55, -COVER_H * 0.4),
         (COVER_W * 1.4, COVER_H * 0.7)],
        fill=(255, 255, 255, 38),
    )
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Glyph — large, centered on the left third
    glyph_name = GlyphSpec.for_tool(tool_slug, category)
    glyph_size = 320
    glyph_cx = COVER_W * 0.30
    glyph_cy = COVER_H * 0.50
    _draw_glyph(draw, glyph_name, int(glyph_cx), int(glyph_cy), glyph_size)

    # Title — large, right two-thirds. Wraps to 2 lines if needed.
    title_font = _find_font(64)
    desc_font = _find_font(34)
    tag_font = _find_font(26)

    # Word-wrap the title to max ~16 chars per line (the right column is
    # only ~620px wide at font size 64, so 16 chars ≈ 1 line).
    max_chars_per_line = 16
    words = title.split()
    lines = []
    current = ""
    for word in words:
        if not current:
            current = word
        elif len(current) + 1 + len(word) <= max_chars_per_line:
            current = current + " " + word
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    lines = lines[:3]  # cap at 3 lines max

    # Right-aligned text block starting at x=COVER_W*0.52
    text_x = int(COVER_W * 0.52)
    line_h = 76
    total_h = line_h * len(lines)
    start_y = int((COVER_H - total_h) / 2) - 30

    for i, line in enumerate(lines):
        draw.text(
            (text_x, start_y + i * line_h),
            line,
            font=title_font,
            fill=WHITE,
        )

    # Tool name + category tag below the title
    sub_y = start_y + total_h + 18
    tag_text = f"{tool_name} · {category.replace('-', ' ').title()}"
    draw.text(
        (text_x, sub_y),
        tag_text,
        font=tag_font,
        fill=SOFT_WHITE,
    )

    # "GetPDFPro · blog" wordmark in bottom-right corner
    brand_font = _find_font(22)
    draw.text(
        (COVER_W - 230, COVER_H - 44),
        "GetPDFPro · blog",
        font=brand_font,
        fill=SOFT_WHITE,
    )

    # Save as WebP — quality 82 is a sweet spot for size vs. sharpness.
    pathlib.Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "WEBP", quality=82, method=6)

    alt = (
        f"Cover for the GetPDFPro blog post on {tool_name.lower()}: "
        f"{title.replace(':', ' —')}. "
        f"Visual: blue gradient background with a white {glyph_name} glyph and the article title."
    )
    return {"alt": alt}


# ---------------------------------------------------------------------------
# CLI entry — for one-off generation / testing.
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    from topic_queue import pickNextTopic

    already_written = sys.argv[1].split(",") if len(sys.argv) > 1 else []
    topic = pickNextTopic(already_written)
    out = sys.argv[2] if len(sys.argv) > 2 else f"/tmp/cover-{topic['toolSlug']}.webp"
    info = generate_cover(
        tool_name=topic["toolName"],
        tool_slug=topic["toolSlug"],
        category=topic["category"],
        title=f"{topic['toolName']}: a 2026 guide",
        out_path=out,
    )
    print(f"Wrote {out}")
    print(f"Alt: {info['alt']}")
