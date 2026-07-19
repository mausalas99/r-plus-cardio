/**
 * Sparklines ligeros (canvas 2D) para tarjetas de Tendencias — sin Chart.js por tarjeta.
 */
import {
  drawSparkDots,
  drawSparkStroke,
  parseSparkValues,
  sparkValueRange,
} from './trend-spark-draw.mjs';

function fitCanvas(canvas) {
  var rect = canvas.getBoundingClientRect();
  var w = Math.max(1, Math.round(rect.width || canvas.clientWidth || 120));
  var h = Math.max(1, Math.round(rect.height || canvas.clientHeight || 40));
  var dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
  var pw = Math.round(w * dpr);
  var ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  return { ctx: canvas.getContext('2d'), w: pw, h: ph, dpr: dpr };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {(number|null|undefined)[]} values
 * @param {string} color
 */
export function drawTrendSparkLine(canvas, values, color) {
  if (!canvas) return;
  var fit = fitCanvas(canvas);
  var ctx = fit.ctx;
  if (!ctx) return;
  var w = fit.w;
  var h = fit.h;
  var dpr = fit.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.scale(dpr, dpr);
  var cssW = w / dpr;
  var cssH = h / dpr;

  var nums = parseSparkValues(values);
  var finite = nums.filter(function (n) {
    return n != null;
  });
  if (finite.length < 1) return;

  var range = sparkValueRange(finite);
  var padX = 6;
  var padY = 6;
  var innerW = Math.max(1, cssW - padX * 2);
  var innerH = Math.max(1, cssH - padY * 2);

  ctx.lineWidth = 2.25;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color || 'rgba(52,211,153,0.95)';
  ctx.beginPath();
  var started = drawSparkStroke(ctx, nums, range.min, range.max, padX, padY, innerW, innerH);
  if (started) ctx.stroke();

  ctx.fillStyle = ctx.strokeStyle;
  drawSparkDots(ctx, nums, range.min, range.max, padX, padY, innerW, innerH);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {(number|null|undefined)[]} values
 * @param {string} color
 * @returns {{ update: function, destroy: function }}
 */
export function mountTrendSparkCanvas(canvas, values, color) {
  drawTrendSparkLine(canvas, values, color);
  return {
    update(nextValues, nextColor) {
      drawTrendSparkLine(canvas, nextValues, nextColor || color);
    },
    destroy() {
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
