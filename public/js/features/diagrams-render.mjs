// SVG diagram cards (Laboratorio) — usa parsearSecciones desde diagrams-parse.mjs
import { escTxt } from "../labs.js";
import { parsearSecciones } from "./diagrams-parse.mjs";
import { buildSvgGamble, buildSvgPFH } from "./diagrams-gamble-pfh.mjs";

function g(secs, sec, key) {
  var s = secs[sec];
  if (!s) return null;
  var v = s[key];
  if (!v || v.val === "---") return null;
  return v;
}

var LINE = 'stroke="var(--diagram-line)" stroke-width="1.5"';

/** Etiqueta + valor centrados en (x, cy); anchor = start|middle|end */
function spBlock(x, cy, lbl, obj, anchor) {
  anchor = anchor || "middle";
  var ax = anchor === "start" ? "start" : anchor === "end" ? "end" : "middle";
  var isAb = obj && obj.ab;
  var vc = isAb ? "var(--error)" : "var(--diagram-value)";
  var vt = obj ? escTxt(obj.val) : "—";
  var dec = isAb ? ' text-decoration="underline"' : "";
  return (
    '<g transform="translate(' +
    x +
    "," +
    cy +
    ')">' +
    '<text x="0" y="-9" text-anchor="' +
    ax +
    '" dominant-baseline="middle" font-size="10" fill="var(--diagram-label)" font-family="Arial,sans-serif">' +
    lbl +
    "</text>" +
    '<text x="0" y="10" text-anchor="' +
    ax +
    '" dominant-baseline="middle" font-size="13" fill="' +
    vc +
    '" font-weight="bold" font-family="Arial,sans-serif"' +
    dec +
    ">" +
    vt +
    "</text>" +
    "</g>"
  );
}

function svgBH(secs) {
  var hb = g(secs, "BH", "Hb"),
    hto = g(secs, "BH", "Hto");
  var leu = g(secs, "BH", "Leu"),
    neu = g(secs, "BH", "Neu");
  var plt = g(secs, "BH", "Plt");
  if (!hb) return null;
  return (
    '<svg viewBox="0 0 300 192" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">' +
    '<line x1="50"  y1="18"  x2="250" y2="182" ' +
    LINE +
    "/>" +
    '<line x1="250" y1="18"  x2="50"  y2="182" ' +
    LINE +
    "/>" +
    spBlock(150, 46, "HB", hb, "middle") +
    spBlock(150, 155, "HCTO", hto, "middle") +
    spBlock(212, 100, "PLT", plt, "start") +
    spBlock(76, 62, "LEU", leu, "end") +
    '<line x1="26" y1="87" x2="86" y2="87" ' +
    LINE +
    "/>" +
    spBlock(76, 112, "NEU", neu, "end") +
    "</svg>"
  );
}

function svgGamble(secs) {
  return buildSvgGamble(secs, g);
}

function svgPFH(secs) {
  return buildSvgPFH(secs, g);
}

function svgGases(secs) {
  var ph = g(secs, "GASES", "pH");
  var pco2 = g(secs, "GASES", "pCO2");
  var po2 = g(secs, "GASES", "pO2");
  var lac = g(secs, "GASES", "Lactato");
  var bica = g(secs, "GASES", "Bica");
  if (!ph) return null;

  var cx = 135,
    lx = 67,
    rx = 202;
  var jY = 65;

  function gcell(x, lbl, obj, y_lbl) {
    var cy = y_lbl + 7.5;
    var vc = obj && obj.ab ? "var(--error)" : "var(--diagram-value)";
    var vt = obj ? escTxt(obj.val) : "—";
    var dec = obj && obj.ab ? ' text-decoration="underline"' : "";
    return (
      '<g transform="translate(' +
      x +
      "," +
      cy +
      ')">' +
      '<text x="0" y="-10" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--diagram-label)" font-family="Arial,sans-serif">' +
      lbl +
      "</text>" +
      '<text x="0" y="11" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="' +
      vc +
      '" font-weight="bold" font-family="Arial,sans-serif"' +
      dec +
      ">" +
      vt +
      "</text>" +
      "</g>"
    );
  }

  return (
    '<svg viewBox="0 0 270 162" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">' +
    '<line x1="' +
    cx +
    '" y1="' +
    jY +
    '" x2="22"  y2="10" ' +
    LINE +
    "/>" +
    '<line x1="' +
    cx +
    '" y1="' +
    jY +
    '" x2="248" y2="10" ' +
    LINE +
    "/>" +
    '<line x1="' +
    cx +
    '" y1="' +
    jY +
    '" x2="' +
    cx +
    '" y2="158" ' +
    LINE +
    "/>" +
    '<line x1="22" y1="' +
    jY +
    '"  x2="248" y2="' +
    jY +
    '"  ' +
    LINE +
    "/>" +
    '<line x1="22" y1="118" x2="248" y2="118" ' +
    LINE +
    "/>" +
    gcell(cx, "pH", ph, 20) +
    gcell(lx, "pCO2", pco2, 76) +
    gcell(rx, "pO2", po2, 76) +
    gcell(lx, "Lact", lac, 126) +
    gcell(rx, "HCO3", bica, 126) +
    "</svg>"
  );
}

function svgCoag(secs) {
  var tp = g(secs, "BH", "TP") || g(secs, "COAG", "TP");
  var ttp = g(secs, "BH", "TTP") || g(secs, "COAG", "TTP");
  var inr = g(secs, "BH", "INR") || g(secs, "COAG", "INR");
  if (!tp && !ttp && !inr) return null;
  var cx = 135,
    jY = 86,
    R = 50;
  var k = 0.8660254037844386;
  var tx = cx,
    ty = jY - R;
  var lx = cx - R * k,
    ly = jY + R * 0.5;
  var rx = cx + R * k,
    ry = jY + R * 0.5;
  var Jx = cx,
    Jy = jY;
  var uTx = 0,
    uTy = -1;
  var uLx = -k,
    uLy = 0.5;
  var uRx = k,
    uRy = 0.5;
  var nL = Math.sqrt((uTx + uLx) * (uTx + uLx) + (uTy + uLy) * (uTy + uLy));
  var bLx = (uTx + uLx) / nL,
    bLy = (uTy + uLy) / nL;
  var nR = Math.sqrt((uTx + uRx) * (uTx + uRx) + (uTy + uRy) * (uTy + uRy));
  var bRx = (uTx + uRx) / nR,
    bRy = (uTy + uRy) / nR;
  var rLbl = R * 0.82;
  var tpCx = Jx + rLbl * bLx,
    tpCy = Jy + rLbl * bLy;
  var ttpCx = Jx + rLbl * bRx,
    ttpCy = Jy + rLbl * bRy;
  var inrCx = cx;
  var inrCy = ly + 16;
  return (
    '<svg viewBox="0 0 270 172" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">' +
    '<line x1="' +
    Jx +
    '" y1="' +
    Jy +
    '" x2="' +
    tx +
    '" y2="' +
    ty +
    '" ' +
    LINE +
    "/>" +
    '<line x1="' +
    Jx +
    '" y1="' +
    Jy +
    '" x2="' +
    lx +
    '" y2="' +
    ly +
    '" ' +
    LINE +
    "/>" +
    '<line x1="' +
    Jx +
    '" y1="' +
    Jy +
    '" x2="' +
    rx +
    '" y2="' +
    ry +
    '" ' +
    LINE +
    "/>" +
    spBlock(tpCx, tpCy, "TP", tp, "middle") +
    spBlock(ttpCx, ttpCy, "TTP", ttp, "middle") +
    spBlock(inrCx, inrCy, "INR", inr, "middle") +
    "</svg>"
  );
}

export function copiarDiagrama(svgStr, vw, vh, title, btn) {
  var SCALE = 2;
  var TITLE_H = 18,
    MARGIN = 12;
  var cw = vw + MARGIN * 2,
    ch = vh + TITLE_H + MARGIN * 2;
  var canvas = document.createElement("canvas");
  canvas.width = cw * SCALE;
  canvas.height = ch * SCALE;
  var ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);

  var fixedSvg = svgStr.replace(/style="width:100%;display:block;"/, 'width="' + vw + '" height="' + vh + '"');
  var blob = new Blob([fixedSvg], { type: "image/svg+xml;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var img = new Image();
  img.onload = function () {
    ctx.font = "bold 9px Arial,sans-serif";
    ctx.fillStyle = "#aaaaaa";
    ctx.textAlign = "left";
    ctx.fillText(title.toUpperCase(), MARGIN, MARGIN + 9);
    ctx.drawImage(img, MARGIN, MARGIN + TITLE_H, vw, vh);
    URL.revokeObjectURL(url);
    canvas.toBlob(function (pngBlob) {
      if (!pngBlob) return;
      if (navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard
          .write([new ClipboardItem({ "image/png": pngBlob })])
          .then(function () {
            btn.textContent = "Copiado ✓";
            btn.classList.add("copied");
            setTimeout(function () {
              btn.textContent = "Copiar";
              btn.classList.remove("copied");
            }, 2000);
          })
          .catch(function () {
            var a = document.createElement("a");
            a.href = URL.createObjectURL(pngBlob);
            a.download = title.replace(/\s+/g, "-").toLowerCase() + ".png";
            a.click();
          });
      } else {
        var a2 = document.createElement("a");
        a2.href = URL.createObjectURL(pngBlob);
        a2.download = title.replace(/\s+/g, "-").toLowerCase() + ".png";
        a2.click();
      }
    }, "image/png");
  };
  img.onerror = function () {
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

const LAB_DIAGRAMS_COLLAPSED_KEY = "rpc-lab-diagrams-collapsed-v1";

function labDiagramsIsCollapsed() {
  try {
    return localStorage.getItem(LAB_DIAGRAMS_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLabDiagramsCollapsed(collapsed) {
  try {
    localStorage.setItem(LAB_DIAGRAMS_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch (_e) {
    void _e;
  }
  syncLabDiagramsCollapseUI();
}

export function toggleLabDiagramsSection() {
  setLabDiagramsCollapsed(!labDiagramsIsCollapsed());
}

export function syncLabDiagramsCollapseUI() {
  var sec = document.getElementById("lab-diagrams-section");
  var btn = document.querySelector(".lab-diagrams-toggle");
  if (!sec) return;
  var collapsed = labDiagramsIsCollapsed();
  sec.classList.toggle("is-collapsed", collapsed);
  if (btn) btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

export function renderDiagramas(resLabs) {
  var secs = parsearSecciones(resLabs);
  var grid = document.getElementById("diagrams-grid");
  grid.innerHTML = "";
  var cards = [
    { title: "Biometría Hemática", svg: svgBH(secs), w: 260, vw: 300, vh: 192 },
    { title: "Coagulación", svg: svgCoag(secs), w: 240, vw: 270, vh: 172 },
    { title: "Electrolitos / QS", svg: svgGamble(secs), w: 480, vw: 470, vh: 130 },
    { title: "Función Hepática", svg: svgPFH(secs), w: 220, vw: 270, vh: 230 },
    { title: "Gasometría", svg: svgGases(secs), w: 240, vw: 270, vh: 162 },
  ];
  var any = false;
  cards.forEach(function (c) {
    if (!c.svg) return;
    any = true;
    var div = document.createElement("div");
    div.className = "dcard";
    div.style.width = c.w + "px";
    var btn = document.createElement("button");
    btn.className = "dcard-copy";
    btn.textContent = "Copiar";
    var svgStr = c.svg,
      vw = c.vw,
      vh = c.vh,
      title = c.title;
    btn.onclick = function () {
      copiarDiagrama(svgStr, vw, vh, title, btn);
    };
    div.innerHTML = '<div class="dcard-title">' + c.title + "</div>" + c.svg;
    div.appendChild(btn);
    grid.appendChild(div);
  });
  document.getElementById("lab-diagrams-section").style.display = any ? "block" : "none";
  syncLabDiagramsCollapseUI();
}
