
"use strict";

/*
 TAR QuantFlow Terminal v0.2
 GC Futures historical research prototype
 Synthetic demo or imported aggressor-side trades
 No live market data or order execution
*/

const $ = id => document.getElementById(id);
const TICK = 0.1;
const POINT_VALUE = 100;

let trades = [];
let bars = [];
let visible = [];
let timer = null;
let source = "SYNTHETIC DEMO";

const FP = {
  ratio: 300,
  minVolume: 10,
  stack: 3,
  maxLevels: 150
};

const fmt = (n, d = 1) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });

const signed = n => n > 0 ? "+" + n : String(n);

function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/* ---------- DEMO DATA ---------- */

function makeDemo() {
  const r = seededRandom(481516);
  const data = [];
  let price = 4110;
  const start = Date.parse("2026-10-08T12:00:00Z");

  for (let i = 0; i < 1800; i++) {
    const n = r();
    const drift = i % 270 < 80 ? 0.018 : -0.01;

    price = Math.round(
      (price + (n < .46 ? -.1 : n > .55 ? .1 : 0)
      + drift) * 10
    ) / 10;

    data.push({
      ts: start + i * 12000,
      price,
      size: 1 + Math.floor(r() * 8),
      side: r() < (n > .53 ? .78 : n < .47 ? .22 : .5)
        ? "BUY" : "SELL"
    });
  }
  return data;
}

/* ---------- CSV PARSER ---------- */

function splitCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], value = "", quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(x => x.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += c;
    }
  }

  if (quoted) throw Error("Unclosed CSV quote");
  row.push(value);
  if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

function parseCSV(raw) {
  const rows = splitCSV(raw);
  if (rows.length < 2) throw Error("CSV has no trade rows");

  const headers = rows.shift().map(x =>
    x.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  const find = names =>
    headers.findIndex(h => names.includes(h));

  const ti = find(["timestamp", "datetime", "time", "tradetime"]);
  const pi = find(["price", "tradeprice"]);
  const si = find(["size", "volume", "qty", "quantity"]);
  const di = find(["side", "aggressorside", "aggressor"]);

  if ([ti, pi, si, di].some(x => x < 0)) {
    throw Error("Required: timestamp,price,size,side");
  }

  if (rows.length > 200000) {
    throw Error("MVP supports up to 200,000 trades");
  }

  const data = rows.map((row, i) => {
    const stamp = (row[ti] || "").trim();
    const ts = Date.parse(stamp);
    const price = Number(row[pi]);
    const size = Number(row[si]);
    const side = (row[di] || "").trim().toUpperCase();

    if (
      !/(Z|[+-]\d{2}:\d{2})$/i.test(stamp) ||
      !Number.isFinite(ts) ||
      !Number.isFinite(price) || price <= 0 ||
      !Number.isFinite(size) || size <= 0 ||
      !["BUY", "SELL"].includes(side)
    ) {
      throw Error("Invalid CSV row " + (i + 2));
    }

    return { ts, price, size, side };
  });

  data.sort((a, b) => a.ts - b.ts);
  return data;
}

/* ---------- BAR AGGREGATION ---------- */

function aggregate(data, seconds) {
  const map = new Map();
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  let cumulativeDelta = 0;

  for (const t of data) {
    const key =
      Math.floor(t.ts / (seconds * 1000)) * seconds * 1000;

    let b = map.get(key);

    if (!b) {
      b = {
        ts: key,
        open: t.price,
        high: t.price,
        low: t.price,
        close: t.price,
        volume: 0,
        delta: 0,
        vwap: 0,
        cvd: 0,
        levels: new Map()
      };
      map.set(key, b);
    }

    b.high = Math.max(b.high, t.price);
    b.low = Math.min(b.low, t.price);
    b.close = t.price;
    b.volume += t.size;

    const sign = t.side === "BUY" ? 1 : -1;
    b.delta += sign * t.size;

    const tick = Math.round(t.price / TICK);
    const level = b.levels.get(tick) || {
      buy: 0, sell: 0
    };

    if (sign > 0) level.buy += t.size;
    else level.sell += t.size;

    b.levels.set(tick, level);

    cumulativePV += t.price * t.size;
    cumulativeVolume += t.size;
    cumulativeDelta += sign * t.size;

    b.vwap = cumulativePV / cumulativeVolume;
    b.cvd = cumulativeDelta;
  }

  return [...map.values()].sort((a, b) => a.ts - b.ts);
}

/* ---------- CANVAS HELPERS ---------- */

function setupCanvas(id) {
  const canvas = $(id);
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);

  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);

  return { ctx, w: rect.width, h: rect.height };
}

function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/* ---------- CANDLESTICK + VWAP ---------- */

function drawPrice() {
  const s = setupCanvas("priceCanvas");
  if (!s || !visible.length) return;

  const { ctx, w, h } = s;
  const data = visible.slice(-100);

  const low = Math.min(...data.map(b => b.low)) - 1;
  const high = Math.max(...data.map(b => b.high)) + 1;

  const top = 15, bottom = h - 25;
  const left = 12, right = w - 70;

  const y = p =>
    top + (high - p) / (high - low) * (bottom - top);

  ctx.font = "11px monospace";

  for (let i = 0; i <= 5; i++) {
    const price = low + (high - low) * i / 5;
    const yy = y(price);
    line(ctx, left, yy, right, yy, "#27323d");
    ctx.fillStyle = "#91a0ae";
    ctx.fillText(fmt(price), right + 6, yy + 3);
  }

  const step = (right - left) / data.length;

  data.forEach((b, i) => {
    const x = left + (i + .5) * step;
    const color =
      b.close >= b.open ? "#39c9a0" : "#f1737b";

    line(ctx, x, y(b.high), x, y(b.low), color);

    ctx.fillStyle = color;
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
    if (i === 0) ctx.moveTo(x, y(b.vwap));
    else ctx.lineTo(x, y(b.vwap));
  });

  ctx.strokeStyle = "#d6ae63";
  ctx.lineWidth = 1.7;
  ctx.stroke();

  ctx.fillStyle = "#d6ae63";
  ctx.fillText("VWAP", 16, 18);
}

/* ---------- CVD ---------- */

function drawCVD() {
  const s = setupCanvas("cvdCanvas");
  if (!s || !visible.length) return;

  const { ctx, w, h } = s;
  const data = visible.slice(-100);

  const min = Math.min(0, ...data.map(b => b.cvd));
  const max = Math.max(0, ...data.map(b => b.cvd));
  const range = max - min || 1;
  const pad = 23;

  for (let i = 0; i < 4; i++) {
    const yy = pad + i * (h - 2 * pad) / 3;
    line(ctx, 10, yy, w - 10, yy, "#27323d");
  }

  ctx.beginPath();

  data.forEach((b, i) => {
    const x = 12 + i * (w - 26) /
      Math.max(1, data.length - 1);

    const y = pad +
      (max - b.cvd) / range * (h - 2 * pad);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = "#d6ae63";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#c2cbd4";
  ctx.font = "11px monospace";
  ctx.fillText(
    "CVD: " + signed(data.at(-1).cvd), 14, 15
  );
}

/* ---------- ADVANCED FOOTPRINT ---------- */

function imbalanceForBar(bar) {
  const output = new Map();
  const threshold = FP.ratio / 100;

  for (const [tick, qty] of bar.levels) {
    const belowBid =
      bar.levels.get(tick - 1)?.sell || 0;

    const aboveAsk =
      bar.levels.get(tick + 1)?.buy || 0;

    const buy =
      qty.buy >= FP.minVolume &&
      belowBid > 0 &&
      qty.buy / belowBid >= threshold;

    const sell =
      qty.sell >= FP.minVolume &&
      aboveAsk > 0 &&
      qty.sell / aboveAsk >= threshold;

    output.set(tick, {
      buy, sell,
      stackedBuy: false,
      stackedSell: false
    });
  }

  const ticks = [...output.keys()].sort((a, b) => a - b);

  for (const side of ["buy", "sell"]) {
    let run = [];

    function markRun() {
      if (run.length < FP.stack) return;

      for (const tick of run) {
        output.get(tick)[
          side === "buy" ? "stackedBuy" : "stackedSell"
        ] = true;
      }
    }

    for (const tick of ticks) {
      const qualifies = output.get(tick)[side];

      if (
        qualifies &&
        (!run.length || tick === run.at(-1) + 1)
      ) {
        run.push(tick);
      } else {
        markRun();
        run = qualifies ? [tick] : [];
      }
    }
    markRun();
  }

  return output;
}

function getBarPOC(bar) {
  let poc = null, max = -1;

  for (const [tick, q] of bar.levels) {
    const vol = q.buy + q.sell;
    if (vol > max) {
      max = vol;
      poc = tick;
    }
  }
  return poc;
}

function createFootprintControls() {
  if ($("fpAdvancedControls")) return;

  const controls = document.createElement("div");
  controls.id = "fpAdvancedControls";
  controls.className = "fp-controls";

  controls.innerHTML = `
    <label>Imbalance
      <select id="fpRatio">
        <option value="200">200%</option>
        <option value="300" selected>300%</option>
        <option value="400">400%</option>
        <option value="500">500%</option>
      </select>
    </label>

    <label>Min Volume
      <input id="fpMinVol"
        type="number" min="1" value="10">
    </label>

    <label>Stack
      <select id="fpStack">
        <option value="2">2 levels</option>
        <option value="3" selected>3 levels</option>
        <option value="4">4 levels</option>
      </select>
    </label>

    <label>
      <input id="fpHighlight"
        type="checkbox" checked>
      Highlight
    </label>

    <span class="fp-legend">
      Green = Buy | Red = Sell | Gold = POC
    </span>
  `;

  const grid = $("footprintGrid");
  grid.parentElement.insertBefore(controls, grid);

  ["fpRatio", "fpMinVol", "fpStack", "fpHighlight"]
    .forEach(id => {
      $(id).addEventListener("change", () => {
        FP.ratio = Number($("fpRatio").value);
        FP.minVolume = Math.max(
          1, Number($("fpMinVol").value) || 1
        );
        FP.stack = Number($("fpStack").value);
        drawFootprint();
      });
    });
}

function drawFootprint() {
  createFootprintControls();

  const target = $("footprintGrid");
  const data = visible.slice(-8);

  if (!data.length) {
    target.textContent = "No data";
    return;
  }

  const mode = $("fpMode").value;
  const highlight = $("fpHighlight").checked;

  const levels = [
    ...new Set(
      data.flatMap(b => [...b.levels.keys()])
    )
  ]
    .sort((a, b) => b - a)
    .slice(0, FP.maxLevels);

  const imbalance = data.map(imbalanceForBar);
  const barPOCs = data.map(getBarPOC);

  let html = '<table class="fpTable fpAdvanced">';
  html += '<thead><tr><th>PRICE</th>';

  data.forEach(b => {
    const time = new Date(b.ts)
      .toISOString().slice(11, 16);

    html += `
      <th>${time}
        <div class="fp-bar-delta ${
          b.delta >= 0 ? "fp-pos" : "fp-neg"
        }">
          Δ ${signed(b.delta)}
        </div>
      </th>
    `;
  });

  html += "</tr></thead><tbody>";

  for (const tick of levels) {
    html += `<tr><td class="level">${
      fmt(tick * TICK)
    }</td>`;

    data.forEach((bar, i) => {
      const q = bar.levels.get(tick);

      if (!q) {
        html += '<td class="flat">·</td>';
        return;
      }

      const im = imbalance[i].get(tick) || {};
      const classes = ["fp-cell"];

      if (q.buy > q.sell) classes.push("buy");
      else if (q.sell > q.buy) classes.push("sell");
      else classes.push("flat");

      if (barPOCs[i] === tick) {
        classes.push("fp-poc");
      }

      if (highlight) {
        if (im.buy) classes.push("fp-imb-buy");
        if (im.sell) classes.push("fp-imb-sell");

        if (im.stackedBuy) {
          classes.push("fp-stacked-buy");
        }
        if (im.stackedSell) {
          classes.push("fp-stacked-sell");
        }
      }

      const content = mode === "delta"
        ? signed(q.buy - q.sell)
        : `${q.sell} × ${q.buy}`;

      const marker = highlight
        ? (im.stackedBuy ? " ▲" : "") +
          (im.stackedSell ? " ▼" : "")
        : "";

      html += `
        <td class="${classes.join(" ")}"
          title="Bid ${q.sell} | Ask ${q.buy}
          | Delta ${q.buy - q.sell}
          | POC ${barPOCs[i] === tick}">
          ${content}${marker}
        </td>
      `;
    });

    html += "</tr>";
  }

  target.innerHTML = html + "</tbody></table>";
}

/* ---------- VOLUME PROFILE ---------- */

function drawProfile() {
  const profile = new Map();

  for (const bar of visible) {
    for (const [tick, q] of bar.levels) {
      const old = profile.get(tick) || 0;
      profile.set(tick, old + q.buy + q.sell);
    }
  }

  const rows = [...profile].sort((a, b) => b[0] - a[0]);
  const max = Math.max(1, ...profile.values());

  const poc = [...profile]
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  $("profileRows").innerHTML = rows.map(([tick, vol]) => `
    <div class="profrow ${tick === poc ? "poc" : ""}">
      <span>${fmt(tick * TICK)}</span>
      <div class="track">
        <div class="fill"
          style="width:${100 * vol / max}%">
        </div>
      </div>
      <em>${vol}</em>
    </div>
  `).join("");

  return poc == null ? null : poc * TICK;
}

/* ---------- RENDER ---------- */

function render() {
  if (!trades.length) return;

  bars = aggregate(trades, Number($("barSize").value));

  const end = Math.max(
    1,
    Math.round(
      bars.length * Number($("replay").value) / 100
    )
  );

  visible = bars.slice(0, end);
  const last = visible.at(-1);

  const volume = visible.reduce(
    (sum, b) => sum + b.volume, 0
  );

  const poc = drawProfile();

  $("lastPrice").textContent = fmt(last.close);
  $("totalVol").textContent = fmt(volume, 0);
  $("deltaStat").textContent = signed(last.cvd);

  $("deltaStat").style.color =
    last.cvd >= 0 ? "#39c9a0" : "#f1737b";

  $("pocStat").textContent =
    poc == null ? "—" : fmt(poc);

  $("vwapStat").textContent = fmt(last.vwap);

  $("replayInfo").textContent =
    `${end}/${bars.length} bars · ` +
    new Date(last.ts).toISOString()
      .slice(0, 16).replace("T", " ") +
    " UTC";

  drawPrice();
  drawCVD();
  drawFootprint();

  $("dataStatus").textContent =
    `${source} | ${trades.length} trade prints | ` +
    `${bars.length} bars | ` +
    new Date(trades[0].ts).toISOString() +
    " to " +
    new Date(trades.at(-1).ts).toISOString();
}

/* ---------- QUANT BACKTESTER ---------- */

function runBacktest() {
  const data = bars;

  const hold = Math.max(
    1, Math.floor(Number($("holdBars").value) || 3)
  );

  const slippage = Math.max(
    0, Number($("slipTicks").value) || 0
  ) * TICK;

  const commission = Math.max(
    0, Number($("commission").value) || 0
  );

  const contracts = Math.max(
    1, Math.floor(Number($("contracts").value) || 1)
  );

  const results = [];

  for (let i = 1; i < data.length - 1;) {
    const previous = data[i - 1];
    const current = data[i];

    const direction =
      previous.close <= previous.vwap &&
      current.close > current.vwap ? 1 :
      previous.close >= previous.vwap &&
      current.close < current.vwap ? -1 : 0;

    if (!direction) {
      i++;
      continue;
    }

    const entryIndex = i + 1;
    const exitIndex = entryIndex + hold;

    if (exitIndex >= data.length) break;

    const entry =
      data[entryIndex].open + direction * slippage;

    const exit =
      data[exitIndex].open - direction * slippage;

    const net =
      (exit - entry) * direction *
      POINT_VALUE * contracts -
      commission * contracts;

    results.push({
      time: new Date(data[entryIndex].ts)
        .toISOString().slice(0, 16),
      side: direction > 0 ? "LONG" : "SHORT",
      entry,
      exit,
      bars: hold,
      net
    });

    i = exitIndex + 1;
  }

  const total = results.reduce(
    (sum, x) => sum + x.net, 0
  );

  const winners = results.filter(x => x.net > 0);

  const grossProfit = winners.reduce(
    (sum, x) => sum + x.net, 0
  );

  const grossLoss = -results
    .filter(x => x.net < 0)
    .reduce((sum, x) => sum + x.net, 0);

  const metrics = [
    ["NET P&L", "$" + fmt(total, 2)],
    ["TRADES", String(results.length)],
    ["WIN RATE", results.length
      ? fmt(winners.length / results.length * 100, 1) + "%"
      : "—"],
    ["PROFIT FACTOR", grossLoss
      ? fmt(grossProfit / grossLoss, 2)
      : grossProfit ? "∞" : "—"],
    ["AVG TRADE", results.length
      ? "$" + fmt(total / results.length, 2)
      : "—"]
  ];

  $("btStats").innerHTML = metrics.map(([name, value]) => `
    <article>
      <small>${name}</small>
      <strong>${value}</strong>
    </article>
  `).join("");

  $("btRows").innerHTML = results.map(x => `
    <tr>
      <td>${x.time} UTC</td>
      <td>${x.side}</td>
      <td>${fmt(x.entry)}</td>
      <td>${fmt(x.exit)}</td>
      <td>${x.bars}</td>
      <td style="color:${
        x.net >= 0 ? "#39c9a0" : "#f1737b"
      }">
        $${fmt(x.net, 2)}
      </td>
    </tr>
  `).join("") ||
    '<tr><td colspan="6">No completed trades</td></tr>';
}

/* ---------- DATA LOADING ---------- */

function loadData(data, label) {
  if (timer) {
    clearInterval(timer);
    timer = null;
    $("playBtn").textContent = "▶ Play";
  }

  trades = data;
  source = label;

  $("sourceBadge").textContent = label;
  $("replay").value = 100;

  render();
  runBacktest();
}

$("fileInput").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const data = parseCSV(await file.text());
    loadData(data, "IMPORTED CSV");

    alert(
      `${data.length} trade prints imported successfully.`
    );
  } catch (error) {
    alert("CSV import failed: " + error.message);
  }

  event.target.value = "";
});

$("demoBtn").onclick = () =>
  loadData(makeDemo(), "SYNTHETIC DEMO");

$("barSize").onchange = () => {
  render();
  runBacktest();
};

$("fpMode").onchange = drawFootprint;
$("replay").oninput = render;
$("runBacktest").onclick = runBacktest;

/* ---------- NAVIGATION ---------- */

document.querySelectorAll(".nav").forEach(button => {
  button.onclick = () => {
    document.querySelectorAll(".nav").forEach(b =>
      b.classList.remove("active")
    );

    button.classList.add("active");

    document.querySelectorAll(".panel").forEach(p =>
      p.classList.add("hidden")
    );

    const name = button.dataset.panel;
    $(name).classList.remove("hidden");

    const titles = {
      terminal: "Order Flow Terminal",
      quant: "Quant Backtester",
      data: "Data Manager"
    };

    const descriptions = {
      terminal:
        "GC Historical Trades · Advanced Footprint · CVD",
      quant:
        "Historical Strategy Research · Cost-Aware Backtesting",
      data:
        "Historical CSV Import · Data Export"
    };

    $("panelTitle").textContent = titles[name];
    $("panelSubtitle").textContent = descriptions[name];

    if (name === "terminal") {
      requestAnimationFrame(render);
    }

    if (name === "quant") runBacktest();
  };
});

/* ---------- REPLAY ---------- */

$("playBtn").onclick = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    $("playBtn").textContent = "▶ Play";
    return;
  }

  if (+$("replay").value >= 100) {
    $("replay").value = 1;
  }

  $("playBtn").textContent = "Ⅱ Pause";

  timer = setInterval(() => {
    const next = Math.min(
      100, Number($("replay").value) + 1
    );

    $("replay").value = next;
    render();

    if (next >= 100) {
      clearInterval(timer);
      timer = null;
      $("playBtn").textContent = "▶ Play";
    }
  }, 180);
};

/* ---------- EXPORT ---------- */

$("exportBtn").onclick = () => {
  const rows = [
    "timestamp,price,size,side",
    ...trades.map(t =>
      `${new Date(t.ts).toISOString()},` +
      `${t.price},${t.size},${t.side}`
    )
  ];

  const blob = new Blob(
    [rows.join("\n")],
    { type: "text/csv;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "tar-quantflow-trades.csv";
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/* ---------- RESPONSIVE ---------- */

window.addEventListener("resize", () => {
  if (!$("terminal").classList.contains("hidden")) {
    drawPrice();
    drawCVD();
  }
});

/* ---------- START ---------- */

loadData(makeDemo(), "SYNTHETIC DEMO");
