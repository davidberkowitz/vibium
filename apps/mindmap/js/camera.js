/* Cameras for both views, plus the blend that lets one morph into the other.

   The flat camera is a pan/zoom over the 2D layout. The spatial camera orbits
   the origin and projects the 3D layout with perspective. Screen positions are
   interpolated between the two, so switching views is a single animated value
   rather than two renderers fighting over the canvas. */
(function (global) {
  'use strict';

  function Camera2D() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
  }

  Camera2D.prototype.project = function (p, w, h) {
    return {
      x: (p.x - this.x) * this.zoom + w / 2,
      y: (p.y - this.y) * this.zoom + h / 2,
      s: this.zoom
    };
  };

  Camera2D.prototype.unproject = function (sx, sy, w, h) {
    return {
      x: (sx - w / 2) / this.zoom + this.x,
      y: (sy - h / 2) / this.zoom + this.y
    };
  };

  function Camera3D() {
    this.yaw = 0.6;
    this.pitch = -0.35;
    this.dist = 1400;
    this.focal = 1000;
  }

  Camera3D.prototype.rotate = function (p) {
    var cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    var rx = p.x * cy + (p.z || 0) * sy;
    var rz = -p.x * sy + (p.z || 0) * cy;
    return {
      x: rx,
      y: p.y * cp - rz * sp,
      z: p.y * sp + rz * cp
    };
  };

  /* Turn a camera-space direction back into world space — used for dragging a
     node along the plane that faces the viewer. */
  Camera3D.prototype.unrotate = function (v) {
    var cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    var rx = v.x;
    var ry = v.y * cp + v.z * sp;
    var rz = -v.y * sp + v.z * cp;
    return {
      x: rx * cy - rz * sy,
      y: ry,
      z: rx * sy + rz * cy
    };
  };

  Camera3D.prototype.basis = function () {
    return {
      right: this.unrotate({ x: 1, y: 0, z: 0 }),
      up: this.unrotate({ x: 0, y: 1, z: 0 })
    };
  };

  Camera3D.prototype.project = function (p, w, h) {
    var r = this.rotate(p);
    var depth = r.z + this.dist;
    var near = 60;
    var s = this.focal / Math.max(near, depth);
    return {
      x: r.x * s + w / 2,
      y: r.y * s + h / 2,
      s: s,
      depth: depth,
      behind: depth < near
    };
  };

  Camera3D.prototype.orbit = function (dx, dy) {
    var limit = Math.PI / 2 - 0.05;
    this.yaw += dx * 0.006;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch + dy * 0.006));
  };

  Camera3D.prototype.dolly = function (factor) {
    this.dist = Math.max(220, Math.min(9000, this.dist * factor));
  };

  /* Blend the two projections. t = 0 is pure 2D, t = 1 is pure 3D. */
  function blend(cam2, cam3, node, t, w, h) {
    var flat = cam2.project(node.p2, w, h);
    if (t <= 0) return { x: flat.x, y: flat.y, s: flat.s, depth: 0, fog: 1, behind: false };
    var deep = cam3.project(node.p3, w, h);
    if (t >= 1) return { x: deep.x, y: deep.y, s: deep.s, depth: deep.depth, fog: fogOf(deep, cam3), behind: deep.behind };
    return {
      x: flat.x + (deep.x - flat.x) * t,
      y: flat.y + (deep.y - flat.y) * t,
      s: flat.s + (deep.s - flat.s) * t,
      depth: deep.depth * t,
      fog: 1 + (fogOf(deep, cam3) - 1) * t,
      behind: deep.behind && t > 0.9
    };
  }

  /* Nodes further from the camera fade out; that depth cue is what makes the
     spatial view readable without any shading. */
  function fogOf(projected, cam3) {
    var span = cam3.dist * 1.4;
    var f = 1 - (projected.depth - cam3.dist * 0.6) / span;
    return Math.max(0.3, Math.min(1, f));
  }

  global.Cameras = {
    Camera2D: Camera2D,
    Camera3D: Camera3D,
    blend: blend
  };
})(typeof window !== 'undefined' ? window : globalThis);
