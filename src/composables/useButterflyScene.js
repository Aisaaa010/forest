export function mountButterflyScene(root) {
  let rafId = 0;
  let destroyed = false;
  let resizeHandler = null;
  let gl = null;
  const timeouts = [];
'use strict';

  /* ================= Config: edit to customize ================= */
  var CONFIG = {
    startSpecies: 0,        // 0 monarch, 1 morpho, 2 swallowtail, 3 aurora (imagined)
    startPerched: false,    // begin resting on the flower
    wingSpan: 2.6,          // length of one wing in world units
    pollen: 130             // floating motes
  };

  var $ = function (s) { return root.querySelector(s); };
  var rnd = Math.random, PI2 = Math.PI * 2;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= Species (palette + wing painting) ================= */
  var FORE = 'M20 300C28 150 180 26 470 22C710 14 880 82 916 172C944 240 850 306 720 334C560 366 300 356 20 300Z';
  function HIND(tail) {
    return tail ? 'M20 300C220 338 520 360 700 372C830 386 850 480 785 552C765 575 745 590 745 642C710 652 668 624 628 604C560 608 480 596 440 585C300 545 120 455 20 300Z'
                : 'M20 300C220 338 520 360 700 372C830 386 850 480 780 555C710 632 560 628 440 585C300 545 120 455 20 300Z';
  }
  var LW = 1024, LH = 704, B0 = [34, 300];
  var SPECIES = [
    { name: 'Monarch', latin: 'Danaus plexippus', a: '#ffae2b', b: '#ec6a0c', c: '#b83a06', sw: 'linear-gradient(135deg,#ffae2b,#b83a06)', trail: [1, .65, .25], glow: .05, tail: false, seed: 11,
      bg: ['#ffd9a0', '#e07a3f', '#2b1722'],
      fx: { iri: 0, iriA: 0, spark: .35, glow: .25, glowC: [1, .55, .15], gloss: 90, nspark: 5000 } },
    { name: 'Blue morpho', latin: 'Morpho menelaus', a: '#7be0ff', b: '#2f78f2', c: '#0d2c9a', sw: 'linear-gradient(135deg,#7be0ff,#0d2c9a)', trail: [.4, .8, 1], glow: .18, tail: false, seed: 23,
      bg: ['#9be7e1', '#1f7f8f', '#07202b'],
      fx: { iri: .85, iriA: .52, spark: 1, glow: .35, glowC: [.3, .7, 1], gloss: 200, nspark: 9000 } },
    { name: 'Swallowtail', latin: 'Papilio machaon', a: '#fff08a', b: '#ffd23a', c: '#e8a315', sw: 'linear-gradient(135deg,#fff08a,#e8a315)', trail: [1, .95, .5], glow: .05, tail: true, seed: 37,
      bg: ['#f4f7b8', '#8bbf6a', '#1e3b2a'],
      fx: { iri: .12, iriA: .1, spark: .4, glow: .25, glowC: [.4, .7, 1], gloss: 110, nspark: 5000 } },
    { name: 'Aurora', latin: 'Imagined · Lepidoptera luminosa', a: '#ff8be0', b: '#8a63ff', c: '#27d9d0', sw: 'linear-gradient(135deg,#ff8be0,#27d9d0)', trail: [1, .55, .95], glow: .12, tail: true, seed: 53,
      bg: ['#d9b8ff', '#6a46c9', '#150d33'],
      fx: { iri: .7, iriA: 0, spark: 1.15, glow: 1, glowC: [.45, 1, .85], gloss: 160, nspark: 6000 } }
  ];

  /* --- painting kit --- */
  function mkRng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var NS = 'http://www.w3.org/2000/svg';
  function wingPath(tail) { var P = new Path2D(FORE); P.addPath(new Path2D(HIND(tail))); return P; }
  var FV = [[460, 34], [610, 40], [760, 66], [860, 118], [892, 178], [830, 250], [700, 296], [560, 318]];
  function HV(tail) { return tail ? [[690, 366], [785, 425], [770, 520], [740, 625], [640, 600], [570, 592], [440, 568], [300, 525], [190, 470]] : [[690, 366], [785, 425], [770, 520], [690, 585], [570, 592], [440, 568], [300, 525], [190, 470]]; }
  function qctl(e) { return [e[0] * .52 + 16, e[1] * .55 + 135]; }
  function qpt(e, t) { var q = qctl(e), u = 1 - t; return [u * u * B0[0] + 2 * u * t * q[0] + t * t * e[0], u * u * B0[1] + 2 * u * t * q[1] + t * t * e[1]]; }
  function vpath(e, t0, n) { var a = []; n = n || 20; for (var k = 0; k <= n; k++) a.push(qpt(e, t0 + (1 - t0) * k / n)); return a; }
  function veinLine(c, pts, w, col) {
    c.strokeStyle = col; c.lineCap = 'round';
    for (var i = 1; i < pts.length; i++) { c.lineWidth = Math.max(.6, w * (1 - .5 * i / pts.length)); c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
  }
  function eachVein(tail, fn) {
    [FV, HV(tail)].forEach(function (S, wi) { S.forEach(function (e, i) {
      fn(vpath(e, 0), 1);
      if (i < S.length - 1) {
        var n = S[i + 1], a = qpt(e, .5 + .07 * (i % 3)), m = [(e[0] + n[0]) / 2, (e[1] + n[1]) / 2], pts = [];
        for (var k = 0; k <= 10; k++) { var t = k / 10; pts.push([a[0] + (m[0] - a[0]) * t, a[1] + (m[1] - a[1]) * t + Math.sin(t * 3.14) * 5]); }
        fn(pts, .5);
        [.45, .68, .84].forEach(function (tt) {
          var p = qpt(e, tt), q = qpt(n, tt), cp = [(p[0] + q[0]) / 2 + 5, (p[1] + q[1]) / 2 + 2], xs = [];
          for (var k2 = 0; k2 <= 8; k2++) { var u = k2 / 8, v = 1 - u; xs.push([v * v * p[0] + 2 * u * v * cp[0] + u * u * q[0], v * v * p[1] + 2 * u * v * cp[1] + u * u * q[1]]); }
          fn(xs, .3);
        });
      }
    }); });
  }
  function veinsAll(c, tail, w, col, hi) {
    eachVein(tail, function (pts, k) { veinLine(c, pts, w * k, col); });
    if (hi) eachVein(tail, function (pts, k) { c.save(); c.translate(-1, -1.2); veinLine(c, pts, w * k * .35, hi); c.restore(); });
  }
  function veinGlow(c, tail, w, col) { eachVein(tail, function (pts, k) { if (k > .45) veinLine(c, pts, w * k, col); }); }
  var EDGE = {};
  function edgeSamples(tail) {
    var key = tail ? 1 : 0; if (EDGE[key]) return EDGE[key]; var out = [];
    [[FORE, 450, 170, 0], [HIND(tail), 480, 470, 1]].forEach(function (q) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', q[0]); var L = p.getTotalLength();
      for (var l = 0; l < L; l += 2) {
        var pt = p.getPointAtLength(l); if (pt.x < 190) continue;
        if (!q[3] && pt.y > 290 && pt.x < 700) continue; if (q[3] && pt.y < 372 && pt.x < 660) continue;
        var dx = q[1] - pt.x, dy = q[2] - pt.y, dl = Math.hypot(dx, dy) || 1; out.push({ x: pt.x, y: pt.y, nx: dx / dl, ny: dy / dl, k: q[3] });
      }
    }); return EDGE[key] = out;
  }
  function edgeDots(c, R, tail, col, rmin, rmax, step, inset, shape) {
    var E = edgeSamples(tail), s = Math.max(1, Math.round(step / 2)); c.fillStyle = col;
    for (var i = 0; i < E.length; i += s) {
      var e = E[i], x = e.x + e.nx * inset, y = e.y + e.ny * inset, r = rmin + R() * (rmax - rmin); c.beginPath();
      if (shape === 'lune') c.ellipse(x, y, r * 1.5, r * .8, Math.atan2(e.ny, e.nx), 0, PI2); else c.arc(x, y, r, 0, PI2); c.fill();
    }
  }
  function fringe(c, tail, colA, colB, len, seg) {
    var E = edgeSamples(tail); c.lineWidth = 3.4; c.lineCap = 'butt';
    for (var i = 0; i < E.length; i++) { var e = E[i]; c.strokeStyle = Math.floor(i / seg) % 2 ? colA : colB; c.beginPath(); c.moveTo(e.x - e.nx * 1, e.y - e.ny * 1); c.lineTo(e.x + e.nx * len, e.y + e.ny * len); c.stroke(); }
  }
  function border(c, P, col, w, blur) { c.save(); c.lineJoin = 'round'; c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = blur; c.lineWidth = w * 2; c.stroke(P); c.restore(); }
  function ocellus(c, x, y, r, rings, glow) {
    c.save(); if (glow) { c.shadowColor = glow; c.shadowBlur = r * .8; }
    rings.forEach(function (rg) { var g = c.createRadialGradient(x - r * .1, y - r * .1, 0, x, y, r * rg[0]); g.addColorStop(0, rg[1]); g.addColorStop(1, rg[2] || rg[1]); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * rg[0], 0, PI2); c.fill(); c.shadowBlur = 0; });
    c.restore(); c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(x - r * .16, y - r * .2, r * .13, r * .08, -.6, 0, PI2); c.fill();
  }
  function scales(c, R, o) {
    var ds = o.step || 7, tints = o.tints || [], a0 = o.a || .12, row = 0;
    for (var r = 36; r < 960; r += ds * .78, row++) {
      var n = Math.max(8, Math.floor(2.95 * r / ds));
      for (var k = 0; k <= n; k++) {
        var th = -1.65 + (k + (row % 2) * .5) / n * 2.95 + (R() - .5) * .01, cs = Math.cos(th), sn = Math.sin(th), x = B0[0] + r * cs + (R() - .5) * 2, y = B0[1] + r * sn + (R() - .5) * 2;
        if (x < 0 || x > LW || y < 0 || y > LH) continue;
        var a = a0 * (.3 + R() * .8), u = R();
        c.fillStyle = u < .42 ? 'rgba(0,0,0,' + a + ')' : u < .84 || !tints.length ? 'rgba(255,255,255,' + a * .85 + ')' : tints[(R() * tints.length) | 0].replace('A', a * 1.8);
        c.beginPath(); c.ellipse(x, y, ds * .9, ds * .56, th + (R() - .5) * .3, 0, PI2); c.fill();
        c.fillStyle = 'rgba(255,255,255,' + a * .5 + ')'; c.beginPath(); c.ellipse(x + cs * ds * .45, y + sn * ds * .45, ds * .4, ds * .22, th, 0, PI2); c.fill();
      }
    }
  }
  function furRoot(c, R, a) {
    var f = c.createRadialGradient(20, 300, 0, 20, 300, 250); f.addColorStop(0, 'rgba(18,10,8,' + a + ')'); f.addColorStop(1, 'rgba(18,10,8,0)'); c.fillStyle = f; c.fillRect(0, 0, LW, LH);
    c.lineCap = 'round';
    for (var i = 0; i < 700; i++) { var th = -1.6 + R() * 2.9, r = 30 + R() * R() * 230, x = B0[0] + r * Math.cos(th), y = B0[1] + r * Math.sin(th); c.strokeStyle = 'rgba(' + (R() < .5 ? '40,26,18' : '210,190,160') + ',' + (.06 + R() * .12) + ')'; c.lineWidth = .8 + R() * .9; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(th) * (8 + R() * 14), y + Math.sin(th) * (8 + R() * 14)); c.stroke(); }
  }
  function ribbons(c, R, tail, cols, w, blur, n) {
    var S = FV.concat(HV(tail)); c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var e = S[(R() * S.length) | 0], ph = R() * 6, amp = 12 + R() * 22, fq = 5 + R() * 6, pts = [];
      for (var k = 0; k <= 30; k++) { var t = .12 + .88 * k / 30, p = qpt(e, t), q = qpt(e, Math.min(1, t + .02)), dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, o = Math.sin(t * fq + ph) * amp * t; pts.push([p[0] - dy / l * o, p[1] + dx / l * o]); }
      c.shadowColor = cols[i % cols.length]; c.shadowBlur = blur; veinLine(c, pts, w * (.6 + R() * .8), cols[i % cols.length]);
    } c.restore();
  }
  function stars(c, R, n, col, link, rmax) {
    var pts = [], x, y; c.save(); c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < n; i++) { x = 50 + R() * 880; y = 24 + R() * 620; var big = R() < .06, r = big ? 2.2 + R() * 2 : .7 + R() * 1.5; c.fillStyle = col.replace('A', .35 + R() * .6); c.beginPath(); c.arc(x, y, r, 0, PI2); c.fill(); if (big) { c.shadowColor = 'rgba(255,240,200,1)'; c.shadowBlur = 9; c.fill(); c.shadowBlur = 0; pts.push([x, y]); } }
    if (link) { c.strokeStyle = 'rgba(255,235,170,.38)'; c.lineWidth = 1.1; for (var a = 0; a < pts.length; a++) for (var b = a + 1; b < pts.length; b++) if (Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]) < (rmax || 90)) { c.beginPath(); c.moveTo(pts[a][0], pts[a][1]); c.lineTo(pts[b][0], pts[b][1]); c.stroke(); } }
    c.restore();
  }
  function wavy(c, R, rs, col, w, amp, th0, th1) {
    c.strokeStyle = col; c.lineWidth = w; c.beginPath();
    for (var k = 0; k <= 80; k++) { var th = th0 + (th1 - th0) * k / 80, r = rs + Math.sin(k * .55 + rs) * amp + Math.sin(k * 1.9) * amp * .4; var x = B0[0] + r * Math.cos(th), y = B0[1] + r * Math.sin(th); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
  }
  function wash(c, x, y, r, col0, col1) { var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col0); g.addColorStop(1, col1 || 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }

  /* --- species artwork: [top, underside] each {pre, tints, a, post} --- */
  var ART = [
    [ { // Monarch top
        pre: function (c, R, s) { eachVein(s.tail, function (p, k) { if (k > .9) veinLine(c, p, 34, 'rgba(120,30,0,.13)'); }); wash(c, 520, 190, 280, 'rgba(255,225,130,.22)'); wash(c, 480, 470, 220, 'rgba(255,215,120,.18)'); wash(c, 860, 140, 240, 'rgba(110,26,0,.22)'); },
        tints: ['rgba(255,170,40,A)', 'rgba(160,40,0,A)'], a: .06,
        post: function (c, R, s, P) {
          veinsAll(c, false, 8, '#160d0b', 'rgba(255,255,255,.16)'); border(c, P, '#150e0d', 20, 22);
          c.fillStyle = '#ff9d33'; [[800, 92, 11], [838, 128, 9], [862, 168, 10], [776, 130, 8], [820, 190, 8], [740, 90, 7], [850, 214, 6]].forEach(function (d) { c.beginPath(); c.ellipse(d[0], d[1], d[2], d[2] * .7, -.5, 0, PI2); c.fill(); });
          edgeDots(c, R, false, '#fff7ea', 4, 8, 22, 15); edgeDots(c, R, false, '#fff7ea', 2.5, 4.5, 44, 40);
          c.fillStyle = '#150e0d'; c.beginPath(); c.arc(310, 372, 17, 0, PI2); c.fill(); fringe(c, false, '#fff7ea', '#1a110e', 7, 7); furRoot(c, R, .9); } },
      { // Monarch under
        pre: function (c, R, s) { wash(c, 800, 120, 300, 'rgba(255,240,170,.6)'); wash(c, 520, 470, 300, 'rgba(255,232,160,.38)'); wash(c, 120, 300, 260, 'rgba(255,190,90,.4)'); },
        tints: ['rgba(255,230,150,A)', 'rgba(210,120,30,A)'], a: .055,
        post: function (c, R, s, P) {
          veinsAll(c, false, 5.5, '#25160f', 'rgba(255,255,255,.2)'); border(c, P, '#150e0d', 13, 18);
          edgeDots(c, R, false, '#fff7ea', 5, 9, 20, 17); edgeDots(c, R, false, '#fff7ea', 2.5, 4.5, 40, 44); edgeDots(c, R, false, '#fff7ea', 1.5, 2.6, 20, 62);
          fringe(c, false, '#fff7ea', '#1a110e', 7, 7); furRoot(c, R, .55); } } ],
    [ { // Morpho top
        pre: function (c, R, s) {
          c.save(); c.globalCompositeOperation = 'screen'; var g = c.createLinearGradient(100, 40, 800, 600); g.addColorStop(0, 'rgba(120,255,255,.6)'); g.addColorStop(.45, 'rgba(60,140,255,.04)'); g.addColorStop(1, 'rgba(160,90,255,.45)'); c.fillStyle = g; c.fillRect(0, 0, LW, LH);
          c.lineCap = 'round';
          for (var i = 0; i < 110; i++) { var th = -1.2 + R() * 2.1, r = 500 + R() * 460; c.strokeStyle = (i % 3 ? 'rgba(120,235,255,' : 'rgba(170,110,255,') + (.04 + R() * .1) + ')'; c.lineWidth = 3 + R() * 16; c.beginPath(); c.moveTo(B0[0] + 40 * Math.cos(th), B0[1] + 40 * Math.sin(th)); c.lineTo(B0[0] + r * Math.cos(th + (R() - .5) * .1), B0[1] + r * Math.sin(th)); c.stroke(); }
          c.restore(); },
        tints: ['rgba(120,240,255,A)', 'rgba(150,110,255,A)'], a: .07,
        post: function (c, R, s, P) {
          veinsAll(c, false, 4.5, 'rgba(6,16,80,.6)', 'rgba(160,230,255,.22)');
          wash(c, 905, 110, 250, 'rgba(6,8,30,.92)', 'rgba(6,8,30,0)'); c.lineCap = 'round';
          [[.5, -.52, -.12, 9], [.56, -.46, -.18, 6], [.6, -.4, -.22, 4]].forEach(function (b, i) { c.strokeStyle = 'rgba(235,250,255,' + (.8 - i * .2) + ')'; c.lineWidth = b[3]; c.beginPath(); c.arc(B0[0], B0[1], 820 + i * 22, b[1], b[2]); c.stroke(); });
          border(c, P, '#1d120c', 15, 16); edgeDots(c, R, false, '#f4fbff', 2.5, 5, 26, 12); edgeDots(c, R, false, '#f4fbff', 1.4, 2.4, 26, 26);
          fringe(c, false, '#f4fbff', '#1a110e', 6, 6); furRoot(c, R, .75); } },
      { // Morpho under (bark brown with eyespots)
        pre: function (c, R, s, P) {
          for (var i = 0; i < 8; i++) { var r = 190 + i * 90; wavy(c, R, r, 'rgba(32,16,7,.5)', 5, 9, -1.55, 1.2); wavy(c, R, r + 7, 'rgba(232,205,160,.38)', 2.4, 9, -1.55, 1.2); }
          c.save(); c.lineJoin = 'round'; c.strokeStyle = 'rgba(226,192,140,.35)'; c.lineWidth = 120; c.stroke(P); c.restore(); },
        tints: ['rgba(200,150,90,A)', 'rgba(40,20,10,A)'], a: .065,
        post: function (c, R, s, P) {
          veinsAll(c, false, 4.5, 'rgba(34,16,8,.65)', 'rgba(255,230,190,.2)'); border(c, P, '#2a180d', 12, 14);
          [[590, 170, 26], [706, 128, 17], [596, 520, 30], [480, 508, 21], [352, 452, 16]].forEach(function (o) { ocellus(c, o[0], o[1], o[2], [[1, '#3a2412'], [.86, '#ecd9a8'], [.64, '#5b3416'], [.33, '#150b05']]); });
          edgeDots(c, R, false, '#f2dfb8', 2.4, 5, 28, 13); fringe(c, false, '#f2dfb8', '#2a180d', 6, 6); furRoot(c, R, .6); } } ],
    [ { // Swallowtail top
        pre: function (c, R, s) { wash(c, 560, 190, 300, 'rgba(255,250,200,.35)'); wash(c, 500, 470, 240, 'rgba(255,240,150,.25)'); wash(c, 80, 300, 300, 'rgba(0,0,0,.5)'); },
        tints: ['rgba(255,240,120,A)', 'rgba(220,150,20,A)'], a: .055,
        post: function (c, R, s, P) {
          veinsAll(c, true, 15, '#14110d', 'rgba(255,240,150,.22)'); border(c, P, '#14110d', 25, 22);
          edgeDots(c, R, true, '#ffe04a', 8, 12, 56, 44, 'lune'); edgeDots(c, R, true, '#4aa8ff', 6, 9, 58, 72, 'lune'); edgeDots(c, R, true, '#ffe04a', 1.1, 2.4, 6, 20);
          ocellus(c, 662, 500, 36, [[1, '#14110d'], [.78, '#ff8a1f', '#ffb04a'], [.38, '#14110d']]);
          c.fillStyle = '#ffd84a'; c.beginPath(); c.ellipse(722, 626, 12, 20, .15, 0, PI2); c.fill(); fringe(c, true, '#ffe04a', '#14110d', 7, 7); furRoot(c, R, .8); } },
      { // Swallowtail under
        pre: function (c, R, s) { wash(c, 560, 200, 320, 'rgba(255,255,230,.5)'); wash(c, 90, 300, 260, 'rgba(240,170,40,.35)'); },
        tints: ['rgba(255,250,200,A)', 'rgba(240,160,40,A)'], a: .05,
        post: function (c, R, s, P) {
          veinsAll(c, true, 8, '#2a2118', 'rgba(255,255,255,.28)'); border(c, P, '#1d1710', 17, 16);
          edgeDots(c, R, true, '#ffcf3a', 8, 11, 48, 40, 'lune'); edgeDots(c, R, true, '#ff9a2a', 8, 12, 56, 62, 'lune'); edgeDots(c, R, true, '#4aa8ff', 5, 8, 56, 84, 'lune');
          ocellus(c, 650, 496, 40, [[1, '#14110d'], [.82, '#ff8a1f', '#ffb04a'], [.52, '#4aa8ff'], [.3, '#14110d']]);
          fringe(c, true, '#fff3a0', '#1a1510', 7, 7); furRoot(c, R, .55); } } ],
    [ { // Aurora top
        pre: function (c, R, s) { c.fillStyle = 'rgba(14,6,40,.34)'; c.fillRect(0, 0, LW, LH); ribbons(c, R, true, ['rgba(60,255,220,.55)', 'rgba(255,120,220,.55)', 'rgba(255,225,130,.45)'], 30, 26, 18); },
        tints: ['rgba(255,225,150,A)', 'rgba(120,255,235,A)'], a: .055,
        post: function (c, R, s, P) {
          veinsAll(c, true, 5, 'rgba(255,255,255,.55)', 'rgba(150,255,245,.4)'); border(c, P, '#1d1033', 20, 20);
          edgeDots(c, R, true, '#ffd36a', 3, 7, 24, 15);
          stars(c, R, 480, 'rgba(255,225,150,A)', true, 92);
          ocellus(c, 640, 150, 74, [[1, '#1d1033'], [.82, '#ffd36a', '#ff9d3a'], [.62, '#27d9d0', '#5b7bff'], [.34, '#14082a']], 'rgba(255,200,120,.9)');
          ocellus(c, 600, 470, 54, [[1, '#1d1033'], [.82, '#ffd36a', '#ff9d3a'], [.6, '#ff8be0', '#8a63ff'], [.32, '#14082a']], 'rgba(255,150,230,.9)');
          fringe(c, true, '#ffd36a', '#1d1033', 7, 7); furRoot(c, R, .7); } },
      { // Aurora under (nebula night sky)
        pre: function (c, R, s) {
          var cols = ['rgba(255,90,200,.5)', 'rgba(40,230,220,.45)', 'rgba(120,80,255,.55)'];
          c.save(); c.globalCompositeOperation = 'screen'; for (var i = 0; i < 16; i++) wash(c, 80 + R() * 860, 30 + R() * 620, 120 + R() * 190, cols[i % 3]); c.restore();
          for (var k = 0; k < 6; k++) wavy(c, R, 260 + k * 110, 'rgba(255,255,255,.09)', 3, 14, -1.6, 1.2); },
        tints: ['rgba(255,150,230,A)', 'rgba(90,240,235,A)'], a: .045,
        post: function (c, R, s, P) {
          c.save(); c.shadowColor = 'rgba(120,255,240,.9)'; c.shadowBlur = 10; veinGlow(c, true, 4.5, 'rgba(150,255,245,.75)'); c.restore(); border(c, P, '#0b0620', 17, 18);
          edgeDots(c, R, true, '#ff9be8', 3, 6, 26, 15); stars(c, R, 420, 'rgba(255,235,190,A)', true, 100);
          ocellus(c, 640, 150, 52, [[1, '#0b0620'], [.8, '#27d9d0', '#5b7bff'], [.55, '#ff8be0', '#8a63ff'], [.28, '#0b0620']], 'rgba(120,255,240,.9)');
          ocellus(c, 600, 470, 40, [[1, '#0b0620'], [.8, '#ffd36a', '#ff9d3a'], [.5, '#8a63ff'], [.28, '#0b0620']], 'rgba(255,210,120,.9)');
          fringe(c, true, '#ff9be8', '#0b0620', 7, 7); furRoot(c, R, .6); } } ]
  ];
  /* data texture: R = glitter, G = glow, B = gloss */
  function paintData(c, R, s, P, i) {
    c.save(); c.fillStyle = 'rgb(0,0,' + s.fx.gloss + ')'; c.fillRect(0, 0, LW, LH); c.globalCompositeOperation = 'lighter';
    for (var k = 0; k < s.fx.nspark; k++) { var th = -1.6 + R() * 2.9, r = 50 + R() * 900, x = B0[0] + r * Math.cos(th), y = B0[1] + r * Math.sin(th); c.fillStyle = 'rgb(' + ((90 + R() * 165) | 0) + ',0,0)'; c.beginPath(); c.arc(x, y, .9 + R() * 2.1, 0, PI2); c.fill(); }
    c.lineJoin = 'round';
    if (i === 3) {
      ribbons(c, R, true, ['rgb(0,150,0)', 'rgb(0,110,0)'], 30, 16, 14);
      c.fillStyle = 'rgb(0,230,0)'; for (var q = 0; q < 140; q++) { c.beginPath(); c.arc(50 + R() * 880, 24 + R() * 620, .8 + R() * 2, 0, PI2); c.fill(); }
      [[640, 150, 74], [600, 470, 54]].forEach(function (o) { c.strokeStyle = 'rgb(0,190,0)'; c.lineWidth = 7; c.beginPath(); c.arc(o[0], o[1], o[2] * .72, 0, PI2); c.stroke(); });
      c.shadowBlur = 0; edgeDots(c, R, true, 'rgb(0,200,0)', 3, 7, 24, 15);
    } else if (i === 1) {
      c.strokeStyle = 'rgb(0,120,0)'; c.lineWidth = 8; c.beginPath(); c.arc(B0[0], B0[1], 820, -.52, -.12); c.stroke(); edgeDots(c, R, false, 'rgb(0,150,0)', 2.5, 5, 26, 12);
      wash(c, 400, 250, 320, 'rgba(0,70,0,1)'); wash(c, 480, 470, 220, 'rgba(0,60,0,1)');
    } else if (i === 2) {
      edgeDots(c, R, true, 'rgb(0,120,0)', 6, 9, 58, 72, 'lune'); edgeDots(c, R, true, 'rgb(0,80,0)', 8, 12, 56, 44, 'lune');
    } else { wash(c, 780, 140, 220, 'rgba(0,90,0,1)'); edgeDots(c, R, false, 'rgb(0,100,0)', 4, 7, 22, 15); }
    c.restore(); c.globalCompositeOperation = 'destination-in'; c.fillStyle = '#000'; c.fill(P);
  }
  var TQ = Math.min(innerWidth, innerHeight) < 700 ? .5 : 1, TW = 2048 * TQ, TH = 1024 * TQ;
  function paintLayer(s, which, i) {
    var cv = document.createElement('canvas'); cv.width = TW; cv.height = TH; var c = cv.getContext('2d'), R = mkRng(s.seed * 7 + which * 131);
    c.scale(TW / LW, TH / LH); var P = wingPath(s.tail), A = ART[i][which];
    var stops = which === 0 ? [s.a, s.b, s.c] : [['#ffd58a', '#f3a93a', '#d98015'], ['#a1703f', '#6e4423', '#3a2112'], ['#fff9c8', '#fbe06a', '#f0b43a'], ['#1b0f44', '#2a1a7a', '#0e5a6a']][i];
    var g = c.createRadialGradient(30, 300, 10, 560, 300, 820); g.addColorStop(0, stops[0]); g.addColorStop(.5, stops[1]); g.addColorStop(1, stops[2]); c.fillStyle = g; c.fillRect(0, 0, LW, LH);
    A.pre(c, R, s, P); scales(c, R, { step: 7, a: A.a, tints: A.tints }); A.post(c, R, s, P); c.globalCompositeOperation = 'destination-in'; c.fillStyle = '#000'; c.fill(P); return cv;
  }
  function paintDataTex(s, i) {
    var cv = document.createElement('canvas'); cv.width = TW / 2; cv.height = TH / 2; var c = cv.getContext('2d'); c.scale(cv.width / LW, cv.height / LH);
    paintData(c, mkRng(s.seed * 3 + 5), s, wingPath(s.tail), i); return cv;
  }

  /* ================= Tiny math ================= */
  var M4 = {
    id: function () { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
    mul: function (a, b) { var o = new Float32Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
    T: function (x, y, z) { var m = M4.id(); m[12] = x; m[13] = y; m[14] = z; return m; },
    S: function (x, y, z) { var m = M4.id(); m[0] = x; m[5] = y; m[10] = z; return m; },
    Rx: function (a) { var c = Math.cos(a), s = Math.sin(a), m = M4.id(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
    Ry: function (a) { var c = Math.cos(a), s = Math.sin(a), m = M4.id(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
    Rz: function (a) { var c = Math.cos(a), s = Math.sin(a), m = M4.id(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
    persp: function (f, a, n, fa) { var t = 1 / Math.tan(f / 2), m = new Float32Array(16); m[0] = t / a; m[5] = t; m[10] = (fa + n) / (n - fa); m[11] = -1; m[14] = 2 * fa * n / (n - fa); return m; },
    look: function (e, c, u) {
      var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
      var xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
      var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
    },
    pt: function (m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
  };
  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function sm(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  /* ================= Geometry builders ================= */
  function Geo() { return { p: [], n: [], c: [], u: [], i: [] }; }
  function lathe(prof, segs, colFn) {   // axis = +Z; prof = [[z, r], ...]
    var g = Geo(), K = prof.length;
    for (var k = 0; k < K; k++) {
      var z = prof[k][0], r = prof[k][1], pz = prof[Math.max(0, k - 1)], nz = prof[Math.min(K - 1, k + 1)], dr = (nz[1] - pz[1]) / ((nz[0] - pz[0]) || 1e-4);
      for (var s = 0; s <= segs; s++) {
        var a = s / segs * PI2, ca = Math.cos(a), sa = Math.sin(a), nl = Math.hypot(1, dr);
        g.p.push(r * ca, r * sa, z); g.n.push(ca / nl, sa / nl, -dr / nl); g.u.push(s / segs, k / (K - 1)); var cc = colFn(k / (K - 1), s / segs, z, r); g.c.push(cc[0], cc[1], cc[2]);
      }
    }
    for (var k2 = 0; k2 < K - 1; k2++) for (var s2 = 0; s2 < segs; s2++) { var a = k2 * (segs + 1) + s2, b = a + 1, c2 = a + segs + 1, d = c2 + 1; g.i.push(a, c2, b, b, c2, d); }
    return g;
  }
  function ellipsoid(rx, ry, rz, segs, colFn) {
    var prof = []; for (var k = 0; k <= 14; k++) { var t = k / 14 * Math.PI; prof.push([-Math.cos(t) * rz, Math.max(.0008, Math.sin(t))]); }
    var g = lathe(prof, segs, colFn || function () { return [1, 1, 1]; });
    for (var i = 0; i < g.p.length; i += 3) { g.p[i] *= rx; g.p[i + 1] *= ry; var nx = g.n[i] / rx, ny = g.n[i + 1] / ry, nz = g.n[i + 2] / rz, l = Math.hypot(nx, ny, nz); g.n[i] = nx / l; g.n[i + 1] = ny / l; g.n[i + 2] = nz / l; }
    return g;
  }
  function tube(pts, rad, segs, col) {
    var g = Geo(), K = pts.length;
    for (var k = 0; k < K; k++) {
      var a = pts[Math.max(0, k - 1)], b = pts[Math.min(K - 1, k + 1)], tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2], tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
      var rx = Math.abs(ty) > .9 ? 1 : 0, ry = rx ? 0 : 1, n1x = ty * 0 - tz * ry, n1y = tz * rx - tx * 0, n1z = tx * ry - ty * rx, l1 = Math.hypot(n1x, n1y, n1z); n1x /= l1; n1y /= l1; n1z /= l1;
      var n2x = ty * n1z - tz * n1y, n2y = tz * n1x - tx * n1z, n2z = tx * n1y - ty * n1x, r = typeof rad === 'function' ? rad(k / (K - 1)) : rad;
      for (var s = 0; s <= segs; s++) { var an = s / segs * PI2, ca = Math.cos(an), sa = Math.sin(an), nx = ca * n1x + sa * n2x, ny = ca * n1y + sa * n2y, nz = ca * n1z + sa * n2z;
        g.p.push(pts[k][0] + nx * r, pts[k][1] + ny * r, pts[k][2] + nz * r); g.n.push(nx, ny, nz); g.u.push(0, 0); g.c.push(col[0], col[1], col[2]); }
    }
    for (var k2 = 0; k2 < K - 1; k2++) for (var s2 = 0; s2 < segs; s2++) { var a2 = k2 * (segs + 1) + s2, b2 = a2 + 1, c2 = a2 + segs + 1, d2 = c2 + 1; g.i.push(a2, c2, b2, b2, c2, d2); }
    return g;
  }
  function inv3t(m) {   // inverse-transpose of the upper 3x3 (column-major 4x4 in)
    var a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
    var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g), G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d, det = a * A + b * B + c * C || 1;
    return [A / det, B / det, C / det, D / det, E / det, F / det, G / det, H / det, I / det];
  }
  function add(dst, src, M) {
    var base = dst.p.length / 3, N = inv3t(M || M4.id()); M = M || M4.id();
    for (var i = 0; i < src.p.length; i += 3) {
      var q = M4.pt(M, src.p[i], src.p[i + 1], src.p[i + 2]); dst.p.push(q[0], q[1], q[2]);
      var nx = src.n[i], ny = src.n[i + 1], nz = src.n[i + 2], x = N[0] * nx + N[3] * ny + N[6] * nz, y = N[1] * nx + N[4] * ny + N[7] * nz, z = N[2] * nx + N[5] * ny + N[8] * nz, l = Math.hypot(x, y, z) || 1;
      dst.n.push(x / l, y / l, z / l); dst.c.push(src.c[i], src.c[i + 1], src.c[i + 2]);
    }
    for (var j = 0; j < src.u.length; j++) dst.u.push(src.u[j]);
    for (var k = 0; k < src.i.length; k++) dst.i.push(src.i[k] + base);
  }

  /* ================= WebGL plumbing ================= */
  var canvas = $('#gl'); gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl');
  if (!gl) { $('#nogl').style.display = 'grid'; return; }
  function prog(vs, fs) {
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p: p, u: u };
  }
  var MESH = prog(
    'attribute vec3 aPos,aNor,aCol;attribute vec2 aUv;uniform mat4 uVP,uM;varying vec3 vN,vC,vW;varying vec2 vUv;' +
    'void main(){vec4 w=uM*vec4(aPos,1.);vW=w.xyz;vN=mat3(uM)*aNor;vC=aCol;vUv=aUv;gl_Position=uVP*w;}',
    'precision highp float;varying vec3 vN,vC,vW;varying vec2 vUv;uniform sampler2D uTex,uTexU,uData;uniform vec4 uColor;uniform float uUseTex,uVC,uAlpha,uTrans,uEmis,uShine,uSpec,uRim,uTwo,uWing,uTime,uIri,uIriA,uSpark,uGlow;uniform vec3 uGlowC,uCol2;' +
    'uniform vec3 uL,uLC,uSky,uGnd,uCam,uRimC,uL2;' +
    'void main(){vec3 n=normalize(vN),V=normalize(uCam-vW);float fa=dot(n,V);vec4 b,dt=vec4(0.);if(uWing>.5){vec4 t0=texture2D(uTex,vUv),t1=texture2D(uTexU,vUv);dt=texture2D(uData,vUv);b=fa>=0.?t0:t1;}else b=uUseTex>.5?texture2D(uTex,vUv):uColor;if(uVC>1.5)b.rgb=mix(uColor.rgb,uCol2,vC.r)*vC.g;if(b.a<uAlpha)discard;vec3 base=pow(b.rgb,vec3(2.2));if(uVC>.5&&uVC<1.5)base*=pow(vC,vec3(2.2));' +
    'float fr=1.-abs(fa);if(uWing>.5){vec3 ir=.5+.5*cos(6.2832*(vec3(0.,.33,.67)+fr*1.4+uIriA));float sat=max(base.r,max(base.g,base.b))-min(base.r,min(base.g,base.b));base=mix(base,base*(.35+1.7*ir),uIri*smoothstep(.02,.45,sat)*(.3+.7*fr));}' +
    'if(uTwo>.5&&fa<0.)n=-n;' +
    'float d=max(dot(n,uL),0.),tr=max(dot(-n,uL),0.)*uTrans,d2=max(dot(n,uL2),0.)*.35;vec3 amb=mix(uGnd,uSky,n.y*.5+.5);' +
    'vec3 col=base*(amb+uLC*(d+tr)+vec3(.9,.6,.8)*d2)+base*uEmis;' +
    'col+=pow(1.-abs(dot(n,V)),3.)*uRim*uRimC;vec3 H=normalize(uL+V);col+=pow(max(dot(n,H),0.),uShine)*uSpec*uLC*(1.+dt.b*2.);' +
    'if(uWing>.5){float tw=pow(max(0.,sin(uTime*3.+dt.r*60.+vUv.x*40.)),24.);col+=uSpark*dt.r*tw*(.4+fr)*vec3(1.,.97,.9);col+=dt.g*uGlow*(.65+.35*sin(uTime*1.6+vUv.x*5.+vUv.y*3.))*uGlowC;}' +
    'col=col/(1.+col*.18);gl_FragColor=vec4(pow(col,vec3(1./2.2)),1.);}');
  var PTS = prog(
    'attribute vec3 aPos,aCol;attribute float aSize;uniform mat4 uVP;uniform float uScale,uMax;varying vec3 vC;' +
    'void main(){gl_Position=uVP*vec4(aPos,1.);gl_PointSize=clamp(aSize*uScale/gl_Position.w,1.,uMax);vC=aCol*smoothstep(1.5,5.,gl_Position.w);}',
    'precision mediump float;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5)*2.;float a=1.-smoothstep(0.,1.,d);a*=a;gl_FragColor=vec4(vC*a,a);}');

  function buf(data, dyn) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); return b; }
  function mesh(g, dyn) {
    var m = { pos: new Float32Array(g.p), nor: new Float32Array(g.n), col: new Float32Array(g.c), uv: new Float32Array(g.u.length ? g.u : g.p.length / 3 * 2), count: g.i.length };
    m.bp = buf(m.pos, dyn); m.bn = buf(m.nor, dyn); m.bc = buf(m.col); m.bu = buf(m.uv);
    m.bi = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.bi); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(g.i), gl.STATIC_DRAW); return m;
  }
  function attr(loc, b, n) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); }
  var aLoc = { pos: gl.getAttribLocation(MESH.p, 'aPos'), nor: gl.getAttribLocation(MESH.p, 'aNor'), col: gl.getAttribLocation(MESH.p, 'aCol'), uv: gl.getAttribLocation(MESH.p, 'aUv') };
  var pLoc = { pos: gl.getAttribLocation(PTS.p, 'aPos'), col: gl.getAttribLocation(PTS.p, 'aCol'), size: gl.getAttribLocation(PTS.p, 'aSize') };

  var anis = gl.getExtension('EXT_texture_filter_anisotropic');
  function texture(cv, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit); var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (anis) gl.texParameterf(gl.TEXTURE_2D, anis.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anis.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); return t;
  }

  /* ================= The butterfly model ================= */
  var BODY = (function () {
    var g = Geo(), gA = [Geo(), Geo()], gB = Geo(), dark = [.13, .08, .06], brown = [.24, .14, .09], pale = [.62, .55, .48], white = [.95, .92, .86];
    var seed = 7; function r01() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    // abdomen (own mesh so it can wag): segmented, with pale side dots
    var RP = [[0, .004], [.06, .03], [.2, .062], [.4, .08], [.6, .084], [.84, .075], [1, .05]], prof = [];
    for (var k = 0; k <= 40; k++) { var t = k / 40, i = 0; while (i < RP.length - 2 && t > RP[i + 1][0]) i++; var a = RP[i], b = RP[i + 1], u = clamp((t - a[0]) / (b[0] - a[0]), 0, 1); u = u * u * (3 - 2 * u); var rr = a[1] + (b[1] - a[1]) * u; rr *= 1 - .07 * Math.pow(Math.abs(Math.cos(t * 13 * Math.PI)), 7); prof.push([-1.38 + t * 1.24, rr]); }
    add(gB, lathe(prof, 22, function (t, s) { var seg = t * 13, f = seg % 1, band = Math.floor(seg) % 2, side = Math.abs(s - .5) < .045 || s < .045 || s > .955; if (side && f > .28 && f < .72 && t > .1) return white; return band ? mix(dark, pale, .26) : mix(dark, brown, .4); }));
    // thorax + fur
    add(g, ellipsoid(.15, .17, .28, 22, function (k, s, z) { return mix(dark, brown, .5 + .5 * Math.sin(z * 50)); }), M4.T(0, .01, .1));
    for (var q = 0; q < 70; q++) {
      var th = r01() * PI2, ph = (r01() - .5) * 2.6, ex = .15 * Math.cos(th) * Math.cos(ph), ey = .17 * Math.sin(th) * Math.cos(ph) , ez = .28 * Math.sin(ph) * .9;
      var nx = ex / .15, ny = ey / .17, nz = ez / .28, nl = Math.hypot(nx, ny, nz) || 1, L = .045 + r01() * .04;
      var p0 = [ex, ey + .01, ez + .1]; add(g, tube([p0, [p0[0] + nx / nl * L * .6, p0[1] + ny / nl * L * .6, p0[2] + nz / nl * L * .6 - .008], [p0[0] + nx / nl * L, p0[1] + ny / nl * L, p0[2] + nz / nl * L - .02]], function (t) { return .0065 * (1 - t * .8); }, 4, r01() < .3 ? pale : mix(brown, pale, .25)));
    }
    [[.07, -.1], [-.07, -.1], [.075, .1], [-.075, .1], [.05, .22], [-.05, .22]].forEach(function (d) { var y = .01 + .17 * Math.sqrt(Math.max(0, 1 - Math.pow(d[0] / .15, 2) - Math.pow(d[1] / .28, 2))); add(g, ellipsoid(.024, .016, .024, 8, function () { return white; }), M4.T(d[0], y - .002, .1 + d[1])); });
    [1, -1].forEach(function (sd) { add(g, ellipsoid(.075, .055, .09, 10, function () { return mix(brown, pale, .2); }), M4.T(sd * .085, .045, .16)); });
    // head, eyes with highlights, palps, coiled proboscis
    add(g, ellipsoid(.1, .1, .1, 18, function () { return dark; }), M4.T(0, .02, .46));
    [1, -1].forEach(function (sd) {
      add(g, ellipsoid(.056, .06, .054, 14, function () { return [.01, .01, .012]; }), M4.T(sd * .078, .045, .5));
      add(g, ellipsoid(.012, .012, .01, 6, function () { return [1, 1, 1]; }), M4.T(sd * .09, .082, .535));
      add(g, ellipsoid(.018, .02, .05, 8, function () { return pale; }), M4.T(sd * .035, -.025, .56));
    });
    var pr = []; for (var c = 0; c <= 26; c++) { var a2 = c * .5, rr2 = .05 * (1 - c / 32); pr.push([0, -.055 + rr2 * Math.sin(a2) * .9, .6 + rr2 * Math.cos(a2)]); }
    add(g, tube(pr, .0055, 5, [.28, .2, .12]));
    // antennae (own meshes so they sway) with banding via a pale ring pair
    [1, -1].forEach(function (sd, si) {
      var ga = gA[si], pts = []; for (var k2 = 0; k2 <= 14; k2++) { var t2 = k2 / 14; pts.push([sd * (.04 + .62 * t2 * t2 + .1 * t2), .06 + .5 * Math.sin(t2 * 1.5) * .8 + .1 * t2, .52 + 1.2 * t2]); }
      add(ga, tube(pts, function (t) { return .014 - .005 * t; }, 6, dark));
      [.3, .5, .7].forEach(function (tt) { var pi = Math.round(tt * 14), pp = pts[pi]; add(ga, ellipsoid(.017, .017, .012, 6, function () { return pale; }), M4.T(pp[0], pp[1], pp[2])); });
      var e = pts[pts.length - 1]; add(ga, ellipsoid(.034, .034, .08, 10, function () { return dark; }), M4.T(e[0], e[1], e[2] + .02));
      // legs: hip, knee, ankle, foot
      [[.17, .5], [.1, .15], [.02, -.2]].forEach(function (Lg, li) { var z0 = Lg[0], s0 = Lg[1];
        var lp = [[sd * .06, -.1, z0], [sd * (.17 + li * .03), -.2, z0 + s0 * .28], [sd * (.3 + li * .04), -.4, z0 + s0 * .5], [sd * (.34 + li * .04), -.54, z0 + s0 * .5 - .05]];
        add(g, tube(lp, function (t) { return .013 - .006 * t; }, 5, dark)); add(g, ellipsoid(.012, .012, .03, 6, function () { return dark; }), M4.mul(M4.T(lp[3][0], lp[3][1] - .01, lp[3][2]), M4.Rx(.5)));
      });
      add(g, tube([[sd * .05, -.08, .4], [sd * .09, -.18, .46], [sd * .07, -.25, .53]], .008, 4, mix(dark, pale, .2)));
    });
    return { body: mesh(g), abd: mesh(gB), ant: [mesh(gA[0]), mesh(gA[1])] };
  })();

  var Wd = CONFIG.wingSpan, NX = 48, NY = 34;
  var WING = (function () {
    var g = Geo(); g.base = [];
    for (var j = 0; j <= NY; j++) for (var i = 0; i <= NX; i++) {
      var cx = i / NX * 1024, cy = (1 - j / NY) * LH, x = (cx - 20) / 1024 * Wd, z = (300 - cy) / 1024 * Wd;
      g.p.push(x, 0, z); g.n.push(0, 1, 0); g.u.push(cx / 1024, 1 - cy / LH); g.c.push(1, 1, 1); g.base.push(x, z);
    }
    for (var j2 = 0; j2 < NY; j2++) for (var i2 = 0; i2 < NX; i2++) { var a = j2 * (NX + 1) + i2, b = a + 1, c = a + NX + 1, d = c + 1; g.i.push(a, b, c, b, d, c); }
    var m = mesh(g, true); m.base = new Float32Array(g.base); return m;
  })();
  function deformWing(lag, camber, flutter) {
    var P = WING.pos, B = WING.base, Nn = WING.nor, W = NX + 1;
    for (var k = 0, n = B.length / 2; k < n; k++) {
      var x = B[k * 2], z = B[k * 2 + 1], u = Math.max(0, x / Wd), h = clamp(.5 - z / Wd * 1.2, 0, 1);
      P[k * 3] = x; P[k * 3 + 2] = z;
      P[k * 3 + 1] = -lag.v * Wd * u * u * (1 + .35 * h) * Math.cos(lag.p + h * .7) + camber * Wd * u * (1 - u * .55) * (.35 + .65 * (1 - h)) + flutter * Math.sin(u * 9 + z * 6 + lag.p * 2) * .02 * Wd * u;
    }
    for (var j = 0; j <= NY; j++) for (var i = 0; i <= NX; i++) {
      var i0 = Math.max(0, i - 1), i1 = Math.min(NX, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(NY, j + 1), a = (j * W + i0) * 3, b = (j * W + i1) * 3, c = (j0 * W + i) * 3, d = (j1 * W + i) * 3;
      var dx = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], dz = [P[d] - P[c], P[d + 1] - P[c + 1], P[d + 2] - P[c + 2]];
      var nx = dz[1] * dx[2] - dz[2] * dx[1], ny = dz[2] * dx[0] - dz[0] * dx[2], nz = dz[0] * dx[1] - dz[1] * dx[0], l = Math.hypot(nx, ny, nz) || 1, o = (j * W + i) * 3;
      Nn[o] = nx / l; Nn[o + 1] = ny / l; Nn[o + 2] = nz / l;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, WING.bp); gl.bufferSubData(gl.ARRAY_BUFFER, 0, P); gl.bindBuffer(gl.ARRAY_BUFFER, WING.bn); gl.bufferSubData(gl.ARRAY_BUFFER, 0, Nn);
  }

  /* ================= Flowers: one open daisy + buds of five kinds that bloom when clicked ================= */
  var FBASE = -2.9, FTOP = .2;
  var PAL = [[1, .42, .68], [1, .62, .25], [.68, .52, 1], [.42, .74, 1], [1, .3, .36], [1, .84, .28], [.98, .93, .9]];
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function gridGeo(nu, nt, fn, cf) {
    var g = Geo(), P = [], W = nu + 1, i, j;
    for (j = 0; j <= nt; j++) for (i = 0; i <= nu; i++) { var u = -1 + 2 * i / nu, t = j / nt, p = fn(u, t), c = cf(u, t); P.push(p); g.p.push(p[0], p[1], p[2]); g.c.push(c[0], c[1], c[2]); g.u.push(i / nu, j / nt); }
    for (j = 0; j <= nt; j++) for (i = 0; i <= nu; i++) {
      var a = P[j * W + Math.max(i - 1, 0)], b = P[j * W + Math.min(i + 1, nu)], c2 = P[Math.max(j - 1, 0) * W + i], d = P[Math.min(j + 1, nt) * W + i];
      var du = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], dt = [d[0] - c2[0], d[1] - c2[1], d[2] - c2[2]];
      var nx = dt[1] * du[2] - dt[2] * du[1], ny = dt[2] * du[0] - dt[0] * du[2], nz = dt[0] * du[1] - dt[1] * du[0], l = Math.hypot(nx, ny, nz); if (l < 1e-6) { nx = 0; ny = 1; nz = 0; l = 1; } g.n.push(nx / l, ny / l, nz / l);
    }
    for (j = 0; j < nt; j++) for (i = 0; i < nu; i++) { var q = j * W + i; g.i.push(q, q + 1, q + W, q + 1, q + W + 1, q + W); }
    return g;
  }
  function petalGeo(o) {
    return mesh(gridGeo(8, 18, function (u, t) {
      var wd = o.wid * o.shape(t), x = u * wd, y = o.cup * u * u * (.25 + .75 * t) * o.wid + o.bend * t * t * o.len - .025 * (1 - Math.abs(u)) * Math.min(1, t * 4) + (o.ruffle ? o.ruffle * Math.sin(t * 11 + u * 4) * t * t * .05 * Math.abs(u) : 0);
      return [x + (o.twist || 0) * t * t * o.wid, y, o.len * t - (o.notch || 0) * Math.pow(t, 9) * (1 - Math.abs(u)) * .12];
    }, function (u, t) {
      var vein = Math.pow(.5 + .5 * Math.cos(u * (o.veins || 5) * Math.PI), 5), gg = (1 - .17 * vein * (.35 + .65 * t)) * (.66 + .34 * sstep(0, .4, t));
      return [clamp(t * .88 + .3 * Math.pow(Math.abs(u), 2.2), 0, 1), gg, 0];
    }));
  }
  var sinp = function (a, e, b) { return function (t) { return Math.pow(Math.max(0, Math.sin(Math.PI * clamp(b + (1 - b) * Math.pow(t, a), 0, 1))), e) + .001; }; };
  var PT = {
    daisy: petalGeo({ len: 1.15, wid: .2, shape: sinp(.8, .7, .03), cup: .3, bend: -.1, veins: 5 }),
    cosmos: petalGeo({ len: 1.0, wid: .3, shape: sinp(.85, .5, 0), cup: .4, bend: .04, notch: 1, ruffle: 1, veins: 7 }),
    rose: petalGeo({ len: .8, wid: .42, shape: sinp(1, .42, .12), cup: .95, bend: .22, veins: 4 }),
    lily: petalGeo({ len: 1.3, wid: .26, shape: sinp(.9, .95, 0), cup: .3, bend: -.32, twist: .15, veins: 3 }),
    tulip: petalGeo({ len: 1.0, wid: .4, shape: sinp(1, .5, .08), cup: .85, bend: .14, veins: 6 }),
    sepal: petalGeo({ len: .75, wid: .13, shape: sinp(.8, 1.1, 0), cup: .5, bend: .08, veins: 2 })
  };
  var CAL = mesh(ellipsoid(.2, .17, .26, 12, function (k) { return mix([.1, .3, .15], [.22, .52, .27], k); }));
  /* flower centres */
  function nubs(g, n, R, hgt, col0, col1, sz) { for (var i = 0; i < n; i++) { var r = R * Math.sqrt((i + .5) / n), a = i * 2.39996, y = hgt * Math.sqrt(Math.max(0, 1 - Math.pow(r / R, 2) * .9)), k = r / R; add(g, ellipsoid(sz, sz * .9, sz, 5, function () { return mix(col0, col1, k); }), M4.T(Math.cos(a) * r, y, Math.sin(a) * r)); } }
  function stamens(g, n, r0, len, lift, filC, antC, antL, spread) {
    for (var i = 0; i < n; i++) { var a = i / n * PI2 + .3, ca = Math.cos(a), sa = Math.sin(a), pts = []; for (var k = 0; k <= 6; k++) { var t = k / 6; pts.push([ca * (r0 + len * t * spread), lift * Math.sin(t * 1.6) + .02, sa * (r0 + len * t * spread)]); }
      add(g, tube(pts, .008, 4, filC)); var e = pts[6]; add(g, ellipsoid(antL * .35, antL * .35, antL, 6, function () { return antC; }), M4.mul(M4.T(e[0], e[1], e[2]), M4.mul(M4.Ry(-a + Math.PI / 2), M4.Rx(-.5)))); }
  }
  var CEN = {};
  (function () {
    var g = Geo(); add(g, ellipsoid(.34, .15, .34, 16, function () { return [.42, .24, .05]; })); nubs(g, 130, .31, .12, [.98, .8, .15], [.78, .42, .06], .034); CEN.daisy = mesh(g);
    g = Geo(); add(g, ellipsoid(.17, .08, .17, 12, function () { return [.9, .65, .1]; })); nubs(g, 26, .15, .06, [1, .85, .2], [.85, .55, .08], .03); stamens(g, 12, .05, .2, .12, [.9, .8, .3], [1, .85, .15], .04, 1); CEN.cosmos = mesh(g);
    g = Geo(); add(g, ellipsoid(.1, .09, .1, 10, function () { return [.85, .8, .25]; })); nubs(g, 18, .09, .08, [1, .9, .3], [.9, .6, .15], .022); CEN.rose = mesh(g);
    g = Geo(); add(g, tube([[0, 0, 0], [.02, .3, .05], [.1, .62, .12], [.2, .75, .15]], .018, 6, [.55, .75, .35])); stamens(g, 6, .03, .55, .55, [.88, .88, .72], [.55, .22, .1], .06, 1); CEN.lily = mesh(g);
    g = Geo(); add(g, ellipsoid(.05, .05, .2, 8, function () { return [.45, .65, .25]; }), M4.T(0, .12, 0)); stamens(g, 6, .06, .3, .25, [.9, .9, .7], [.18, .1, .12], .045, .6); CEN.tulip = mesh(g);
  })();
  var KIND = {
    daisy: { rad: .26, cy: .1, cal: .8, lay: [{ m: 'daisy', n: 16, c: 1.4, o: .06, L: 1, w: 1, off: 0, y: 0 }, { m: 'daisy', n: 14, c: 1.34, o: .2, L: .9, w: .95, off: .22, y: .015 }, { m: 'daisy', n: 10, c: 1.25, o: .45, L: .55, w: .85, off: .4, y: .03 }] },
    cosmos: { rad: .1, cy: .05, cal: .9, lay: [{ m: 'cosmos', n: 8, c: 1.4, o: .1, L: 1, w: 1, off: 0, y: 0 }, { m: 'cosmos', n: 8, c: 1.35, o: .22, L: .88, w: .95, off: .39, y: .02 }] },
    rose: { rad: .05, cy: .02, cal: 1.1, lay: [{ m: 'rose', n: 5, c: 1.45, o: .42, L: 1.15, w: 1, off: 0, y: 0 }, { m: 'rose', n: 6, c: 1.4, o: .58, L: 1, w: 1, off: .5, y: .02 }, { m: 'rose', n: 6, c: 1.3, o: .76, L: .82, w: .95, off: .2, y: .04 }, { m: 'rose', n: 5, c: 1.2, o: .95, L: .62, w: .9, off: .9, y: .06 }, { m: 'rose', n: 4, c: 1.1, o: 1.1, L: .42, w: .85, off: .4, y: .08 }] },
    lily: { rad: .04, cy: .04, cal: .5, lay: [{ m: 'lily', n: 3, c: 1.4, o: .3, L: 1, w: 1, off: 0, y: 0 }, { m: 'lily', n: 3, c: 1.4, o: .38, L: 1, w: 1.12, off: 1.047, y: .02 }] },
    tulip: { rad: .05, cy: .02, cal: 1, lay: [{ m: 'tulip', n: 3, c: 1.3, o: .6, L: 1, w: 1, off: 0, y: 0 }, { m: 'tulip', n: 3, c: 1.3, o: .68, L: 1, w: 1.05, off: 1.047, y: .02 }, { m: 'tulip', n: 3, c: 1.2, o: .5, L: .9, w: .9, off: .5, y: .035 }] }
  };
  var LEAF = { geo: gridGeo(6, 16, function (u, t) {
    var wd = .16 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, .75))), .8) + .002; return [t, .11 * Math.sin(t * 1.4) - .12 * t * t * t + .05 * Math.abs(u) * wd * 6, u * wd];
  }, function (u, t) {
    var v = Math.abs(Math.cos((t * 7 + Math.abs(u) * 1.6) * Math.PI)) > .93 ? .13 : 0, mid = Math.abs(u) < .09 ? .2 : 0, b = mix([.08, .26, .13], [.2, .5, .25], t * .55 + Math.abs(u) * .35);
    return [b[0] + v + mid, b[1] + v * 1.3 + mid * 1.2, b[2] + v * .6 + mid * .5];
  }) };
  function buildStem(lean, H, size) {
    var g = Geo(), green = [.13, .38, .2], stem = [];
    for (var k = 0; k <= 12; k++) { var t = k / 12; stem.push([Math.sin(t * 2.4) * lean, H * t, Math.sin(t * 3.1 + lean * 9) * lean * .25]); }
    add(g, tube(stem, function (t) { return (.06 - .02 * t) * (.55 + .45 * size); }, 8, green));
    [[1, 0, .26], [-1, .5, .42], [1, 2.3, .58], [-1, 2.9, .12]].forEach(function (Lf) { var lf = (.35 + .65 * size) * (Lf[2] < .2 ? 1.2 : 1) * 1.15, x = Math.sin(Lf[2] * 2.4) * lean, y = H * Lf[2];
      add(g, LEAF.geo, M4.mul(M4.T(x, y, 0), M4.mul(M4.Ry((Lf[0] < 0 ? Math.PI : 0) + Lf[1] * (Lf[0] < 0 ? -1 : 1) * .6), M4.mul(M4.Rz(.5), M4.S(lf * 1.2, lf * 1.2, lf * 1.2))))); });
    return mesh(g);
  }
  var FL = [{ kind: 'daisy', x: 0, z: 0, H: FTOP - FBASE, lean: .08, size: 1, nod: 0, rot: 0, ph: 0, open: 1, tgt: 1, ci: 0 }];
  (function () {
    var sd = 91, kinds = ['rose', 'cosmos', 'lily', 'tulip', 'daisy', 'cosmos', 'rose', 'tulip'];
    function r() { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }
    var tries = 0, n = 0;
    while (n < 38 && tries++ < 4000) {
      var a = r() * PI2, rr = 1.5 + 5.4 * Math.sqrt(r()), x = Math.cos(a) * rr, z = Math.sin(a) * rr * .9, ok = true;
      for (var i = 0; i < FL.length; i++) if (Math.hypot(FL[i].x - x, FL[i].z - z) < (i ? .95 : 1.5)) { ok = false; break; }
      if (!ok) continue;
      FL.push({ kind: kinds[(r() * kinds.length) | 0], x: x, z: z, H: .8 + r() * 1.6, lean: (r() - .5) * .5, size: .5 + r() * .24, nod: .45, rot: r() * PI2, ph: r() * 6, open: 0, tgt: 0, ci: (r() * PAL.length) | 0 }); n++;
    }
  })();
  FL.forEach(function (f) { f.v = 0; f.c = PAL[f.ci].slice(); f.stem = buildStem(f.lean, f.H, f.size); });
  /* meadow grass */
  var GRASS = (function () {
    var out = [], sd = 5; function r() { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }
    for (var c = 0; c < 6; c++) {
      var g = Geo();
      for (var b = 0; b < 330; b++) {
        var a = r() * PI2, rr = 9 * Math.sqrt(r()), x = Math.cos(a) * rr, z = Math.sin(a) * rr * .95, h = .22 + r() * .55, wd = .03 + r() * .025, la = r() * PI2, lx = Math.cos(la) * h * .35, lz = Math.sin(la) * h * .35, px = -Math.sin(la) * wd, pz = Math.cos(la) * wd, base = g.p.length / 3;
        var tint = r(), c0 = [.04 + tint * .03, .16 + tint * .06, .07], c1 = [.14 + tint * .16, .42 + tint * .16, .15 + tint * .08], nrm = [lx, h * .8, lz], nl = Math.hypot(nrm[0], nrm[1], nrm[2]);
        var V = [[x - px, FBASE, z - pz, c0], [x + px, FBASE, z + pz, c0], [x + lx * .4 - px * .8, FBASE + h * .55, z + lz * .4 - pz * .8, mix(c0, c1, .6)], [x + lx * .4 + px * .8, FBASE + h * .55, z + lz * .4 + pz * .8, mix(c0, c1, .6)], [x + lx, FBASE + h, z + lz, c1]];
        V.forEach(function (v) { g.p.push(v[0], v[1], v[2]); g.n.push(nrm[0] / nl + 0, nrm[1] / nl, nrm[2] / nl); g.c.push(v[3][0], v[3][1], v[3][2]); g.u.push(0, 0); });
        g.i.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
      }
      out.push(mesh(g));
    }
    return out;
  })();
  function drawGrass() {
    setU({ uUseTex: 0, uVC: 1, uColor: [1, 1, 1, 1], uAlpha: 0, uTrans: .5, uEmis: 0, uShine: 10, uSpec: .03, uRim: .15, uTwo: 1 });
    GRASS.forEach(function (m, i) { var sh = Math.sin(time * .9 + i * 1.3) * .035, sh2 = Math.cos(time * .7 + i * 2.1) * .03, M = M4.id(); M[4] = sh; M[6] = sh2; drawMesh(m, M4.mul(M4.T(0, FBASE, 0), M4.mul(M, M4.T(0, -FBASE, 0))), {}); });
  }
  function fMats(f) {
    var sw = Math.sin(time * .8 + f.ph) * .025 + f.v * .012, o = clamp(f.open, 0, 1);
    var Mb = M4.mul(M4.T(f.x, FBASE, f.z), M4.mul(M4.Ry(f.rot), M4.Rz(sw)));
    var Mh = M4.mul(Mb, M4.mul(M4.T(Math.sin(2.4) * f.lean, f.H, 0), M4.mul(M4.Rz(-f.nod * (1 - o)), M4.S(f.size, f.size, f.size))));
    return { Mb: Mb, Mh: Mh };
  }
  function updateFlowers(dt) {
    FL.forEach(function (f) {
      f.v += (f.tgt - f.open) * 60 * dt; f.v *= Math.exp(-dt * 5.5); f.open += f.v * dt;
      var T = PAL[f.ci], kk = 1 - Math.exp(-dt * 5); for (var k = 0; k < 3; k++) f.c[k] += (T[k] - f.c[k]) * kk;
      if (f.open > .85 && Math.random() < dt * 1.1) { var p = M4.pt(fMats(f).Mh, 0, .2, 0); emit(p[0], p[1], p[2], 1, [1, .9, .5], .5 * f.size, .35); }
    });
  }
  function drawFlowers() {
    FL.forEach(function (f) {
      var m = fMats(f), o = f.open, oc = clamp(o, 0, 1.15), K = KIND[f.kind], cin = f.c, cout = mix(f.c, [1, 1, 1], .62), i, p;
      setU({ uUseTex: 0, uAlpha: 0, uTrans: .3, uEmis: 0, uShine: 24, uSpec: .12, uRim: .6, uTwo: 1, uVC: 1, uColor: [1, 1, 1, 1] });
      drawMesh(f.stem, m.Mb, {});
      drawMesh(CAL, M4.mul(m.Mh, M4.mul(M4.T(0, 0, .05), M4.S(K.cal, K.cal * .85, K.cal))), {});
      setU({ uVC: 2, uColor: [.12, .36, .18, 1], uCol2: [.4, .66, .32] });
      for (i = 0; i < 5; i++) { var ts = 1.3 - oc * 1.9; drawMesh(PT.sepal, M4.mul(m.Mh, M4.mul(M4.T(0, -.02, 0), M4.mul(M4.Ry(i / 5 * PI2 + .3), M4.mul(M4.Rx(-ts), M4.mul(M4.T(0, 0, .08), M4.S(1, 1, K.cal * .55)))))), {}); }
      setU({ uVC: 2, uColor: [cin[0], cin[1], cin[2], 1], uCol2: cout, uTrans: .55, uEmis: .05, uSpec: .22, uShine: 34 });
      (o < .02 ? K.lay.slice(0, 1) : K.lay).forEach(function (l) {
        var pm = PT[l.m];
        var stp = o < .02 && l.n > 6 ? 2 : 1;
        for (p = 0; p < l.n; p += stp) {
          var oi = clamp(o * 1.45 - (p / l.n * .3 + l.y * 4), 0, 1.12), tilt = Math.max(.04, l.c + (l.o - l.c) * oi), e = Math.min(1, oi), Ls = l.L * (.62 + .38 * e);
          drawMesh(pm, M4.mul(m.Mh, M4.mul(M4.T(0, .02 + l.y, 0), M4.mul(M4.Ry(p / l.n * PI2 + l.off), M4.mul(M4.Rx(-tilt), M4.mul(M4.T(0, 0, K.rad), M4.S(l.w * (.72 + .28 * e), 1, Ls)))))), {});
        }
      });
      var cs = .2 + .8 * clamp(o, 0, 1); setU({ uVC: 1, uColor: [1, 1, 1, 1], uTrans: .2, uEmis: 0, uSpec: .12 });
      if (o >= .02) drawMesh(CEN[f.kind], M4.mul(m.Mh, M4.mul(M4.T(0, K.cy, 0), M4.S(cs, cs * .85, cs))), {});
    });
  }
  function flowerHit(cx, cy) {
    var best = null, bd = 1e9, k = (H / 2) / Math.tan(.36);
    FL.forEach(function (f) {
      var P = M4.pt(fMats(f).Mh, 0, .12, 0), x = P[0], y = P[1], z = P[2], cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15]; if (cw <= 0) return;
      var nx = (VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / cw, ny = (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / cw;
      var sx = (nx * .5 + .5) * W, sy = (.5 - ny * .5) * H, r = ((.3 + .6 * clamp(f.open, 0, 1)) * f.size + .06) * k / cw, d = Math.hypot(sx - cx, sy - cy);
      if (d < Math.max(r, 22) && cw < bd) { bd = cw; best = f; best.p = P; }
    }); return best;
  }
  function clickFlower(f) {
    if (f.tgt < .5) { f.tgt = 1; f.v += 1.4; } else { f.ci = (f.ci + 1) % PAL.length; f.v += .9; }
    emit(f.p[0], f.p[1], f.p[2], 26, PAL[f.ci], .7 * f.size, 1.8);
  }
  var palBox = $('#pal'), palBtns = [];
  PAL.forEach(function (c, i) { var b = document.createElement('button'); b.type = 'button'; b.className = 'pc'; b.setAttribute('aria-label', '花朵颜色 ' + (i + 1)); b.style.background = 'rgb(' + c.map(function (v) { return Math.round(v * 255); }).join(',') + ')';
    b.addEventListener('click', function () { FL.forEach(function (f) { f.ci = i; }); palBtns.forEach(function (x, k) { x.setAttribute('aria-pressed', k === i); }); FL.forEach(function (f) { if (f.open > .5) f.v += .5; }); }); palBox.appendChild(b); palBtns.push(b); });
  var bloomBtn = $('#bloom');
  bloomBtn.addEventListener('click', function () { var all = FL.every(function (f) { return f.tgt > .5; }); FL.forEach(function (f, i) { setTimeout(function () { f.tgt = all && i ? 0 : 1; if (!all) f.v += 1; }, i * 50); }); bloomBtn.textContent = all ? '全部盛开' : '合拢花朵'; });

  /* ================= Scene state ================= */
  var texes = [];
  function ensureTex(i) { if (texes[i]) return texes[i]; var s = SPECIES[i]; texes[i] = [texture(paintLayer(s, 0, i), 0), texture(paintLayer(s, 1, i), 1), texture(paintDataTex(s, i), 2)]; return texes[i]; }
  var t0p = performance.now(); ensureTex(CONFIG.startSpecies);
  var sp = CONFIG.startSpecies, S = { t: 3, phase: 0, perch: CONFIG.startPerched || reduce ? 1 : 0, target: CONFIG.startPerched || reduce ? 1 : 0, dash: 0, yaw: 0, beat: 1, follow: false };
  var cam = { az: .75, el: .42, dist: 12.5, tx: 0, ty: -.2, tz: 0, userDist: 12.5 };
  var pos = [0, 1, 0], vel = [0, 0, 1], roll = 0, lastYaw = 0, pitch = 0;
  var PS = 1;
  function pathAt(t, o) { o[0] = PS * (3.5 * Math.sin(.37 * t) + .8 * Math.sin(.9 * t)); o[1] = .7 + .6 * Math.sin(.8 * t) + .28 * Math.sin(2.1 * t); o[2] = PS * 2.9 * Math.sin(.53 * t + 1); return o; }

  /* particles: pollen + wing trail share one dynamic buffer */
  var NP = CONFIG.pollen, NT = 260, NA = NP + NT, PD = new Float32Array(NA * 7), PV = [], TR = [];
  for (var i = 0; i < NP; i++) { PV.push([(rnd() - .5) * .25, .05 + rnd() * .12, (rnd() - .5) * .25]); PD[i * 7] = (rnd() - .5) * 20; PD[i * 7 + 1] = -4 + rnd() * 9; PD[i * 7 + 2] = (rnd() - .5) * 20; PD[i * 7 + 6] = .05 + rnd() * .09; }
  for (var q = 0; q < NT; q++) TR.push({ life: 0, v: [0, 0, 0], max: 1 });
  var PB = buf(PD, true);
  function emit(x, y, z, n, col, spread, speed) {
    for (var k = 0; k < n; k++) { var s = TR.find(function (e) { return e.life <= 0; }); if (!s) return; s.life = s.max = .9 + rnd() * .8; s.col = col; s.x = x + (rnd() - .5) * spread; s.y = y + (rnd() - .5) * spread; s.z = z + (rnd() - .5) * spread; s.v = [(rnd() - .5) * speed, (rnd() - .3) * speed, (rnd() - .5) * speed]; s.size = .08 + rnd() * .12; }
  }

  /* ================= UI wiring ================= */
  var spBox = $('#species');
  SPECIES.forEach(function (s, i) { var b = document.createElement('button'); b.type = 'button'; b.className = 'sp'; b.style.setProperty('--sw', s.sw); b.setAttribute('aria-pressed', i === sp); b.innerHTML = '<i></i>' + s.name; b.addEventListener('click', function () { setSpecies(i); }); spBox.appendChild(b); });
  function setSpecies(i) {
    sp = i; var s = SPECIES[i]; Array.prototype.forEach.call(spBox.children, function (b, k) { b.setAttribute('aria-pressed', k === i); });
    var style = root.style; style.setProperty('--c1', s.bg[0]); style.setProperty('--c2', s.bg[1]); style.setProperty('--c3', s.bg[2]);
    $('#latin').textContent = s.latin; $('#common').textContent = s.name; ensureTex(i); emit(pos[0], pos[1], pos[2], 40, s.trail, 1.6, 2.2);
  }
  var landBtn = $('#land'), folBtn = $('#follow');
  function setLand(v) { S.target = v ? 1 : 0; landBtn.setAttribute('aria-pressed', v); landBtn.textContent = v ? '再次起飞' : '停在花朵上'; }
  landBtn.addEventListener('click', function () { setLand(S.target < .5); });
  folBtn.addEventListener('click', function () { S.follow = !S.follow; folBtn.setAttribute('aria-pressed', S.follow); });
  var clBtn = $('#close');
  function setClose(v) { S.close = v; clBtn.setAttribute('aria-pressed', v); if (v) { S.follow = true; folBtn.setAttribute('aria-pressed', true); cam.userDist = 4.6; } else cam.userDist = 12.5; }
  clBtn.addEventListener('click', function () { setClose(!S.close); });
  $('#beat').addEventListener('input', function (e) { S.beat = +e.target.value; });
  for (var b = 0; b < 9; b++) { var bk = document.createElement('i'), sz = 40 + rnd() * 120; bk.style.cssText = 'left:' + rnd() * 100 + '%;top:' + rnd() * 100 + '%;width:' + sz + 'px;height:' + sz + 'px;animation-delay:' + (-rnd() * 10) + 's;animation-duration:' + (10 + rnd() * 10) + 's'; $('#bokeh').appendChild(bk); }

  /* orbit: drag, wheel, pinch; a click (no drag) startles the butterfly */
  var ptrs = {}, dragD = 0, pinch0 = 0;
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.clientX, e.clientY]; dragD = 0; canvas.classList.add('drag'); pinch0 = 0; });
  canvas.addEventListener('pointermove', function (e) {
    var p = ptrs[e.pointerId]; if (!p) return; var ids = Object.keys(ptrs);
    if (ids.length === 2) { var o = ptrs[ids[0] == e.pointerId ? ids[1] : ids[0]], d0 = Math.hypot(p[0] - o[0], p[1] - o[1]); p[0] = e.clientX; p[1] = e.clientY; var d1 = Math.hypot(p[0] - o[0], p[1] - o[1]); if (pinch0) cam.userDist = clamp(cam.userDist * (d0 / d1), 3.2, 22); pinch0 = 1; dragD += 9; return; }
    var dx = e.clientX - p[0], dy = e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY; dragD += Math.abs(dx) + Math.abs(dy);
    cam.az -= dx * .006; cam.el = clamp(cam.el + dy * .005, -.25, 1.3);
  });
  function up(e) { delete ptrs[e.pointerId]; canvas.classList.remove('drag'); if (e.type === 'pointerup' && dragD < 6 && !Object.keys(ptrs).length) { var fh = flowerHit(e.clientX, e.clientY); if (fh) clickFlower(fh); else startle(); } }
  canvas.addEventListener('pointermove', function (e) { if (!Object.keys(ptrs).length) canvas.style.cursor = flowerHit(e.clientX, e.clientY) ? 'pointer' : ''; });
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); cam.userDist = clamp(cam.userDist * (1 + e.deltaY * .001), 3.2, 22); }, { passive: false });
  function startle() { S.dash = 1; BF.forEach(function (b) { b.dash = 1; }); setLand(false); emit(pos[0], pos[1], pos[2], 50, SPECIES[sp].trail, 1.2, 3.2); }

  /* ================= Butterflies (main + companions) ================= */
  function drawBfly(o) {
    if (!o.main && !texes[o.sp]) return;
    var s = SPECIES[o.sp], w = o.w, ph = o.phase, k = o.scale || 1, bob = Math.sin(ph) * .09 * (1 - w) * Math.min(1, o.freq / 3) * k;
    var B = M4.mul(M4.T(o.pos[0], o.pos[1] + bob, o.pos[2]), M4.mul(M4.S(k, k, k), M4.mul(M4.Ry(o.yaw), M4.mul(M4.Rx(-o.pitch - Math.sin(ph) * .07 * (1 - w)), M4.Rz(o.roll)))));
    setU({ uRimC: o.sp === 3 ? [.7, .5, 1] : [1, .85, .6], uWing: 0, uIri: 0, uSpark: 0, uGlow: 0, uGlowC: [0, 0, 0], uIriA: 0, uUseTex: 0, uVC: 1, uColor: [1, 1, 1, 1], uAlpha: 0, uTrans: 0, uEmis: 0, uShine: 40, uSpec: .25, uRim: .8, uTwo: 0 });
    drawMesh(BODY.body, B, {});
    var wag = Math.sin(ph) * .1 * (1 - w * .7) + Math.sin(time * 1.1 + (o.off || 0)) * .035 + .12 * w, pv = [0, .02, -.14];
    drawMesh(BODY.abd, M4.mul(B, M4.mul(M4.T(pv[0], pv[1], pv[2]), M4.mul(M4.Rx(wag), M4.T(-pv[0], -pv[1], -pv[2])))), {});
    var asw = Math.sin(time * 1.3 + (o.off || 0)) * .05 + Math.sin(ph) * .04 * (1 - w) + Math.sin(time * 2.7 + 1) * .015;
    [1, -1].forEach(function (sd, si) { var rp = [sd * .04, .06, .52], Ma = M4.mul(B, M4.mul(M4.T(rp[0], rp[1], rp[2]), M4.mul(M4.Rx(asw), M4.mul(M4.Rz(sd * (asw * .7 + .03)), M4.T(-rp[0], -rp[1], -rp[2]))))); drawMesh(BODY.ant[si], Ma, {}); });
    var flyA = .38 + .88 * Math.sin(ph) * (1 - o.glide * .5) + o.glide * .42, perchA = 1.1 + .4 * Math.sin(time * .9) + .08 * Math.sin(time * 3.1), ang = flyA + (perchA - flyA) * w;
    var lag = { v: (.22 * clamp(o.freq / 4.5, 0, 1.3) + .05) * (1 - w * .6), p: ph }, camber = .1 + .12 * w + .05 * o.glide;
    deformWing(lag, camber, (1 - w) * clamp(o.freq / 5, 0, 1));
    var tx = ensureTex(o.sp); for (var tu = 0; tu < 3; tu++) { gl.activeTexture(gl.TEXTURE0 + tu); gl.bindTexture(gl.TEXTURE_2D, tx[tu]); }
    gl.uniform1i(MESH.u.uTex, 0); gl.uniform1i(MESH.u.uTexU, 1); gl.uniform1i(MESH.u.uData, 2);
    setU({ uWing: 1, uIri: s.fx.iri, uIriA: s.fx.iriA, uSpark: s.fx.spark, uGlow: s.fx.glow, uGlowC: s.fx.glowC, uUseTex: 1, uVC: 0, uAlpha: .5, uTrans: .55, uEmis: s.glow, uShine: 18, uSpec: .12, uRim: .5, uTwo: 1 });
    if (o.main) S.ang = ang; var att = M4.T(.07, .03, .16);
    drawMesh(WING, M4.mul(B, M4.mul(att, M4.Rz(ang))), {});
    drawMesh(WING, M4.mul(B, M4.mul(M4.T(-.07, .03, .16), M4.mul(M4.Rz(-ang), M4.S(-1, 1, 1)))), {});
  }
  var BF = [[1, .5], [2, .56], [3, .6], [1, .44], [0, .5], [2, .46]].map(function (c, i) {
    return { sp: c[0], scale: c[1], t: i * 7.3 + 2, off: i * 1.9, a1: .22 + rnd() * .2, a2: .6 + rnd() * .5, a3: .3 + rnd() * .2, R1: 3.8 + rnd() * 1.6, R2: .8 + rnd() * .6, R3: 3.4 + rnd() * 1.6,
      pos: [0, 1, 0], yaw: 0, pitch: 0, roll: 0, phase: rnd() * 6, w: 0, freq: 4, glide: 0, dash: 0, spd: .8 + rnd() * .5 };
  });
  var bp0 = [0, 0, 0], bp1 = [0, 0, 0];
  function bfPath(b, t, o) { o[0] = PS * (b.R1 * Math.sin(b.a1 * t + b.off) + b.R2 * Math.sin(b.a2 * t + b.off * 1.7)); o[1] = .9 + .7 * Math.sin(.7 * t + b.off) + .3 * Math.sin(1.9 * t); o[2] = PS * (b.R3 * Math.sin(b.a3 * t + b.off * 2) + .9 * Math.sin(1.1 * t)); return o; }
  function updateBF(dt) {
    BF.forEach(function (b) {
      b.t += dt * b.spd * (1 + b.dash * 1.4); b.dash = Math.max(0, b.dash - dt * .75);
      bfPath(b, b.t, bp0); bfPath(b, b.t + .05, bp1); var vx = (bp1[0] - bp0[0]) / .05, vy = (bp1[1] - bp0[1]) / .05, vz = (bp1[2] - bp0[2]) / .05;
      b.pos[0] = bp0[0]; b.pos[1] = bp0[1]; b.pos[2] = bp0[2];
      var yawT = Math.atan2(vx, vz), dy = ((yawT - b.yaw + 9.42477) % PI2) - Math.PI; b.yaw += dy * (1 - Math.exp(-dt * 6)); var rate = dy / Math.max(dt, .001);
      b.roll += (clamp(-rate * .09, -.75, .75) - b.roll) * (1 - Math.exp(-dt * 5)); b.pitch += (clamp(Math.atan2(vy, Math.hypot(vx, vz)) * .8, -.5, .5) - b.pitch) * (1 - Math.exp(-dt * 5));
      b.glide = sm(.55, .92, Math.sin(b.t * .45 + b.off)); b.freq = (4.4 + 1.3 * Math.sin(b.t * .7 + b.off)) * (1 - b.glide * .82) * (1 + b.dash * .7) * S.beat; b.phase += dt * PI2 * b.freq;
      if (Math.random() < dt * 9) emit(b.pos[0], b.pos[1], b.pos[2], 1, SPECIES[b.sp].trail, .4, .3);
    });
  }

  /* ================= Frame ================= */
  var L = (function () { var v = [.55, .8, .5], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })(), L2 = [-.6, -.5, .6];
  var camK = 1, W = 0, H = 0, last = performance.now(), VP = M4.id();
  function resize() { var dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; var A = W / H; PS = A < 1 ? clamp(A * 1.35, .6, 1) : 1; camK = A < 1 ? 1 + (1 - A) * .9 : 1; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); gl.viewport(0, 0, canvas.width, canvas.height); }
  resizeHandler = resize; window.addEventListener('resize', resize); resize();

  function setU(o) { for (var k in o) { var l = MESH.u[k]; if (l == null) continue; var v = o[k]; if (v.length === 3) gl.uniform3fv(l, v); else if (v.length === 4) gl.uniform4fv(l, v); else gl.uniform1f(l, v); } }
  function drawMesh(m, M, o) {
    gl.uniformMatrix4fv(MESH.u.uM, false, M); setU(o);
    attr(aLoc.pos, m.bp, 3); attr(aLoc.nor, m.bn, 3); attr(aLoc.col, m.bc, 3); attr(aLoc.uv, m.bu, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.bi); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
  }

  var p0 = [0, 0, 0], p1 = [0, 0, 0], time = 0;
  function frame(now) {
    if (destroyed) return;
    var dt = Math.min(.05, (now - last) / 1000); last = now; step(dt); render(); rafId = requestAnimationFrame(frame);
  }
  function step(dt) {
    if (S.frozen) return;
    time += dt; updateFlowers(dt); updateBF(dt); var s = SPECIES[sp];
    S.t += dt * (1 + S.dash * 1.4); S.dash = Math.max(0, S.dash - dt * .75);
    S.perch += (S.target - S.perch) * (1 - Math.exp(-dt * 1.5)); var w = sm(0, 1, S.perch);
    pathAt(S.t, p0); pathAt(S.t + .05, p1); vel = [(p1[0] - p0[0]) / .05, (p1[1] - p0[1]) / .05, (p1[2] - p0[2]) / .05];
    var sway = Math.sin(time * .8) * .025, perchPos = [-(FTOP + .5 - FBASE) * Math.sin(sway), FTOP + .5, 0];
    for (var k = 0; k < 3; k++) pos[k] = p0[k] + (perchPos[k] - p0[k]) * w;
    var yawP = Math.atan2(vel[0], vel[2]), yawT = yawP + ((.6 - yawP + 9.42477) % PI2 - Math.PI) * w, dy = ((yawT - S.yaw + 9.42477) % PI2) - Math.PI;
    S.yaw += dy * (1 - Math.exp(-dt * 6)); var rate = dy / Math.max(dt, .001); roll += (clamp(-rate * .09, -.75, .75) * (1 - w) - roll) * (1 - Math.exp(-dt * 5));
    var hv = Math.hypot(vel[0], vel[2]); pitch += (clamp(Math.atan2(vel[1], hv) * .8, -.5, .5) * (1 - w) + (.18 * w) - pitch) * (1 - Math.exp(-dt * 5));
    var glide = (1 - w) * sm(.55, .92, Math.sin(S.t * .45)), freq = (1 - w) * (4.4 + 1.3 * Math.sin(S.t * .7)) * (1 - glide * .82) * S.beat * (1 + S.dash * .7) + w * .3;
    S.phase += dt * PI2 * freq;
    if (!(S.perch > .5 && S.target > .5) && Math.random() < dt * 60 * (1 - w)) emit(pos[0] - Math.sin(S.yaw) * .5, pos[1], pos[2] - Math.cos(S.yaw) * .5, 1, s.trail, .5, .3);
    if (S.ang != null && freq > 2 && w < .5 && Math.random() < dt * 14 * Math.abs(Math.cos(S.phase))) { var sd2 = Math.random() < .5 ? 1 : -1, tl = Wd * .8, ca = Math.cos(S.ang), sa = Math.sin(S.ang); emit(pos[0] + sd2 * Math.cos(S.yaw) * tl * ca + Math.sin(S.yaw) * .3, pos[1] + tl * sa, pos[2] - sd2 * Math.sin(S.yaw) * tl * ca + Math.cos(S.yaw) * .3, 1, s.trail, .35, .5); }
    // particles
    for (var i = 0; i < NP; i++) { var o = i * 7; PD[o] += (PV[i][0] + Math.sin(time * .4 + i) * .12) * dt; PD[o + 1] += PV[i][1] * dt; PD[o + 2] += (PV[i][2] + Math.cos(time * .35 + i * 1.7) * .12) * dt; if (PD[o + 1] > 5.5) { PD[o + 1] = -4; } if (Math.abs(PD[o]) > 10) PD[o] *= -.95; if (Math.abs(PD[o + 2]) > 10) PD[o + 2] *= -.95;
      var tw = .55 + .45 * Math.sin(time * 1.5 + i * 2.3); PD[o + 3] = 1 * tw * .85; PD[o + 4] = .93 * tw * .85; PD[o + 5] = .75 * tw * .85; }
    for (var j = 0; j < NT; j++) { var e = TR[j], o2 = (NP + j) * 7; if (e.life > 0) { e.life -= dt; e.x += e.v[0] * dt; e.y += e.v[1] * dt - .15 * dt; e.z += e.v[2] * dt; var a = Math.max(0, e.life / e.max); a = a * a; PD[o2] = e.x; PD[o2 + 1] = e.y; PD[o2 + 2] = e.z; PD[o2 + 3] = e.col[0] * a; PD[o2 + 4] = e.col[1] * a; PD[o2 + 5] = e.col[2] * a; PD[o2 + 6] = e.size * (.5 + a); } else { PD[o2 + 3] = PD[o2 + 4] = PD[o2 + 5] = 0; PD[o2 + 6] = .01; } }
    gl.bindBuffer(gl.ARRAY_BUFFER, PB); gl.bufferSubData(gl.ARRAY_BUFFER, 0, PD);
    // camera
    var dTarget = S.follow ? [pos[0] * .8, pos[1] * .8 - .1, pos[2] * .8] : [0, -.2, 0], kk = 1 - Math.exp(-dt * 3);
    cam.tx += (dTarget[0] - cam.tx) * kk; cam.ty += (dTarget[1] - cam.ty) * kk; cam.tz += (dTarget[2] - cam.tz) * kk; cam.dist += (cam.userDist * camK * (S.follow ? .72 : 1) - cam.dist) * kk;
    if (!Object.keys(ptrs).length && !reduce) cam.az += dt * .035;
    S.fw = { w: w, glide: glide, freq: freq };
  }

  function render() {
    var s = SPECIES[sp], w = S.fw.w, ce = Math.cos(cam.el), eye = [cam.tx + cam.dist * ce * Math.sin(cam.az), cam.ty + cam.dist * Math.sin(cam.el), cam.tz + cam.dist * ce * Math.cos(cam.az)];
    VP = M4.mul(M4.persp(.72, W / H, .5, 80), M4.look(eye, [cam.tx, cam.ty, cam.tz], [0, 1, 0]));
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(MESH.p); gl.uniformMatrix4fv(MESH.u.uVP, false, VP);
    var sky = sp === 3 ? [.55, .5, .8] : sp === 1 ? [.45, .7, .8] : [.75, .7, .6], gnd = [.18, .12, .16];
    var env = { uL: L, uL2: L2, uLC: [1.15, 1.02, .9], uSky: sky, uGnd: gnd, uCam: eye, uRimC: sp === 3 ? [.7, .5, 1] : [1, .85, .6] };
    setU(env); setU({ uWing: 0, uIri: 0, uSpark: 0, uGlow: 0, uTime: time, uGlowC: [0, 0, 0], uIriA: 0 });
    drawGrass(); drawFlowers();
    drawBfly({ pos: pos, yaw: S.yaw, pitch: pitch, roll: roll, phase: S.phase, w: w, freq: S.fw.freq, glide: S.fw.glide, sp: sp, scale: 1, main: true });
    BF.forEach(drawBfly);
    // particles (additive)
    gl.useProgram(PTS.p); gl.uniformMatrix4fv(PTS.u.uVP, false, VP); gl.uniform1f(PTS.u.uScale, canvas.height * .9); gl.uniform1f(PTS.u.uMax, 26 * (canvas.width / W));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    gl.bindBuffer(gl.ARRAY_BUFFER, PB); var stride = 28;
    gl.enableVertexAttribArray(pLoc.pos); gl.vertexAttribPointer(pLoc.pos, 3, gl.FLOAT, false, stride, 0); gl.enableVertexAttribArray(pLoc.col); gl.vertexAttribPointer(pLoc.col, 3, gl.FLOAT, false, stride, 12); gl.enableVertexAttribArray(pLoc.size); gl.vertexAttribPointer(pLoc.size, 1, gl.FLOAT, false, stride, 24);
    gl.drawArrays(gl.POINTS, 0, NA); gl.depthMask(true);
    gl.disableVertexAttribArray(pLoc.pos); gl.disableVertexAttribArray(pLoc.col); gl.disableVertexAttribArray(pLoc.size);
  }

  setSpecies(sp); if (S.target > .5) setLand(true);
  if (W / H < .8) { S.follow = true; folBtn.setAttribute('aria-pressed', true); }
  rafId = requestAnimationFrame(frame);
  [0, 1, 2, 3].forEach(function (i, k) { timeouts.push(setTimeout(function () { try { if (!destroyed) ensureTex(i); } catch (e) {} }, 1200 + k * 900)); });
  return () => {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(rafId);
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    timeouts.forEach(clearTimeout);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
