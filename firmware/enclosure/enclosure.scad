// OODA Pomodoro puck — parametric 3D-printed enclosure
// =====================================================
// A two-part shell (base tray + lid) for an Adafruit ESP32 Feather V2 with a
// 3.5" TFT FeatherWing (#3651) stacked on top, an I2C rotary encoder panel-
// mounted through the front, and a buzzer. The screen faces up through a window
// in the lid.
//
// Render in OpenSCAD (F5 preview / F6 render), then export each part to STL:
//   set  part = "base"  → F6 → Export STL   (repeat for "lid")
//   or   part = "both"  to see them side by side.
//
// !!! The dimensions below are from Adafruit's published sizes and typical
// !!! stack heights. MEASURE YOUR ACTUAL PARTS and adjust before printing —
// !!! especially wing_w / wing_d / stack_h and the screen window.

part = "both";        // "base" | "lid" | "both"

/* ---- parts (MEASURE + verify, mm) ------------------------------------------ */
wing_w        = 86;   // 3.5" TFT FeatherWing PCB width  (long side)
wing_d        = 56;   // 3.5" TFT FeatherWing PCB depth  (short side)
stack_h       = 24;   // Feather + stacking headers + wing + components height

screen_w      = 74;   // visible screen window width
screen_h      = 49;   // visible screen window height
screen_off_x  = 6;    // window inset from the inner-left wall
screen_off_y  = 3.5;  // window inset from the inner-front wall

/* ---- shell ----------------------------------------------------------------- */
wall          = 2.4;  // side wall thickness
floor_t       = 2.0;  // base floor thickness
lid_t         = 2.2;  // lid top thickness
lip_h         = 5;    // lid lip that nests into the base
tol           = 0.4;  // clearance around the PCB and between mating parts
corner_r      = 3.5;  // outer corner radius
extra_h       = 6;    // headroom above the stack (cables, clearance)

/* ---- fasteners / features -------------------------------------------------- */
post_screw_d  = 3.2;  // corner screw clearance (M3)
post_od       = 8;    // corner screw post outer diameter
knob_dia      = 7.5;  // encoder threaded-bushing hole (front wall)
knob_z        = 14;   // knob center, up from the base floor
usb_w         = 13;   // USB-C slot width  (right short wall)
usb_h         = 7;    // USB-C slot height
usb_z         = 6;    // USB-C center, up from the base floor
buzz_d        = 2.2;  // buzzer vent hole diameter
$fn           = 48;

/* ---- derived --------------------------------------------------------------- */
in_w = wing_w + 2*tol;                 // inner cavity (holds the PCB stack)
in_d = wing_d + 2*tol;
in_h = stack_h + extra_h;
out_w = in_w + 2*wall;
out_d = in_d + 2*wall;

// 2D rounded rectangle centered at origin
module rrect(w, d, r) {
  hull() for (sx=[-1,1], sy=[-1,1])
    translate([sx*(w/2-r), sy*(d/2-r)]) circle(r);
}
// rounded rectangular prism, base centered on origin, grows +Z
module rprism(w, d, h, r) linear_extrude(h) rrect(w, d, r);

// corner screw posts (inside the four corners)
module posts(h, drill) {
  off_x = in_w/2 - post_od/2;
  off_y = in_d/2 - post_od/2;
  for (sx=[-1,1], sy=[-1,1]) translate([sx*off_x, sy*off_y, 0])
    difference() {
      cylinder(d=post_od, h=h);
      if (drill) translate([0,0,-1]) cylinder(d=post_screw_d, h=h+2);
    }
}

/* ---- base tray ------------------------------------------------------------- */
module base() {
  difference() {
    union() {
      // outer shell
      difference() {
        rprism(out_w, out_d, floor_t + in_h, corner_r);
        translate([0,0,floor_t]) rprism(in_w, in_d, in_h+1, max(0.5,corner_r-wall));
      }
      posts(floor_t + in_h - lip_h, false);   // solid posts (drilled below)
    }
    posts(floor_t + in_h + 1, true);          // drill the screw clearance
    // knob hole — front wall (+Y)
    translate([0, out_d/2+1, floor_t + knob_z]) rotate([90,0,0])
      cylinder(d=knob_dia, h=wall+2);
    // USB-C slot — right wall (+X)
    translate([out_w/2 - wall/2, 0, floor_t + usb_z])
      cube([wall+2, usb_w, usb_h], center=true);
    // buzzer vents — back wall (−Y), a little grid
    for (i=[-2:2]) translate([i*4, -out_d/2-1, floor_t + in_h*0.5]) rotate([90,0,0])
      cylinder(d=buzz_d, h=wall+2);
  }
}

/* ---- lid ------------------------------------------------------------------- */
module lid_final() {
  wx = -in_w/2 + screen_off_x + screen_w/2;
  wy = -in_d/2 + screen_off_y + screen_h/2;
  difference() {
    union() {
      rprism(out_w, out_d, lid_t, corner_r);
      translate([0,0,-lip_h])
        difference() {
          rprism(in_w-2*tol, in_d-2*tol, lip_h, max(0.5,corner_r-wall));
          translate([0,0,-1]) rprism(in_w-2*tol-2*wall, in_d-2*tol-2*wall, lip_h+2, 1);
        }
    }
    translate([wx, wy, -lip_h-1]) cube([screen_w, screen_h, lid_t+lip_h+2], center=true);
    // corner screw holes through the lip
    off_x = in_w/2 - post_od/2;
    off_y = in_d/2 - post_od/2;
    for (sx=[-1,1], sy=[-1,1]) translate([sx*off_x, sy*off_y, -lip_h-1])
      cylinder(d=post_screw_d, h=lid_t+lip_h+2);
  }
}

/* ---- layout ---------------------------------------------------------------- */
if (part == "base" || part == "both") base();
if (part == "lid"  || part == "both")
  translate([part=="both" ? out_w + 12 : 0, 0, 0]) lid_final();
