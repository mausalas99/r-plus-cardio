/** Canvas drawing helpers for trend sparklines (extracted for complexity budget). */

export function parseSparkValues(values) {
  return (values || []).map(function (v) {
    if (v == null || v === '') return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
}

export function sparkValueRange(finite) {
  var min = Math.min.apply(null, finite);
  var max = Math.max.apply(null, finite);
  if (max === min) {
    min -= 1;
    max += 1;
  }
  return { min, max };
}

export function drawSparkStroke(ctx, nums, min, max, padX, padY, innerW, innerH) {
  var n = nums.length;
  var step = n > 1 ? innerW / (n - 1) : 0;
  var started = false;
  for (var i = 0; i < n; i += 1) {
    var v = nums[i];
    if (v == null) {
      started = false;
      continue;
    }
    var x = padX + (n > 1 ? i * step : innerW / 2);
    var y = padY + innerH - ((v - min) / (max - min)) * innerH;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  return started;
}

export function drawSparkDots(ctx, nums, min, max, padX, padY, innerW, innerH) {
  var n = nums.length;
  var step = n > 1 ? innerW / (n - 1) : 0;
  for (var j = 0; j < n; j += 1) {
    var v2 = nums[j];
    if (v2 == null) continue;
    var x2 = padX + (n > 1 ? j * step : innerW / 2);
    var y2 = padY + innerH - ((v2 - min) / (max - min)) * innerH;
    ctx.beginPath();
    ctx.arc(x2, y2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
