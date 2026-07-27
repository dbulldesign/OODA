# OODA puck — enclosures

Two ways to make a case for the puck (ESP32 Feather V2 + 3.5″ TFT FeatherWing +
I²C rotary encoder + buzzer): a **3D-printed** two-part shell and a **laser-cut**
flat-panel box. Both are parametric — the defaults come from Adafruit's published
sizes, but **measure your actual parts and adjust** before you commit material.

```
firmware/enclosure/
├── enclosure.scad          # 3D-printed base + lid (OpenSCAD)
├── laser/generate_laser.py # laser panel generator (Python)
└── laser/panels.svg        # generated panels (regenerate after edits)
```

## What it houses

- **Feather V2 + 3.5″ TFT wing**, stacked, screen facing out the top.
- **Rotary encoder**, panel-mounted through a hole in the front (its threaded
  bushing + nut clamp it; wire it to the Feather's STEMMA QT port).
- **Buzzer**, behind vent holes.
- **USB-C** reachable through a slot in one side.

## Dimensions to verify (both designs share these)

| Value | Default (mm) | What it is |
|---|---|---|
| `wing_w` × `wing_d` | 86 × 56 | TFT FeatherWing PCB footprint |
| `stack_h` | 24 | Feather + headers + wing + parts, stacked |
| `screen_w` × `screen_h` | 74 × 49 | visible screen window |
| `knob_dia` | 7.5 | encoder bushing hole |
| `usb_w` × `usb_h` | 13 × 7 | USB-C slot |

Outer size lands around **92 × 62 × 34 mm**. Put calipers on your boards first —
the wing footprint and stack height are the ones that bite.

## 3D print — `enclosure.scad`

1. Open in [OpenSCAD](https://openscad.org/). Edit the parameters at the top.
2. `part = "both"` previews base + lid side by side. Set `part = "base"` then F6
   then *File → Export → STL*; repeat with `part = "lid"`.
3. Slice and print (PLA/PETG). No supports needed if the lid prints window-down
   and the base prints open-side up. 0.2 mm layers, 3 perimeters is plenty.
4. The lid nests into the base with a lip and is held by four M3 screws into the
   corner posts. The encoder mounts through the front knob hole; USB-C exits the
   right wall; buzzer vents are on the back.

## Laser cut — `laser/panels.svg`

1. (Optional) edit the dimensions at the top of `generate_laser.py`, then
   `python3 generate_laser.py` to regenerate `panels.svg`.
2. Open `panels.svg` in your laser software. **Red hairlines = cut**, **blue =
   etch** (the panel labels). Remap those to your cutter's layers/colors.
3. Cut from 3 mm ply or acrylic (set `T` to your real thickness).

The panels are sized for **butt joints** — the faces sit between one another so
the assembled box is exactly the outer size, with no finger-joint fitting to
tune. Glue the edges (wood glue for ply, acrylic cement for acrylic); painter's
tape as clamps while it sets. Assemble bottom → four walls → drop the electronics
in → top last.

> Butt joints keep the first cut foolproof. If you'd rather have snap-together
> finger joints, tell me your material thickness and kerf and I'll switch the
> generator over — that style always needs a test cut to dial in the fit.

## Caveat

These are unbuilt, parametric designs generated from published dimensions — they
have **not** been test-fit against physical hardware. Print/cut one test piece
(or a quick draft of just the lid window + knob hole) and adjust the parameters
before committing to a full enclosure.
