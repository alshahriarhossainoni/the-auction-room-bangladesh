(() => {
  const DATASET = '72hh-3qpy';
  const API_BASE = `https://publicreporting.cftc.gov/resource/${DATASET}.json`;
  const FALLBACK = 'cot-fallback.json?v=3';

  const canvas = document.getElementById('cotChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const tooltip = document.getElementById('cotTooltip');
  const statusText = document.getElementById('cotSourceStatus');
  const statusDot = document.getElementById('cotSourceDot');
  const syncText = document.getElementById('cotLastSync');
  const refreshBtn = document.getElementById('refreshCot');

  let data = null, series = 'net', coords = [];

  const fmt = n => new Intl.NumberFormat('en-US').format(Math.round(Number(n) || 0));
  const signed = n => `${Number(n) >= 0 ? '+' : ''}${fmt(n)}`;

  function setSource(type, text) {
    statusDot.className = `source-dot ${type}`;
    statusText.textContent = text;
  }

  function n(row, names) {
    for (const k of names) {
      if (row && row[k] !== undefined && row[k] !== null && row[k] !== '') {
        const v = Number(String(row[k]).replace(/,/g,''));
        if (Number.isFinite(v)) return v;
      }
    }
    return 0;
  }

  function s(row, names) {
    for (const k of names) if (row && row[k]) return String(row[k]);
    return '';
  }

  function dateOnly(raw) {
    if (!raw) return '';
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0,10);
    return String(raw).slice(0,10);
  }

  async function fetchCftc() {
    setSource('loading','Connecting to CFTC…');

    const params = new URLSearchParams();
    params.set('$limit', '60');
    params.set('$order', 'report_date_as_yyyy_mm_dd DESC');
    params.set('$where', "market_and_exchange_names like 'GOLD%'");

    const res = await fetch(`${API_BASE}?${params.toString()}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`CFTC HTTP ${res.status}`);

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length < 2) throw new Error('No usable Gold COT rows returned');

    const mapped = rows.map(row => {
      const long = n(row, [
        'm_money_positions_long_all',
        'm_money_positions_long',
        'managed_money_positions_long_all'
      ]);
      const short = n(row, [
        'm_money_positions_short_all',
        'm_money_positions_short',
        'managed_money_positions_short_all'
      ]);
      return {
        date: dateOnly(s(row,['report_date_as_yyyy_mm_dd','report_date'])),
        label: dateOnly(s(row,['report_date_as_yyyy_mm_dd','report_date'])).slice(2),
        long,
        short,
        net: long - short,
        openInterest: n(row,['open_interest_all','open_interest'])
      };
    }).filter(p => p.date && (p.long || p.short));

    if (mapped.length < 2) throw new Error('Managed-money columns not found in CFTC response');

    mapped.sort((a,b) => a.date.localeCompare(b.date));
    const points = mapped.slice(-52);
    const latest = points.at(-1);
    const previous = points.at(-2);
    const third = points.at(-3) || previous;

    const denom = Math.max(Math.abs(third.net), 1);
    const score = Math.max(-100, Math.min(100, Math.round(((latest.net - third.net) / denom) * 100)));
    const bias = score >= 5 ? 'Bullish' : score <= -5 ? 'Bearish' : 'Neutral';

    return {
      reportDate: latest.date,
      score,
      bias,
      latest,
      previous,
      points,
      source: 'CFTC live'
    };
  }

  async function fetchFallback() {
    const res = await fetch(FALLBACK, { cache:'no-store' });
    if (!res.ok) throw new Error('Fallback unavailable');
    const d = await res.json();
    return { ...d, source:'Cached snapshot' };
  }

  async function load() {
    refreshBtn.disabled = true;
    try {
      data = await fetchCftc();
      setSource('live','Live CFTC data');
      syncText.textContent = `Live from CFTC • synced ${new Date().toLocaleString()}`;
    } catch (err) {
      console.warn('Live CFTC fetch failed:', err);
      try {
        data = await fetchFallback();
        setSource('cached','Cached COT snapshot');
        syncText.textContent = `CFTC connection unavailable • showing cached snapshot dated ${data.reportDate}`;
      } catch (fallbackErr) {
        setSource('error','COT data unavailable');
        syncText.textContent = 'Could not load live or cached COT data.';
        refreshBtn.disabled = false;
        return;
      }
    }
    hydrate();
    draw();
    refreshBtn.disabled = false;
  }

  function hydrate() {
    const l = data.latest, p = data.previous;
    document.getElementById('cotReportDate').textContent = `COT report • As of ${data.reportDate}`;
    document.getElementById('cotScore').textContent = data.score >= 0 ? `+${data.score}` : data.score;
    const bias = document.getElementById('cotBias');
    bias.textContent = data.bias;
    bias.className = 'cot-bias ' + String(data.bias).toLowerCase();

    document.getElementById('prevNet').textContent = signed(p.net);
    document.getElementById('latestNetInline').textContent = signed(l.net);
    const netValueEl = document.getElementById('netValue');
    netValueEl.textContent = signed(l.net);
    netValueEl.className = l.net > 0 ? 'positive-value' : l.net < 0 ? 'negative-value' : '';
    const longValueEl = document.getElementById('longValue');
    longValueEl.textContent = fmt(l.long);
    longValueEl.className = 'long-value';
    const shortValueEl = document.getElementById('shortValue');
    shortValueEl.textContent = fmt(l.short);
    shortValueEl.className = 'short-value';

    setDelta('netDelta', l.net - p.net);
    setDelta('longDelta', l.long - p.long);
    setDelta('shortDelta', l.short - p.short);

    const netDelta = l.net - p.net;
    const longDelta = l.long - p.long;
    const shortDelta = l.short - p.short;
    const badge = document.getElementById('trendBadge');

    if (netDelta > 0 && (longDelta > 0 || shortDelta < 0)) {
      badge.textContent = '↑ Net positioning rising • bullish pressure';
      badge.className = 'trend-badge bullish';
    } else if (netDelta < 0 && (shortDelta > 0 || longDelta < 0)) {
      badge.textContent = '↓ Net positioning falling • bearish pressure';
      badge.className = 'trend-badge bearish';
    } else {
      badge.textContent = 'Mixed weekly positioning';
      badge.className = 'trend-badge neutral';
    }

    const pts = data.points;
    const p3 = pts.at(-3) || p;
    const p6 = pts.at(-6) || p3;
    setSignal('signalOne', netDelta > 0 ? 'Net long increased' : netDelta < 0 ? 'Net long decreased' : 'Unchanged', netDelta);
    setSignal('signalThree', l.net > p3.net ? 'Accumulation' : l.net < p3.net ? 'Distribution' : 'Flat', l.net - p3.net);
    setSignal('signalSix', l.net > p6.net ? 'Net long structure rising' : l.net < p6.net ? 'Net long structure falling' : 'Balanced', l.net - p6.net);
    document.getElementById('chartRangeLabel').textContent = `Latest ${pts.length} reports`;
  }

  function setSignal(id, text, direction) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = direction > 0 ? 'signal-bullish' : direction < 0 ? 'signal-bearish' : 'signal-neutral';
  }

  function setDelta(id, value) {
    const el = document.getElementById(id);
    el.textContent = `${value >= 0 ? '↑' : '↓'} ${signed(value)}`;
    el.className = value >= 0 ? 'up' : 'down';
  }

  document.querySelectorAll('.cot-toggle button').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.cot-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    series = btn.dataset.series;
    document.getElementById('chartLabel').textContent = `${btn.textContent} positioning`;
    draw();
  }));

  refreshBtn.addEventListener('click', load);

  function resize() {
    const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(600, Math.floor(rect.width * dpr));
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return rect;
  }

  function draw() {
    if (!data || !data.points?.length) return;
    const rect = resize(), w = rect.width, h = rect.height;
    ctx.clearRect(0,0,w,h);
    const vals = data.points.map(p => Number(p[series]) || 0);
    let min = Math.min(...vals), max = Math.max(...vals);
    const pad = (max-min)*.16 || Math.max(Math.abs(max)*.1,1);
    min -= pad; max += pad;

    const L=55,R=12,T=16,B=38,gw=w-L-R,gh=h-T-B;
    ctx.strokeStyle='rgba(255,255,255,.065)';
    ctx.lineWidth=1;
    ctx.setLineDash([3,4]);
    ctx.font='11px Inter';
    ctx.fillStyle='#77736c';

    for(let i=0;i<5;i++){
      const y=T+gh*(i/4);
      ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(w-R,y);ctx.stroke();
      const v=max-(max-min)*(i/4);
      const label=Math.abs(v)>=1000 ? `${Math.round(v/1000)}k` : Math.round(v);
      ctx.fillText(label,4,y+4);
    }
    ctx.setLineDash([]);

    coords=data.points.map((p,i)=>({
      x:L+gw*(data.points.length===1?0:i/(data.points.length-1)),
      y:T+gh*(1-(p[series]-min)/(max-min)),
      p
    }));

    const GREEN = '#65d990';
    const RED = '#ff7474';
    const colorForValue = v => v >= 0 ? GREEN : RED;
    const seriesColor = series === 'long' ? GREEN : series === 'short' ? RED : colorForValue(vals.at(-1));
    const fillTop = series === 'long' ? 'rgba(101,217,144,.22)' : series === 'short' ? 'rgba(255,116,116,.20)' : (vals.at(-1) >= 0 ? 'rgba(101,217,144,.20)' : 'rgba(255,116,116,.20)');

    const grad=ctx.createLinearGradient(0,T,0,T+gh);
    grad.addColorStop(0,fillTop);
    grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath();
    coords.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y));
    ctx.lineTo(coords.at(-1).x,T+gh);ctx.lineTo(coords[0].x,T+gh);ctx.closePath();
    ctx.fillStyle=grad;ctx.fill();

    ctx.lineWidth=2.1;
    ctx.lineJoin='round';
    ctx.lineCap='round';
    if (series === 'net') {
      for (let i=1;i<coords.length;i++) {
        const a=coords[i-1], b=coords[i];
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.strokeStyle=colorForValue(b.p.net);ctx.stroke();
      }
    } else {
      ctx.beginPath();
      coords.forEach((c,i)=>i?ctx.lineTo(c.x,c.y):ctx.moveTo(c.x,c.y));
      ctx.strokeStyle=seriesColor;ctx.stroke();
    }

    const last=coords.at(-1);
    ctx.beginPath();ctx.arc(last.x,last.y,4,0,Math.PI*2);ctx.fillStyle=seriesColor;ctx.fill();

    ctx.fillStyle='#77736c';ctx.font='11px Inter';
    const step=Math.max(1,Math.floor(data.points.length/7));
    for(let i=0;i<data.points.length;i+=step){
      ctx.fillText(data.points[i].label,Math.max(L,coords[i].x-18),h-11);
    }
  }

  canvas.addEventListener('mousemove', e => {
    if (!coords.length) return;
    const r=canvas.getBoundingClientRect(), x=e.clientX-r.left;
    const c=coords.reduce((a,b)=>Math.abs(b.x-x)<Math.abs(a.x-x)?b:a);
    tooltip.hidden=false;
    const netClass = c.p.net >= 0 ? 'tip-positive' : 'tip-negative';
    tooltip.innerHTML=`<b>${c.p.date || c.p.label}</b><br>Net <span class="${netClass}">${signed(c.p.net)}</span><br>Long <span class="tip-long">${fmt(c.p.long)}</span><br>Short <span class="tip-short">${fmt(c.p.short)}</span>`;
    tooltip.style.left=Math.min(c.x+14,r.width-190)+'px';
    tooltip.style.top=Math.max(10,c.y-55)+'px';
  });

  canvas.addEventListener('mouseleave',()=>tooltip.hidden=true);
  window.addEventListener('resize',draw);

  load();
})();
