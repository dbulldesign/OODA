#!/usr/bin/env python3
"""OODA Pomodoro puck — laser-cut enclosure panel generator.

Emits `panels.svg`: six flat panels for a butt-joint box (glue or acrylic
cement) sized to hold an ESP32 Feather V2 + 3.5" TFT FeatherWing (#3651), an
I2C rotary encoder panel-mounted through the front, and a buzzer. All panels
are laid out on one sheet with the functional cutouts:

  top    — screen window
  front  — knob (encoder bushing) hole
  right  — USB-C slot
  back   — buzzer vent holes
  bottom / left — plain

Butt-joint sizing (panels sit between each other) gives an outer box of exactly
W x D x H with no finger-joint fitting to tune. Cut = red hairline; etched
labels = blue. VERIFY the part dimensions against your hardware before cutting.

Usage:  python3 generate_laser.py   →   panels.svg
"""

# ---- outer box (mm) — match enclosure.scad / MEASURE your parts -------------
W = 92.0     # outer width  (along the wing's long side)
D = 62.0     # outer depth
H = 34.0     # outer height (stack + headroom)
T = 3.0      # material thickness (e.g. 3 mm ply / acrylic)
KERF = 0.15  # cut kerf; holes are grown by KERF so parts drop in (informational)

# ---- feature dimensions (mm) ------------------------------------------------
SCREEN_W, SCREEN_H = 74.0, 49.0     # visible screen window
SCREEN_OFF_X, SCREEN_OFF_Y = 8.0, 6.0   # window inset from the top panel's corner
KNOB_DIA = 7.5                      # encoder threaded-bushing hole
KNOB_Z   = 15.0                     # knob center height, up from box bottom
USB_W, USB_H = 13.0, 7.0            # USB-C slot
USB_Z = 7.0                         # USB-C center height, up from box bottom
BUZZ_DIA = 2.5                      # buzzer vent hole
BUZZ_N = 7                          # vent hole count

GAP = 8.0                           # spacing between panels on the sheet
MARGIN = 10.0

CUT = 'stroke="#e02020" stroke-width="0.2" fill="none"'
ETCH = 'fill="#2060e0"'

# Butt-joint panel sizes: faces sit between one another → outer = W x D x H.
PANELS = {
    "bottom": (W, D),
    "top":    (W, D),
    "front":  (W, H - 2 * T),
    "back":   (W, H - 2 * T),
    "left":   (D - 2 * T, H - 2 * T),
    "right":  (D - 2 * T, H - 2 * T),
}


def rect(x, y, w, h):
    return f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" {CUT}/>'


def circle(cx, cy, d):
    return f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{(d + KERF)/2:.2f}" {CUT}/>'


def slot(cx, cy, w, h):
    return f'<rect x="{cx-w/2:.2f}" y="{cy-h/2:.2f}" width="{w+KERF:.2f}" height="{h+KERF:.2f}" rx="1.5" {CUT}/>'


def label(x, y, s):
    return f'<text x="{x:.2f}" y="{y:.2f}" font-family="sans-serif" font-size="4" {ETCH}>{s}</text>'


def feature_paths(name, ox, oy, w, h):
    """Cutouts + label for a panel whose top-left is at (ox, oy)."""
    out = [label(ox + 2, oy + 5, name)]
    if name == "top":
        out.append(rect(ox + SCREEN_OFF_X, oy + SCREEN_OFF_Y, SCREEN_W, SCREEN_H))
    elif name == "front":
        # knob hole: centered in X, KNOB_Z up from the BOTTOM of the box.
        out.append(circle(ox + w / 2, oy + (h - KNOB_Z), KNOB_DIA))
    elif name == "right":
        out.append(slot(ox + w / 2, oy + (h - USB_Z), USB_W, USB_H))
    elif name == "back":
        y = oy + h / 2
        x0 = ox + w / 2 - (BUZZ_N - 1) * 2.0
        out += [circle(x0 + i * 4.0, y, BUZZ_DIA) for i in range(BUZZ_N)]
    return out


def main():
    # Lay panels out in rows, wrapping to keep the sheet reasonable.
    items = list(PANELS.items())
    x = MARGIN
    y = MARGIN
    row_h = 0.0
    sheet_w = 0.0
    body = []
    max_row_w = W * 2 + GAP * 3  # allow two wide panels per row

    for name, (w, h) in items:
        if x + w > MARGIN + max_row_w and x > MARGIN:
            x = MARGIN
            y += row_h + GAP
            row_h = 0.0
        body.append(f'<g>{rect(x, y, w, h)}{"".join(feature_paths(name, x, y, w, h))}</g>')
        x += w + GAP
        row_h = max(row_h, h)
        sheet_w = max(sheet_w, x)

    sheet_h = y + row_h + MARGIN
    sheet_w += MARGIN

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{sheet_w:.1f}mm" '
        f'height="{sheet_h:.1f}mm" viewBox="0 0 {sheet_w:.1f} {sheet_h:.1f}">',
        f'<!-- OODA puck enclosure — {W:.0f}x{D:.0f}x{H:.0f}mm, {T:.0f}mm material. '
        f'Red = cut, blue = etch. Verify dimensions before cutting. -->',
        "".join(body),
        "</svg>",
    ]
    with open("panels.svg", "w") as f:
        f.write("\n".join(svg))
    print(f"wrote panels.svg  ({sheet_w:.0f} x {sheet_h:.0f} mm, {len(items)} panels)")


if __name__ == "__main__":
    main()
