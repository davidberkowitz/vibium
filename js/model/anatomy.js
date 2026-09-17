/* Driver Load Path — where the twelve contacts actually are, in metres.
   Milestone 6.

   This is the first table in the project that claims PHYSICAL positions. The
   two 2D views each carry their own coordinates, and those are DRAWING
   coordinates: SVG units, tuned by eye for legibility, free to be schematic.
   That is a legitimate thing for a drawing to be. What it is not free to do is
   contradict the body.

   So this file is the physical truth and the drawings are projections of it in
   spirit rather than in code. A test asserts they do not disagree about the
   facts that matter — chiefly which side of the driver each contact is on,
   which is the one thing a schematic layout can get wrong without looking
   wrong.

   ---------------------------------------------------------------------
   Frame: ISO 8855, the same one the rest of the model uses.

       x   forward
       y   to the driver's LEFT
       z   up

   Origin is the H-POINT: the hip pivot of a seated occupant, which is the
   datum seating packages are actually built around and the point the side
   elevation already uses.

   LEFT-HAND DRIVE is assumed, and it matters. For this driver:

       +y is OUTBOARD   — the door, the seat's outer bolster, the door armrest
       -y is INBOARD    — the centre console, the knee bolster, the right foot
                          on the pedals

   The touchpoint register is what settles the ambiguous ones: the knee bolster
   is "lateral knee, CONSOLE side" so it is inboard, and the side bolster is at
   the "greater trochanter" so it is outboard. Mirror the whole table in y for a
   right-hand-drive car; nothing else changes.
*/
(function (global) {
  'use strict';

  function p(x, y, z) { return { x: x, y: y, z: z }; }

  /* THE SKELETON IS GONE, and that is the M6 gate's verdict rather than an
     oversight. A JOINTS table and a BONES list lived here: nineteen joints,
     eighteen segments, a seated driving posture with one foot on the pedals.
     It was drawn, it was tested, and at every camera angle tried it read as an
     ambiguous zigzag rather than a person — worse beside the side elevation,
     which is instantly legible, not better.

     The plan's gate warned that a procedural body would look wrong and would
     undermine numbers that are right. Substituting a stick skeleton for a mesh
     did not dodge that; it failed the same way for the same reason. What the
     view keeps is everything that is not a body: the contacts at their real
     positions, the cabin planes that locate them, and the one force vector
     with what each 2D drawing sees of it. See LEARNING.md part eight. */

  /* The twelve contacts, on the anatomy the register names for each.

     `side` is the fact the 2D drawings must not contradict:
       out    outboard, +y     in    inboard, -y     mid   on the centreline

     `normal` is the unit direction the CAR pushes the DRIVER along at that
     contact — the same convention the contact solver uses. It is stated here
     for the 3D view to draw, and it is checked against the solver's own
     channel normals rather than duplicated blindly. */
  var CONTACTS = {
    seat_pan:       { at: p(0.14,   0,     -0.05), side: 'mid' },
    seat_back:      { at: p(-0.13,  0,      0.26), side: 'mid' },
    bolster:        { at: p(0.02,   0.20,   0.06), side: 'out' },
    lap_belt:       { at: p(0.14,   0.02,   0.03), side: 'mid' },
    /* On the STERNUM, not the anchor. The register says "clavicle, sternum",
       and the contact patch straddles the centreline even though the belt's
       upper anchor is outboard at the B-pillar. Placed outboard at first, and
       the cross-view test caught it disagreeing with the plan drawing — which
       was right, because a diagonal belt is anchored outboard and lies across
       the middle of the chest. The anchor and the contact are not the same
       place and only one of them is a contact. */
    shoulder_belt:  { at: p(-0.02,  0.05,   0.36), side: 'mid' },
    wheel:          { at: p(0.40,   0,      0.32), side: 'mid' },
    pedal:          { at: p(0.86,  -0.12,  -0.26), side: 'in'  },
    footrest:       { at: p(0.80,   0.19,  -0.28), side: 'out' },
    floor:          { at: p(0.78,   0.03,  -0.32), side: 'mid' },
    head_restraint: { at: p(-0.17,  0,      0.60), side: 'mid' },
    knee_bolster:   { at: p(0.50,  -0.18,   0.04), side: 'in'  },
    armrest:        { at: p(0.18,   0.30,   0.10), side: 'out' }
  };

  /* Cabin furniture, as planes rather than geometry. Enough to locate the body
     in a car and no more: a seat pan, a seat back, a floor, a wheel. Each is a
     quad given corner-first so the 3D view can depth-sort it. */
  var PANELS = [
    { id: 'seat-pan', label: 'seat pan', quad: [
      p(-0.12, 0.26, -0.07), p(0.34, 0.26, -0.03),
      p(0.34, -0.26, -0.03), p(-0.12, -0.26, -0.07)] },
    { id: 'seat-back', label: 'seat back', quad: [
      p(-0.10, 0.26, -0.04), p(-0.22, 0.26, 0.62),
      p(-0.22, -0.26, 0.62), p(-0.10, -0.26, -0.04)] },
    { id: 'floor', label: 'floor', quad: [
      p(0.30, 0.34, -0.34), p(1.00, 0.34, -0.34),
      p(1.00, -0.34, -0.34), p(0.30, -0.34, -0.34)] }
  ];

  /* The steering wheel, as a ring in its own tilted plane. Drawn as a polygon
     so it needs no curve maths in the projector. */
  var WHEEL = { centre: p(0.44, 0, 0.30), radius: 0.18, tiltDeg: 24, segments: 28 };

  /* Body centre of mass, where the aggregate force pair is anchored — the same
     place the side elevation anchors it, lower abdomen for a seated occupant. */
  var COM = p(0.02, 0, 0.16);

  function contactAt(id) { return CONTACTS[id] ? CONTACTS[id].at : null; }
  function sideOf(id) { return CONTACTS[id] ? CONTACTS[id].side : null; }

  /* Signed y, for tests that care about which side of the driver a thing is on
     without caring how far. */
  function lateralSign(id) {
    var c = CONTACTS[id];
    if (!c) return null;
    if (Math.abs(c.at.y) < 0.06) return 0;
    return c.at.y > 0 ? 1 : -1;
  }

  global.LoadPathAnatomy = {
    CONTACTS: CONTACTS, PANELS: PANELS, WHEEL: WHEEL, COM: COM,
    contactAt: contactAt, sideOf: sideOf, lateralSign: lateralSign
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
