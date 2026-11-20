const INK = "#364b36";

function tuft(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.quadraticCurveTo(-6, -6, -2, -8);
  ctx.lineTo(-2, -2);
  ctx.quadraticCurveTo(0, -8, 4, -12);
  ctx.lineTo(2, -2);
  ctx.quadraticCurveTo(6, -6, 9, -6);
  ctx.lineTo(5, 0);
  ctx.fillStyle = "#91ab70";
  ctx.fill();
  ctx.restore();
}

function stone(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.ellipse(1, 1, 12, 3, 0, 0, 2 * Math.PI);
  ctx.fillStyle = "#adc38b";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-10, -1);
  ctx.lineTo(-7, -7);
  ctx.lineTo(0, -10);
  ctx.lineTo(7, -7);
  ctx.lineTo(10, -2);
  ctx.quadraticCurveTo(3, 2, -10, -1);
  ctx.fillStyle = "#abb4a1";
  ctx.fill();
  ctx.strokeStyle = "#617561";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(0, -8);
  ctx.lineTo(4, -7);
  ctx.strokeStyle = "#e4e7c9";
  ctx.stroke();
  ctx.restore();
}

function flowers(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  for (const [dx, dy] of [[-4, 4], [3, 0], [7, 7]]) {
    const px = x + dx * s, py = y + dy * s;
    ctx.fillStyle = "#859c68";
    ctx.fillRect(px, py, s, 4 * s);
    for (let petal = 0; petal < 4; petal++) {
      const angle = petal * Math.PI / 2;
      ctx.beginPath();
      ctx.arc(px + Math.cos(angle) * 1.5 * s, py + Math.sin(angle) * 1.5 * s, 1.55 * s, 0, 2 * Math.PI);
      ctx.fillStyle = "#fffae1";
      ctx.fill();
    }
    ctx.fillStyle = "#ddad49";
    ctx.fillRect(px - s, py - s, 2 * s, 2 * s);
  }
}

function campFlag(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, blue: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(blue ? -size : size, size);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(3, 1, 38, 9, -.04, 0, 2 * Math.PI);
  ctx.fillStyle = "#c0d291";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-13, -1, 16, 3.5, .06, 0, 2 * Math.PI);
  ctx.fillStyle = "#9fb87e";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(-7, -77);
  ctx.quadraticCurveTo(-7, -79, -3, -79);
  ctx.lineTo(2, -1);
  ctx.closePath();
  ctx.fillStyle = "#b18453";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, -74);
  ctx.bezierCurveTo(8, -81, 24, -68, 42, -74);
  ctx.lineTo(32, -59);
  ctx.lineTo(44, -49);
  ctx.bezierCurveTo(26, -41, 13, -57, -4, -49);
  ctx.closePath();
  ctx.fillStyle = blue ? "#508aca" : "#e76a50";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28, -68);
  ctx.quadraticCurveTo(32, -67, 36, -68);
  ctx.lineTo(31, -61);
  ctx.closePath();
  ctx.fillStyle = blue ? "#37729c" : "#be4b3e";
  ctx.fill();
  ctx.strokeStyle = "#ffebba";
  ctx.lineWidth = 2.8;
  if (blue) {
    for (const offset of [0, 7]) {
      ctx.beginPath(); ctx.moveTo(5 + offset, -68); ctx.lineTo(1 + offset, -56); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(10, -69); ctx.lineTo(14, -63); ctx.lineTo(10, -57); ctx.lineTo(6, -63); ctx.closePath(); ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(-5, -80, 3.3, 0, 2 * Math.PI);
  ctx.fillStyle = "#f9cf77";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.7;
  ctx.stroke();
  tuft(ctx, 4, 1, .7);
  stone(ctx, -11, 2, .6);
  ctx.restore();
}

function meadowCorner(ctx: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.fillStyle = "#c3da95";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(370, 0);
  ctx.bezierCurveTo(306, 15, 320, 42, 247, 40);
  ctx.bezierCurveTo(166, 37, 203, 78, 113, 85);
  ctx.bezierCurveTo(55, 88, 72, 122, 0, 139);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#b5ce89";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(218, 0);
  ctx.bezierCurveTo(173, 35, 128, 12, 106, 42);
  ctx.bezierCurveTo(84, 74, 39, 56, 0, 91);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawLandscape(ctx: CanvasRenderingContext2D) {
  const w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight;
  if (!w || !h) return;
  ctx.setTransform(ctx.canvas.width / w, 0, 0, ctx.canvas.height / h, 0, 0);
  ctx.fillStyle = "#d3e6a6";
  ctx.fillRect(0, 0, w, h);
  const s = Math.min(1.3, Math.max(.59, w / 1000), h / 490);
  meadowCorner(ctx, 0, 0, s * 1.1, s);
  meadowCorner(ctx, w, 0, -s * .76, s * 1.15);
  meadowCorner(ctx, 0, h, s * .82, -s * 1.38);
  meadowCorner(ctx, w, h, -s * 1.38, -s * 1.12);

  // Fixed landmarks and sparse tufts keep the middle open and never flicker between frames.
  const grasses = [
    [.065,.20], [.195,.25], [.32,.16], [.47,.12], [.62,.18], [.78,.22], [.91,.18],
    [.035,.36], [.145,.42], [.26,.37], [.406,.32], [.66,.35], [.84,.38], [.968,.36],
    [.076,.67], [.215,.60], [.317,.73], [.415,.66], [.59,.57], [.713,.61], [.85,.70], [.957,.59],
    [.034,.83], [.17,.90], [.27,.82], [.456,.84], [.57,.78], [.74,.84], [.93,.91],
  ];
  for (const [i, [u, v]] of grasses.entries()) {
    const x = w * u, y = h * v;
    ctx.beginPath();
    ctx.ellipse(x + 3 * s, y + s, (7 + i % 5) * s, 1.7 * s, -.04, 0, 2 * Math.PI);
    ctx.fillStyle = "#c3d897";
    ctx.fill();
    tuft(ctx, x, y, (.40 + (i % 4) * .09) * s);
    if (i % 3 === 0) tuft(ctx, x + 12 * s, y - 2 * s, .33 * s);
  }
  for (const [u, v] of [[.14,.27], [.79,.32], [.245,.78], [.881,.83]]) flowers(ctx, u * w, v * h, .85 * s);
  for (const [u, v, k] of [[.032,.52,.65], [.188,.71,.55], [.885,.29,.7], [.968,.74,.9], [.91,.78,.42], [.29,.08,.48]]) {
    stone(ctx, u * w, v * h, k * s);
  }
  campFlag(ctx, .095 * w, .558 * h, s, false);
  campFlag(ctx, .905 * w, .558 * h, s, true);
}
