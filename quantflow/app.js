'use strict';
const $=id=>document.getElementById(id), TICK=.1, POINT=100;
let trades=[],bars=[],shown=[],playing=null,source='SYNTHETIC DEMO',dataMode='TICKS',ohlcv=[],ohlcvCap=80000;
const money=(x,d=1)=>Number(x).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const sign=x=>x>0?'+'+money(x,0):money(x,0);
const rng=(seed)=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function demo(){const rand=rng(1480),start=Date.parse('2026-10-07T22:00:00Z'),a=[];let tick=41100;for(let i=0;i<2400;i++){const drift=(i%650<270?.08:-.05);if(rand()<.67)tick+=rand()<.5+drift?-1:1;tick=Math.max(100,tick);a.push({ts:start+i*12000,price:tick*TICK,size:1+Math.floor(rand()*15),side:rand()<(.5+drift)?'BUY':'SELL'});}return a;}
function csvRows(text){text=text.replace(/^\uFEFF/,'');let rows=[],row=[],s='',quoted=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){s+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(s);s='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(s);if(row.some(v=>v.trim()))rows.push(row);row=[];s='';}else s+=c;}if(quoted)throw Error('Unclosed quote');row.push(s);if(row.some(v=>v.trim()))rows.push(row);return rows;}
function parse(text){const rows=csvRows(text);if(rows.length<2)throw Error('No data');const h=rows.shift().map(s=>s.toLowerCase().replace(/[^a-z0-9]/g,''));const idx=(...names)=>h.findIndex(x=>names.includes(x));const t=idx('timestamp','datetime','time'),p=idx('price'),q=idx('size','volume','qty','quantity'),s=idx('side','aggressorside');if([t,p,q,s].includes(-1))throw Error('CSV needs timestamp,price,size,side');if(rows.length>200000)throw Error('Max 200,000 rows');return rows.map((r,i)=>{let stamp=(r[t]||'').trim(),ts=Date.parse(stamp),price=Number(r[p]),size=Number(r[q]),side=(r[s]||'').trim().toUpperCase();if(!/(Z|[+-]\d\d:\d\d)$/i.test(stamp)||!Number.isFinite(ts)||!Number.isFinite(price)||price<=0||!Number.isFinite(size)||size<=0||!['BUY','SELL'].includes(side))throw Error('Invalid row '+(i+2));return {ts,price,size,side};}).sort((a,b)=>a.ts-b.ts);}
// A session is named for the UTC date of its start. Set 22 or 23 UTC as appropriate for daylight savings.
// MotiveWave headerless 1-minute ETH export: YYYYMMDD HHMMSS,Open,High,Low,Close,Volume.
// Timestamp timezone is explicitly selected by the user; defaults to UTC (verify MotiveWave export timezone).
function parseMWLine(line, offsetHours){
 const c=line.trim().split(',');if(c.length<6)return null;
 const m=/^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})(\d{2})$/.exec(c[0].trim());
 if(!m)return null;
 const ts=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])-offsetHours*3600000;
 const [open,high,low,close,volume]=c.slice(1,6).map(Number);
 if(![ts,open,high,low,close,volume].every(Number.isFinite)||open<=0||low<=0||volume<0||high<Math.max(open,close,low)||low>Math.min(open,close,high))return null;
 return {ts,open,high,low,close,volume};
}
async function importMW(file){
 const limit=ohlcvCap,chunkSize=4*1024*1024;
 let start=Math.max(0,file.size-280*limit),carry='',rows=[],read=0,invalid=0;
 // For huge exports, read the most recent portion only, to keep browser responsive.
 // Start at next full newline if beginning from an offset.
 let first=start>0,offset=Number($('csvTimezone').value);
 for(let pos=start;pos<file.size;pos+=chunkSize){
  const chunk=await file.slice(pos,Math.min(file.size,pos+chunkSize)).text();
  const lines=(carry+chunk).split(/\r?\n/);carry=lines.pop();
  if(first){lines.shift();first=false;}
  for(const line of lines){if(!line.trim())continue;const b=parseMWLine(line,offset);if(b)rows.push(b);else invalid++;}
  if(rows.length>limit*1.2)rows=rows.slice(-limit);
  read+=chunk.length;
  $('importProgress').textContent='Reading CSV… '+Math.min(100,Math.round((pos+chunk.length-start)/(file.size-start)*100))+'%';
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(carry.trim()){const b=parseMWLine(carry,offset);if(b)rows.push(b);else invalid++;}
 rows=rows.slice(-limit).sort((a,b)=>a.ts-b.ts);
 if(!rows.length)throw Error('No valid MotiveWave OHLCV rows found');
 ohlcv=rows;trades=[];dataMode='OHLCV';source='MOTIVEWAVE OHLCV (ESTIMATED PROFILE)';
 $('badge').textContent='OHLCV · APPROX PROFILE';$('replay').value=100;
 $('importProgress').textContent=`Loaded ${rows.length.toLocaleString()} recent 1-minute bars; skipped ${invalid} malformed rows. File ${Math.round(file.size/1048576)} MB. No real footprint/delta.`;
 $('chartMode').value='classic';chartView.offset=0;render();await saveDataset();
}
function buildOHLCV(){
 const seconds=+$('barSize').value,groups=new Map();
 for(const r of ohlcv){const ts=Math.floor(r.ts/(seconds*1000))*seconds*1000;let b=groups.get(ts);
  if(!b){b={ts,open:r.open,high:r.high,low:r.low,close:r.close,volume:0,delta:null,levels:new Map(),session:sessionKey(ts),vwap:0,cvd:null,pv:0};groups.set(ts,b);}
  b.high=Math.max(b.high,r.high);b.low=Math.min(b.low,r.low);b.close=r.close;b.volume+=r.volume;
  b.pv+=((r.high+r.low+r.close)/3)*r.volume;
 }
 const out=[...groups.values()].sort((a,b)=>a.ts-b.ts);let pv=0,vol=0,lastKey='';
 for(const b of out){if(b.session!==lastKey){pv=0;vol=0;lastKey=b.session;}pv+=b.pv;vol+=b.volume;b.vwap=vol?pv/vol:b.close;}
 return out;
}
// Estimated distribution: split each candle volume uniformly across its traded range.
// This is not exchange price-at-volume and should not be presented as exact POC/VAH/VAL.
function estimatedProfile(data){
 const m=new Map();for(const b of data){
  const a=Math.round(b.low/TICK),z=Math.round(b.high/TICK),n=Math.max(1,z-a+1);
  const weight=b.volume/n;
  for(let k=a;k<=z;k++)m.set(k,(m.get(k)||0)+weight);
 }
 return valueAreaFromMap(m);
}
function valueAreaFromMap(m){
 if(!m.size)return null;const arr=[...m].sort((a,b)=>a[0]-b[0]),total=arr.reduce((s,x)=>s+x[1],0);
 let pocIdx=0;for(let i=1;i<arr.length;i++)if(arr[i][1]>arr[pocIdx][1])pocIdx=i;
 let lo=pocIdx,hi=pocIdx,sum=arr[pocIdx][1],target=total*(+$('valueArea').value);
 while(sum<target&&(lo>0||hi<arr.length-1)){const below=lo>0?arr[lo-1][1]:-1,above=hi<arr.length-1?arr[hi+1][1]:-1;if(above>=below){hi++;sum+=arr[hi][1];}else{lo--;sum+=arr[lo][1];}}
 return {arr,total,poc:arr[pocIdx][0],val:arr[lo][0],vah:arr[hi][0]};
}
function sessionKey(ts){const h=+$('sessionHour').value,d=new Date(ts-h*3600000);return d.toISOString().slice(0,10);}
function build(){if(dataMode==='OHLCV')return buildOHLCV();const seconds=+$('barSize').value, groups=new Map();for(const t of trades){const ts=Math.floor(t.ts/(seconds*1000))*seconds*1000;let b=groups.get(ts);if(!b){b={ts,open:t.price,high:t.price,low:t.price,close:t.price,volume:0,delta:0,levels:new Map(),session:sessionKey(ts),vwap:0,cvd:0};groups.set(ts,b);}b.high=Math.max(b.high,t.price);b.low=Math.min(b.low,t.price);b.close=t.price;b.volume+=t.size;b.delta+=t.side==='BUY'?t.size:-t.size;const k=Math.round(t.price/TICK),v=b.levels.get(k)||{buy:0,sell:0};v[t.side==='BUY'?'buy':'sell']+=t.size;b.levels.set(k,v);}let pv=0,vol=0,delta=0,lastKey='';const out=[...groups.values()].sort((a,b)=>a.ts-b.ts);for(const b of out){if(b.session!==lastKey){pv=0;vol=0;delta=0;lastKey=b.session;}for(const [k,v] of b.levels){const n=v.buy+v.sell;pv+=k*TICK*n;vol+=n;}delta+=b.delta;b.vwap=pv/vol;b.cvd=delta;}return out;}
function profileData(data){const m=new Map();for(const b of data)for(const [k,v] of b.levels)m.set(k,(m.get(k)||0)+v.buy+v.sell);if(!m.size)return null;const arr=[...m].sort((a,b)=>a[0]-b[0]),total=arr.reduce((s,x)=>s+x[1],0);let pocIdx=0;for(let i=1;i<arr.length;i++)if(arr[i][1]>arr[pocIdx][1])pocIdx=i;let lo=pocIdx,hi=pocIdx,sum=arr[pocIdx][1],target=total*(+$('valueArea').value);while(sum<target&&(lo>0||hi<arr.length-1)){const below=lo>0?arr[lo-1][1]:-1,above=hi<arr.length-1?arr[hi+1][1]:-1;if(above>=below){hi++;sum+=arr[hi][1];}else{lo--;sum+=arr[lo][1];}}return {arr,total,poc:arr[pocIdx][0],val:arr[lo][0],vah:arr[hi][0]};}
function imbalance(b){const result=new Map(),ratio=+$('ratio').value,min=+$('minVol').value,stack=+$('stack').value;for(const [k,v] of b.levels){const low=b.levels.get(k-1)?.sell||0,high=b.levels.get(k+1)?.buy||0;result.set(k,{buy:v.buy>=min&&low>0&&v.buy/low>=ratio,sell:v.sell>=min&&high>0&&v.sell/high>=ratio,stackBuy:false,stackSell:false});}const ks=[...result.keys()].sort((a,b)=>a-b);for(const side of ['buy','sell']){let run=[];const mark=()=>{if(run.length>=stack)for(const k of run)result.get(k)[side==='buy'?'stackBuy':'stackSell']=true;};for(const k of ks){if(result.get(k)[side]&&(!run.length||k===run.at(-1)+1))run.push(k);else{mark();run=result.get(k)[side]?[k]:[];}}mark();}return result;}
function setup(id){const el=$(id),r=el.getBoundingClientRect();if(r.width<10||r.height<10)return null;const dpr=Math.min(devicePixelRatio||1,2);el.width=Math.floor(r.width*dpr);el.height=Math.floor(r.height*dpr);const ctx=el.getContext('2d');ctx.scale(dpr,dpr);return {ctx,w:r.width,h:r.height};}
function stroke(ctx,x1,y1,x2,y2,c,width=1){ctx.beginPath();ctx.strokeStyle=c;ctx.lineWidth=width;ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
// Chart navigation: bar count + pan offset, independent of replay.
const chartView={count:75,offset:0,dragging:false,startX:0,startOffset:0,scale:1,priceShift:0,crossX:null,crossY:null,axisDrag:false,startY:0,startScale:1};
function clampChart(){chartView.count=Math.max(5,Math.min(500,Math.round(chartView.count)));chartView.offset=Math.max(0,Math.min(Math.max(0,shown.length-chartView.count),Math.round(chartView.offset)));}
function chartWindow(){clampChart();const end=Math.max(1,shown.length-chartView.offset);return shown.slice(Math.max(0,end-chartView.count),end);}
function refreshPrice(){if(!shown.length)return;const last=shown.at(-1);const current=shown.filter(b=>b.session===last.session);drawPrice(dataMode==='OHLCV'?estimatedProfile(current):profileData(current));updateZoomLabel();}
function updateZoomLabel(){const el=$('zoomInfo');if(el)el.textContent=chartView.count+' bars · '+(chartView.offset?'pan '+chartView.offset:'latest');}
function drawPrice(session){
 const c=setup('priceCanvas');if(!c||!shown.length)return;
 const {ctx,w,h}=c,a=chartWindow();if(!a.length)return;
 const left=16,right=w-78,top=22,bottom=h-40,plotH=bottom-top,plotW=right-left;
 const rawLow=Math.min(...a.map(b=>b.low)),rawHigh=Math.max(...a.map(b=>b.high));
 const center=(rawLow+rawHigh)/2+chartView.priceShift;
 const span=Math.max(TICK*8,(rawHigh-rawLow+TICK*6)/chartView.scale);
 const low=center-span/2,high=center+span/2;
 const y=p=>top+(high-p)/span*plotH;
 const x=i=>left+(i+.5)*plotW/a.length;
 const step=plotW/a.length,footprint=dataMode==='TICKS'&&$('chartMode').value==='candle';
 ctx.font='11px ui-monospace,monospace';ctx.textAlign='left';
 for(let i=0;i<=6;i++){
  const price=low+span*i/6,yy=y(price);
  stroke(ctx,left,yy,right,yy,'#273440');ctx.fillStyle='#a4b1bf';ctx.fillText(money(price),right+7,yy+4);
 }
 if(session){
  for(const [key,label,color] of [['poc','POC','#d9b568'],['vah','VAH','#32c9a2'],['val','VAL','#f27884']]){
   const v=session[key];if(v==null)continue;const yy=y(v*TICK);
   if(yy<top||yy>bottom)continue;
   ctx.setLineDash([5,5]);stroke(ctx,left,yy,right,yy,color);ctx.setLineDash([]);
   ctx.fillStyle=color;ctx.fillText(label+' '+money(v*TICK),left+5,yy-5);
  }
 }
 ctx.save();ctx.beginPath();ctx.rect(left,top,plotW,plotH);ctx.clip();
 for(let i=0;i<a.length;i++){
  const b=a[i],xx=x(i),color=b.close>=b.open?'#32c9a2':'#f27884';
  stroke(ctx,xx,y(b.high),xx,y(b.low),color);
  if(!footprint||step<52){
   ctx.fillStyle=color;ctx.fillRect(xx-step*.32,Math.min(y(b.open),y(b.close)),Math.max(2,step*.64),Math.max(2,Math.abs(y(b.open)-y(b.close))));
   continue;
  }
  const poc=[...b.levels].sort((v,z)=>(z[1].buy+z[1].sell)-(v[1].buy+v[1].sell))[0]?.[0],imb=imbalance(b);
  for(const [k,v] of b.levels){
   const yy=y(k*TICK),cellH=Math.abs(y((k+1)*TICK)-yy);
   if(cellH<8||yy<top-25||yy>bottom+25)continue;
   const info=imb.get(k);let bg=v.buy>=v.sell?'#173e34':'#462630';
   if(info?.stackBuy||info?.stackSell)bg='#755b2a';else if(info?.buy)bg='#216a51';else if(info?.sell)bg='#8b3a48';
   const cellW=step*.92,cellTop=yy-cellH*.45,cellHeight=Math.min(cellH-1,27);
   ctx.fillStyle=bg;ctx.fillRect(xx-cellW/2,cellTop,cellW,cellHeight);
   if(k===poc){ctx.strokeStyle='#d9b568';ctx.strokeRect(xx-cellW/2,cellTop,cellW,cellHeight);}
   ctx.fillStyle='#f3f6f7';ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';
   ctx.fillText($('fpMode').value==='delta'?sign(v.buy-v.sell):`${v.sell}×${v.buy}`,xx,yy+3);
  }
  ctx.textAlign='left';ctx.fillStyle=b.delta>=0?'#32c9a2':'#f27884';ctx.fillText('Δ'+sign(b.delta),xx-step*.35,bottom-7);
 }
 ctx.beginPath();a.forEach((b,i)=>{if(i===0)ctx.moveTo(x(i),y(b.vwap));else ctx.lineTo(x(i),y(b.vwap));});
 ctx.strokeStyle='#e4b75d';ctx.lineWidth=2;ctx.stroke();ctx.restore();
 ctx.fillStyle='#e4b75d';ctx.fillText('VWAP',left+4,top-7);
 // Real time axis: time is taken from each bar timestamp (UTC).
 const stride=Math.max(1,Math.ceil(a.length/Math.max(2,plotW/110)));
 ctx.font='10px ui-monospace,monospace';ctx.fillStyle='#a9b6c4';ctx.textAlign='center';
 for(let i=0;i<a.length;i+=stride){const t=new Date(a[i].ts).toISOString();ctx.fillText(t.slice(11,16),x(i),h-14);}
 // Crosshair, price and timestamp readouts.
 if(chartView.crossX!=null&&chartView.crossY!=null){
  const cx=chartView.crossX,cy=chartView.crossY;
  if(cx>=left&&cx<=right&&cy>=top&&cy<=bottom){
   ctx.setLineDash([3,4]);stroke(ctx,cx,top,cx,bottom,'#8c9cad');stroke(ctx,left,cy,right,cy,'#8c9cad');ctx.setLineDash([]);
   const price=high-(cy-top)/plotH*span;
   ctx.fillStyle='#d9b568';ctx.fillRect(right+1,cy-10,76,19);
   ctx.fillStyle='#101820';ctx.textAlign='left';ctx.fillText(money(price),right+5,cy+3);
   const idx=Math.max(0,Math.min(a.length-1,Math.floor((cx-left)/step)));
   const t=new Date(a[idx].ts).toISOString().slice(0,16).replace('T',' ');
   ctx.fillStyle='#d9b568';ctx.fillRect(Math.max(left,cx-64),h-31,130,17);
   ctx.fillStyle='#101820';ctx.fillText(t+' UTC',Math.max(left,cx-64)+3,h-19);
  }
 }
 ctx.textAlign='left';
}
function drawCVD(){if(dataMode==='OHLCV'){const s=setup('cvdCanvas');if(s){s.ctx.fillStyle='#aab4bf';s.ctx.font='13px sans-serif';s.ctx.fillText('CVD unavailable: OHLCV has no aggressor side',18,36);}return;}const s=setup('cvdCanvas');if(!s||!shown.length)return;const {ctx,w,h}=s,session=shown.at(-1).session,a=shown.filter(b=>b.session===session).slice(-120);const lo=Math.min(0,...a.map(b=>b.cvd)),hi=Math.max(0,...a.map(b=>b.cvd)),range=hi-lo||1;for(let i=0;i<4;i++){let y=20+i*(h-40)/3;stroke(ctx,10,y,w-10,y,'#293542');}ctx.beginPath();a.forEach((b,i)=>{const x=14+i*(w-28)/Math.max(1,a.length-1),y=20+(hi-b.cvd)/range*(h-40);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle='#e4b75d';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#d5dee6';ctx.font='11px monospace';ctx.fillText('CVD: '+sign(a.at(-1).cvd),12,14);}
function drawProfile(p){if(!p){$('profile').textContent='No profile';return;}const max=Math.max(...p.arr.map(x=>x[1]));$('profile').innerHTML=p.arr.slice().reverse().map(([k,n])=>{const cls=k===p.poc?'poc':k===p.vah?'vah':k===p.val?'val':k>=p.val&&k<=p.vah?'invalue':'';return `<div class="profrow ${cls}"><span>${money(k*TICK)}</span><div class="track"><div class="fill" style="width:${n/max*100}%"></div></div><em>${money(n,0)}</em></div>`;}).join('');}
function drawMatrix(){if(dataMode==='OHLCV'){$('matrix').innerHTML='<div class="notice" style="padding:24px">Real Bid × Ask footprint / imbalance unavailable from OHLCV. Import tick prints with aggressor side.</div>';return;}const a=shown.slice(-6),ks=[...new Set(a.flatMap(b=>[...b.levels.keys()]))].sort((x,y)=>y-x).slice(0,100);let html='<table><thead><tr><th>PRICE</th>'+a.map(b=>`<th>${new Date(b.ts).toISOString().slice(11,16)}<div>Δ${sign(b.delta)}</div></th>`).join('')+'</tr></thead><tbody>';const im=a.map(imbalance),pocs=a.map(b=>[...b.levels].sort((x,y)=>(y[1].buy+y[1].sell)-(x[1].buy+x[1].sell))[0]?.[0]);for(const k of ks){html+=`<tr><td class="level">${money(k*TICK)}</td>`;a.forEach((b,i)=>{const v=b.levels.get(k);if(!v){html+='<td>·</td>';return;}const info=im[i].get(k);const cls=[v.buy>=v.sell?'buy':'sell',info.stackBuy||info.stackSell?'stacked':'',k===pocs[i]?'poc':''].join(' ');html+=`<td class="${cls}" title="Bid ${v.sell} Ask ${v.buy}">${$('fpMode').value==='delta'?sign(v.buy-v.sell):`${v.sell} × ${v.buy}`}${info.stackBuy?' ▲':info.stackSell?' ▼':''}</td>`;});html+='</tr>';} $('matrix').innerHTML=html+'</tbody></table>';}
function render(){if(!trades.length&&!ohlcv.length)return;bars=build();const end=Math.max(1,Math.ceil(bars.length*(+$('replay').value)/100));shown=bars.slice(0,end);const last=shown.at(-1),current=shown.filter(b=>b.session===last.session),p=dataMode==='OHLCV'?estimatedProfile(current):profileData(current),vol=current.reduce((s,b)=>s+b.volume,0);$('last').textContent=money(last.close);$('volume').textContent=money(vol,0);$('delta').textContent=dataMode==='OHLCV'?'N/A':sign(last.cvd);$('delta').style.color=dataMode==='OHLCV'?'#aab4bf':last.cvd>=0?'#32c9a2':'#f27884';$('poc').textContent=p?money(p.poc*TICK):'—';$('value').textContent=p?`${money(p.vah*TICK)} / ${money(p.val*TICK)}`:'—';$('vwap').textContent=money(last.vwap);$('sessionName').textContent=(dataMode==='OHLCV'?'ESTIMATED · ':'')+'Session starting '+last.session+' UTC';$('replayInfo').textContent=`${end}/${bars.length} bars · ${new Date(last.ts).toISOString().slice(0,16).replace('T',' ')} UTC`;drawPrice(p);updateZoomLabel();drawCVD();drawProfile(p);drawMatrix();$('status').textContent=dataMode==='OHLCV'?`${source} · ${ohlcv.length} recent 1-min OHLCV rows · ${bars.length} aggregated bars · ${new Date(ohlcv[0].ts).toISOString()} to ${new Date(ohlcv.at(-1).ts).toISOString()}. Profile/POC/VAH/VAL estimated, CVD/Footprint unavailable.`:`${source} · ${trades.length} trade prints · ${bars.length} bars · ${new Date(trades[0].ts).toISOString()} to ${new Date(trades.at(-1).ts).toISOString()}`;}
function load(a,name){if(playing){clearInterval(playing);playing=null;$('play').textContent='▶ Play';}trades=a;ohlcv=[];dataMode='TICKS';source=name;$('badge').textContent=name;$('replay').value=100;chartView.offset=0;render();}
function backtest(){const hold=Math.max(1,Math.floor(+$('hold').value||3)),slip=Math.max(0,+$('slip').value||0)*TICK,comm=Math.max(0,+$('commission').value||0),result=[];for(let i=1;i<bars.length-1;){const prev=bars[i-1],b=bars[i],dir=prev.close<=prev.vwap&&b.close>b.vwap?1:prev.close>=prev.vwap&&b.close<b.vwap?-1:0;if(!dir){i++;continue;}const entry=i+1,exit=entry+hold;if(exit>=bars.length)break;const buy=bars[entry].open+dir*slip,sell=bars[exit].open-dir*slip,net=(sell-buy)*dir*POINT-comm;result.push({time:new Date(bars[entry].ts).toISOString().slice(0,16),side:dir>0?'LONG':'SHORT',net});i=exit+1;}const total=result.reduce((s,r)=>s+r.net,0),wins=result.filter(r=>r.net>0).length,gp=result.filter(r=>r.net>0).reduce((s,r)=>s+r.net,0),gl=-result.filter(r=>r.net<0).reduce((s,r)=>s+r.net,0);$('btstats').innerHTML=[['NET P&L','$'+money(total,2)],['TRADES',result.length],['WIN RATE',result.length?money(wins/result.length*100)+'%':'—'],['PROFIT FACTOR',gl?money(gp/gl,2):gp?'∞':'—']].map(([k,v])=>`<article><small>${k}</small><strong>${v}</strong></article>`).join('');$('btrows').innerHTML='<table><thead><tr><th>Entry (UTC)</th><th>Side</th><th>Net P&L</th></tr></thead><tbody>'+result.map(r=>`<tr><td>${r.time}</td><td>${r.side}</td><td style="color:${r.net>=0?'#32c9a2':'#f27884'}">$${money(r.net,2)}</td></tr>`).join('')+'</tbody></table>';}
// TradingView-inspired interaction: wheel zoom, horizontal pan, right-axis vertical zoom.
const priceCanvas=$('priceCanvas');
function chartPosition(e){const r=priceCanvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
priceCanvas.addEventListener('wheel',e=>{
 e.preventDefault();const pos=chartPosition(e);
 if(pos.x>priceCanvas.clientWidth-78){
  chartView.scale=Math.max(.15,Math.min(20,chartView.scale*(e.deltaY>0?.87:1.15)));
 }else{
  const old=chartView.count;
  chartView.count=Math.max(5,Math.min(500,Math.round(old*(e.deltaY>0?1.16:1/1.16))));
  // Keep latest candle anchored by default; use drag to explore earlier history.
 }
 refreshPrice();
},{passive:false});
priceCanvas.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;const pos=chartPosition(e);
 chartView.axisDrag=pos.x>priceCanvas.clientWidth-78;
 chartView.dragging=true;chartView.startX=e.clientX;chartView.startY=e.clientY;
 chartView.startOffset=chartView.offset;chartView.startScale=chartView.scale;
 priceCanvas.setPointerCapture(e.pointerId);
});
priceCanvas.addEventListener('pointermove',e=>{
 const pos=chartPosition(e);chartView.crossX=pos.x;chartView.crossY=pos.y;
 if(chartView.dragging){
  if(chartView.axisDrag){
   chartView.scale=Math.max(.15,Math.min(20,chartView.startScale*Math.exp((e.clientY-chartView.startY)/170)));
  }else{
   const width=Math.max(100,priceCanvas.clientWidth-94);
   chartView.offset=chartView.startOffset+Math.round((e.clientX-chartView.startX)/(width/chartView.count));
  }
 }
 refreshPrice();
});
priceCanvas.addEventListener('pointerleave',()=>{if(!chartView.dragging){chartView.crossX=null;chartView.crossY=null;refreshPrice();}});
function stopDrag(){chartView.dragging=false;chartView.axisDrag=false;}
priceCanvas.addEventListener('pointerup',stopDrag);
priceCanvas.addEventListener('pointercancel',stopDrag);
$('zoomIn').onclick=()=>{chartView.count=Math.round(chartView.count/1.4);refreshPrice();};
$('zoomOut').onclick=()=>{chartView.count=Math.round(chartView.count*1.4);refreshPrice();};
$('fitChart').onclick=()=>{chartView.count=75;chartView.offset=0;chartView.scale=1;chartView.priceShift=0;refreshPrice();};
$('goLatest').onclick=()=>{chartView.offset=0;refreshPrice();};
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('fullscreen'))$('full').click();});
$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if($('importType').value==='ohlcv'){await importMW(f);}else{load(parse(await f.text()),'IMPORTED TICK CSV');$('importProgress').textContent='Tick trades imported.';await saveDataset();}}catch(err){$('importProgress').textContent='Import failed: '+err.message;alert('Import failed: '+err.message);}e.target.value='';};$('demo').onclick=()=>load(demo(),'SYNTHETIC DEMO');['barSize','sessionHour','valueArea','chartMode','fpMode','ratio','minVol','stack'].forEach(id=>$(id).addEventListener('change',render));$('replay').oninput=render;$('play').onclick=()=>{if(playing){clearInterval(playing);playing=null;$('play').textContent='▶ Play';return;}if(+$('replay').value>=100)$('replay').value=1;$('play').textContent='Ⅱ Pause';playing=setInterval(()=>{const n=Math.min(100,+$('replay').value+1);$('replay').value=n;render();if(n===100){clearInterval(playing);playing=null;$('play').textContent='▶ Play';}},180);};$('full').onclick=()=>{document.body.classList.toggle('fullscreen');$('full').textContent=document.body.classList.contains('fullscreen')?'⛶ Exit Full Screen':'⛶ Full Screen';setTimeout(render,60);};$('run').onclick=backtest;document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x===b));for(const id of ['terminal','quant','data'])$(id).hidden=id!==b.dataset.tab;$('title').textContent={terminal:'Order Flow Terminal',quant:'Quant Backtester',data:'Data Manager'}[b.dataset.tab];if(b.dataset.tab==='terminal')requestAnimationFrame(render);if(b.dataset.tab==='quant')backtest();});$('export').onclick=()=>{if(dataMode==='OHLCV'){alert('OHLCV is not tick trade data. Original MotiveWave file remains on your computer.');return;}const data=['timestamp,price,size,side',...trades.map(t=>`${new Date(t.ts).toISOString()},${t.price},${t.size},${t.side}`)].join('\n');const url=URL.createObjectURL(new Blob([data],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='tar-quantflow-trades.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};window.addEventListener('resize',()=>{if(!$('terminal').hidden)render();});load(demo(),'SYNTHETIC DEMO');


/* v0.7: persistent local historical datasets via IndexedDB */
const STORE_DB='tar-quantflow-historical-v1', STORE_KEY='active-dataset';
function openDatasetDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(Error('IndexedDB unavailable'));return;}const req=indexedDB.open(STORE_DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('datasets'))req.result.createObjectStore('datasets');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Cannot open database'));});}
async function dbAction(kind,value){const db=await openDatasetDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('datasets',kind==='get'?'readonly':'readwrite');const req=kind==='get'?tx.objectStore('datasets').get(STORE_KEY):kind==='delete'?tx.objectStore('datasets').delete(STORE_KEY):tx.objectStore('datasets').put(value,STORE_KEY);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Storage failed'));tx.onerror=()=>reject(tx.error||Error('Transaction failed'));});}finally{db.close();}}
function storageNotice(message){const el=$('storageStatus');if(el)el.textContent=message;}
async function saveDataset(){if(dataMode==='TICKS'&&source==='SYNTHETIC DEMO'){storageNotice('Demo is not saved. Import a CSV first.');return;}const record={version:1,mode:dataMode,source,rows:dataMode==='OHLCV'?ohlcv:trades,timezone:$('csvTimezone').value,savedAt:Date.now()};storageNotice('Saving '+record.rows.length.toLocaleString()+' rows to this browser…');try{await dbAction('put',record);storageNotice('Saved locally: '+record.rows.length.toLocaleString()+' rows · '+new Date(record.savedAt).toLocaleString()+'. Data will restore on refresh.');}catch(err){storageNotice('Save failed: '+err.message+'. Check browser storage/quota and private mode.');}}
async function restoreDataset(){try{const record=await dbAction('get');if(!record||!Array.isArray(record.rows)||!record.rows.length){storageNotice('No saved dataset in this browser.');return;}if(record.mode==='OHLCV'){ohlcv=record.rows;trades=[];dataMode='OHLCV';source=record.source||'RESTORED MOTIVEWAVE OHLCV';$('chartMode').value='classic';$('badge').textContent='OHLCV · APPROX PROFILE';}else{trades=record.rows;ohlcv=[];dataMode='TICKS';source=record.source||'RESTORED TICK CSV';$('badge').textContent=source;}if(record.timezone!==undefined)$('csvTimezone').value=record.timezone;$('replay').value=100;chartView.offset=0;render();storageNotice('Restored '+record.rows.length.toLocaleString()+' saved rows from '+new Date(record.savedAt).toLocaleString()+'.');}catch(err){storageNotice('Restore unavailable: '+err.message);}}
async function clearSavedDataset(){if(!confirm('Delete locally saved historical data? The original CSV on your computer will not be deleted.'))return;try{await dbAction('delete');storageNotice('Saved dataset deleted. Current chart stays open until refresh.');}catch(err){storageNotice('Delete failed: '+err.message);}}
$('saveDataset').onclick=saveDataset;
$('restoreDataset').onclick=restoreDataset;
$('clearDataset').onclick=clearSavedDataset;
restoreDataset();
