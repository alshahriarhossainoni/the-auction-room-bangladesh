
"use strict";

const $ = id => document.getElementById(id);
const TICK = 0.1;
let trades = [], bars = [], visible = [];
let timer = null, source = "SYNTHETIC DEMO";

const fmt = (n, d = 1) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });

function randomGenerator(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function demo() {
  const r = randomGenerator(481516), arr = [];
  let p = 4110;
  const start = Date.parse("2026-10-08T12:00:00Z");

  for (let i = 0; i < 1800; i++) {
    const move = r();
    p = Math.round(
      (p + (move < .46 ? -.1 : move > .55 ? .1 : 0)
        + (i % 270 < 80 ? .018 : -.01)) * 10
    ) / 10;

    arr.push({
      ts: start + i * 12000,
      price: p,
      size: 1 + Math.floor(r() * 8),
      side: r() < (move > .53 ? .78 : move < .47 ? .22 : .5)
        ? "BUY" : "SELL"
    });
  }
  return arr;
}

function csvRows(s) {
  s = s.replace(/^\uFEFF/, "");
  let rows = [], row = [], v = "", quoted = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') {
        v += '"'; i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(v); v = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(v);
      if (row.some(x => x.trim())) rows.push(row);
      row = []; v = "";
    } else v += c;
  }
  row.push(v);
  if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

function parseCSV(raw) {
  const rows = csvRows(raw);
  if (rows.length < 2) throw Error("CSV has no trade rows");

  const h = rows.shift().map(x =>
    x.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
  );
  const index = keys => h.findIndex(x => keys.includes(x));

  const ti = index(["timestamp", "time", "datetime", "tradetime"]);
  const pi = index(["price", "tradeprice"]);
  const si = index(["size", "volume", "qty", "quantity"]);
  const di = index(["side", "aggressorside", "aggressor"]);

  if ([ti, pi, si, di].some(x => x < 0)) {
    throw Error("Required columns: timestamp, price, size, side");
  }

  const result = [];
  for (let n = 0; n < rows.length; n++) {
    const row = rows[n];
    const str = row[ti]?.trim();
    const ts = Date.parse(str);
    const price = Number(row[pi]);
    const size = Number(row[si]);
    const side = row[di]?.trim().toUpperCase();

    if (
      !/(Z|[+-]\d\d:\d\d)$/.test(str || "") ||
      !Number.isFinite(ts) ||
      !Number.isFinite(price) || price <= 0 ||
      !Number.isFinite(size) || size <= 0 ||
      !["BUY", "SELL"].includes(side)
    ) {
      throw Error("Invalid CSV row " + (n + 2));
    }
    result.push({ ts, price, size, side });
  }

  if (result.length > 200000)
    throw Error("MVP limit: 200,000 trades");

  result.sort((a, b) => a.ts - b.ts);
  return result;
}

function aggregate(data, sec) {
  const m = new Map();
  let cumPV = 0, cumVol = 0, cumDelta = 0;

  for (const t of data) {
    const key = Math.floor(t.ts / (sec * 1000)) * sec * 1000;
    let b = m.get(key);

    if (!b) {
      b = {
        ts: key, open: t.price, high: t.price,
        low: t.price, close: t.price,
        volume: 0, delta: 0, levels: new Map(),
        vwap: 0, cvd: 0
      };
      m.set(key, b);
    }

    b.high = Math.max(b.high, t.price);
    b.low = Math.min(b.low, t.price);
    b.close = t.price;
    b.volume += t.size;

    const sign = t.side === "BUY" ? 1 : -1;
    b.delta += sign * t.size;

    const k = Math.round(t.price / TICK);
    const lev = b.levels.get(k) || { buy: 0, sell: 0 };
    lev[t.side === "BUY" ? "buy" : "sell"] += t.size;
    b.levels.set(k, lev);

    cumPV += t.price * t.size;
    cumVol += t.size;
    cumDelta += sign * t.size;
    b.vwap = cumPV / cumVol;
    b.cvd = cumDelta;
  }
  return [...m.values()].sort((a, b) => a.ts - b.ts);
}

function canvasSetup(id) {
  const c = $(id);
  const dpr = window.devicePixelRatio || 1;
  const rect = c.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  c.width = Math.floor(rect.width * dpr);
  c.height = Math.floor(rect.height * dpr);
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

function line(ctx, x1, y1, x2, y2, color = "#34404b", width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawPrice() {
  const s = canvasSetup("priceCanvas");
  if (!s || !visible.length) return;

  const { ctx, w, h } = s;
  const data = visible.slice(-100);
  const lo = Math.min(...data.map(x => x.low)) - 1;
  const hi = Math.max(...data.map(x => x.high)) + 1;
  const top = 15, bottom = h - 25, left = 12, right = w - 67;
  const y = p => top + (hi - p) / (hi - lo) * (bottom - top);

  ctx.font = "11px monospace";
  for (let i = 0; i < 6; i++) {
    const p = lo + (hi - lo) * i / 5, yy = y(p);
    line(ctx, left, yy, right, yy, "#25313b");
    ctx.fillStyle = "#8d9aaa";
    ctx.fillText(fmt(p), right + 6, yy + 3);
  }

  const step = (right - left) / data.length;
  data.forEach((b, i) => {
    const x = left + (i + .5) * step;
    const col = b.close >= b.open ? "#37c49b" : "#f1737b";
    line(ctx, x, y(b.high), x, y(b.low), col);
    ctx.fillStyle = col;
    ctx.fillRect(
      x - Math.max(1, step * .3),
      Math.min(y(b.open), y(b.close)),
      Math.max(2, step * .6),
      Math.max(1, Math.abs(y(b.open) - y(b.close)))
    );
  });

  ctx.beginPath();
  data.forEach((b, i) => {
    const x = left + (i + .5) * step;
    if (i) ctx.lineTo(x, y(b.vwap));
    else ctx.moveTo(x, y(b.vwap));
  });
  ctx.strokeStyle = "#d6ae63";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = "#d6ae63";
  ctx.fillText("VWAP", left + 7, top + 10);
}

function drawCVD() {
  const s = canvasSetup("cvdCanvas");
  if (!s || !visible.length) return;

  const { ctx, w, h } = s;
  const data = visible.slice(-100);
  const min = Math.min(0, ...data.map(b => b.cvd));
  const max = Math.max(0, ...data.map(b => b.cvd));
  const rng = max - min || 1, pad = 22;

  for (let i = 0; i < 4; i++) {
    const yy = pad + (h - pad * 2) * i / 3;
    line(ctx, 8, yy, w - 10, yy, "#26323d");
  }

  ctx.beginPath();
  data.forEach((b, i) => {
    const x = 12 + i * (w - 26) / Math.max(1, data.length - 1);
    const y = pad + (max - b.cvd) / rng * (h - pad * 2);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.strokeStyle = "#d6ae63";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#b5c0cb";
  ctx.font = "11px monospace";
  ctx.fillText("CVD: " + fmt(data.at(-1).cvd, 0), 14, 15);
}

function drawFootprint() {
  const subset = visible.slice(-8);
  const levels = [
    ...new Set(subset.flatMap(b => [...b.levels.keys()]))
  ].sort((a, b) => b - a).slice(0, 100);

  let html = '<table class="fpTable"><thead><tr><th>Price</th>';
  html += subset.map(b =>
    "<th>" + new Date(b.ts).toISOString().slice(11, 16) + "</th>"
  ).join("");
  html += "</tr></thead><tbody>";

  for (const level of levels) {
    html += '<tr><td class="level">' + fmt(level * TICK) + "</td>";

    for (const b of subset) {
      const l = b.levels.get(level);
      if (!l) {
        html += '<td class="flat">·</td>';
        continue;
      }
      const val = $("fpMode").value === "delta"
        ? String(l.buy - l.sell)
        : `${l.sell} × ${l.buy}`;

      const cls = l.buy > l.sell ? "buy" :
                  l.sell > l.buy ? "sell" : "flat";
      html += `<td class="${cls}">${val}</td>`;
    }
    html += "</tr>";
  }
  $("footprintGrid").innerHTML = html + "</tbody></table>";
}

function drawProfile() {
  const m = new Map();
  for (const b of visible) {
    for (const [p, l] of b.levels) {
      m.set(p, (m.get(p) || 0) + l.buy + l.sell);
    }
  }

  const list = [...m].sort((a, b) => b[0] - a[0]);
  const max = Math.max(1, ...m.values());
  const poc = [...m].sort((a, b) => b[1] - a[1])[0]?.[0];

  $("profileRows").innerHTML = list.map(([p, v]) =>
    `<div class="profrow ${p === poc ? "poc" : ""}">
      <span>${fmt(p * TICK)}</span>
      <div class="track"><div class="fill"
        style="width:${100 * v / max}%"></div></div>
      <em>${v}</em>
    </div>`
  ).join("");

  return poc === undefined ? null : poc * TICK;
}

function render() {
  if (!trades.length) return;

  bars = aggregate(trades, Number($("barSize").value));
  const end = Math.max(
    1, Math.round(bars.length * Number($("replay").value) / 100)
  );
  visible = bars.slice(0, end);

  const last = visible.at(-1);
  const vol = visible.reduce((a, b) => a + b.volume, 0);
  const poc = drawProfile();

  $("lastPrice").textContent = fmt(last.close);
  $("totalVol").textContent = fmt(vol, 0);
  $("deltaStat").textContent = fmt(last.cvd, 0);
  $("deltaStat").style.color =
    last.cvd >= 0 ? "#39c9a0" : "#f1737b";
  $("pocStat").textContent = poc === null ? "—" : fmt(poc);
  $("vwapStat").textContent = fmt(last.vwap);

  $("replayInfo").textContent =
    `${end}/${bars.length} bars · ` +
    new Date(last.ts).toISOString().slice(0, 16).replace("T", " ") +
    " UTC";

  drawPrice();
  drawCVD();
  drawFootprint();

  $("dataStatus").textContent =
    `${source}: ${fmt(trades.length, 0)} trade prints, ` +
    `${bars.length} bars. Time range ` +
    `${new Date(trades[0].ts).toISOString()} – ` +
    `${new Date(trades.at(-1).ts).toISOString()}.`;
}

function backtest() {
  const data = bars;
  const hold = Math.max(1, Math.floor(Number($("holdBars").value) || 3));
  const slip = Math.max(0, Number($("slipTicks").value) || 0) * TICK;
  const fee = Math.max(0, Number($("commission").value) || 0);
  const qty = Math.max(1, Math.floor(Number($("contracts").value) || 1));
  let results = [];

  for (let i = 1; i < data.length - 1;) {
    const prev = data[i - 1], cur = data[i];
    let dir =
      prev.close <= prev.vwap && cur.close > cur.vwap ? 1 :
      prev.close >= prev.vwap && cur.close < cur.vwap ? -1 : 0;

    if (!dir) { i++; continue; }

    const entryIndex = i + 1;
    const exitIndex = Math.min(entryIndex + hold, data.length - 1);
    if (exitIndex <= entryIndex) break;

    const entry = data[entryIndex].open + dir * slip;
    const exit = data[exitIndex].open - dir * slip;
    const net = (exit - entry) * dir * 100 * qty - fee * qty;

    results.push({
      time: new Date(data[entryIndex].ts)
        .toISOString().slice(0, 16).replace("T", " "),
      side: dir === 1 ? "LONG" : "SHORT",
      entry, exit,
      bars: exitIndex - entryIndex,
      net
    });
    i = exitIndex + 1;
  }

  const net = results.reduce((a, b) => a + b.net, 0);
  const wins = results.filter(x => x.net > 0);
  const gp = wins.reduce((a, b) => a + b.net, 0);
  const gl = -results.filter(x => x.net < 0)
    .reduce((a, b) => a + b.net, 0);

  const metrics = [
    ["NET P&L", "$" + fmt(net, 2)],
    ["TRADES", String(results.length)],
    ["WIN RATE", results.length
      ? fmt(100 * wins.length / results.length, 1) + "%" : "—"],
    ["PROFIT FACTOR", gl ? fmt(gp / gl, 2) : gp ? "∞" : "—"],
    ["AVG TRADE", results.length
      ? "$" + fmt(net / results.length, 2) : "—"]
  ];

  $("btStats").innerHTML = metrics.map(([k, v]) =>
    `<article><small>${k}</small><strong>${v}</strong></article>`
  ).join("");

  $("btRows").innerHTML = results.map(x =>
    `<tr><td>${x.time}</td><td>${x.side}</td>
    <td>${fmt(x.entry)}</td><td>${fmt(x.exit)}</td>
    <td>${x.bars}</td>
    <td style="color:${x.net >= 0 ? "#39c9a0" : "#f1737b"}">
      $${fmt(x.net, 2)}</td></tr>`
  ).join("") || '<tr><td colspan="6">No trades under this rule.</td></tr>';
}

function load(data, label) {
  trades = data;
  source = label;
  $("sourceBadge").textContent = label;
  $("replay").value = 100;
  render();
  backtest();
}

$("fileInput").addEventListener("change", async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const parsed = parseCSV(await f.text());
    load(parsed, "IMPORTED CSV");
    alert(`Loaded ${parsed.length} trade prints. Data stays in this browser tab.`);
  } catch (err) {
    alert("CSV import failed: " + err.message);
  }
  e.target.value = "";
});

$("demoBtn").onclick = () => load(demo(), "SYNTHETIC DEMO");

$("barSize").onchange = () => {
  render();
  backtest();
};
$("fpMode").onchange = drawFootprint;
$("replay").oninput = render;
$("runBacktest").onclick = backtest;

for (const b of document.querySelectorAll(".nav")) {
  b.onclick = () => {
    document.querySelectorAll(".nav").forEach(n =>
      n.classList.remove("active")
    );
    b.classList.add("active");
    document.querySelectorAll(".panel").forEach(n =>
      n.classList.add("hidden")
    );
    $(b.dataset.panel).classList.remove("hidden");

    $("panelTitle").textContent = {
      terminal: "Order Flow Terminal",
      quant: "Quant Backtester",
      data: "Data Manager"
    }[b.dataset.panel];

    $("panelSubtitle").textContent = {
      terminal: "Historical GC trade prints · Footprint · CVD · Volume Profile",
      quant: "Historical strategy research · Cost-aware simulations",
      data: "Import licensed trade prints · Browser-local data"
    }[b.dataset.panel];

    if (b.dataset.panel === "terminal") requestAnimationFrame(render);
    if (b.dataset.panel === "quant") backtest();
  };
}

$("playBtn").onclick = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    $("playBtn").textContent = "▶ Play";
    return;
  }
  if (+$("replay").value >= 100) $("replay").value = 1;
  $("playBtn").textContent = "Ⅱ Pause";

  timer = setInterval(() => {
    const next = Math.min(100, +$("replay").value + 1);
    $("replay").value = next;
    render();
    if (next >= 100) {
      clearInterval(timer);
      timer = null;
      $("playBtn").textContent = "▶ Play";
    }
  }, 180);
};

$("exportBtn").onclick = () => {
  const lines = [
    "timestamp,price,size,side",
    ...trades.map(t =>
      `${new Date(t.ts).toISOString()},${t.price},${t.size},${t.side}`
    )
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join("\n")], { type: "text/csv" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "tar-quantflow-trades.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

window.addEventListener("resize", () => {
  if (!$("terminal").classList.contains("hidden")) {
    drawPrice();
    drawCVD();
  }
});

load(demo(), "SYNTHETIC DEMO");
