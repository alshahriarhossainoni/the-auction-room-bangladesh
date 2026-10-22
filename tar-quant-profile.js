(()=>{'use strict';
const c=document.getElementById('tar-quant-profile');if(!c)return;
const ctx=c.getContext('2d');if(!ctx)return;
const poc=document.getElementById('qp-poc'),delta=document.getElementById('qp-delta'),state=document.getElementById('qp-state');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let w=0,h=0,raf=0,active=false,last=0;
const N=43, data=Array.from({length:N},(_,i)=>{
const z=(i-20)/8.5;
const primary=Math.exp(-.5*z*z),secondary=.33*Math.exp(-.5*((i-33)/4.5)**2),tertiary=.23*Math.exp(-.5*((i-8)/3.8)**2);
const vol=(primary+secondary+tertiary+.06)*(.73+.27*Math.sin(i*1.8+1.3)**2);
return {vol,split:.48+.19*Math.sin(i*.57+1.4)};
});
const maxVol=Math.max(...data.map(d=>d.vol));let pocIndex=data.findIndex(d=>d.vol===maxVol);
const sorted=data.map((d,i)=>({i,v:d.vol})).sort((a,b)=>b.v-a.v);let acc=0;const total=data.reduce((s,d)=>s+d.vol,0);const selected=[];for(const d of sorted){selected.push(d.i);acc+=d.v;if(acc>=total*.70)break}const val=Math.min(...selected),vah=Math.max(...selected);
function resize(){const r=c.getBoundingClientRect();w=Math.max(100,r.width);h=Math.max(100,r.height);const d=Math.min(devicePixelRatio||1,2);c.width=Math.round(w*d);c.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0)}
function line(x,y,x2,y2,color,width=1,dash=[]){ctx.beginPath();ctx.setLineDash(dash);ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([])}
function label(txt,x,y,color){ctx.font='600 9px Inter,Arial,sans-serif';ctx.textAlign='right';ctx.fillStyle=color;ctx.fillText(txt,x,y)}
function render(ms){if(!w||!h)return;const t=reduced?0:ms*.001;ctx.clearRect(0,0,w,h);
const left=13,right=w-9,top=13,bottom=h-14,hh=bottom-top,dy=hh/N;
for(let j=0;j<=6;j++){let y=top+j*hh/6;line(left,y,right,y,'rgba(122,145,170,.095)')}
for(let j=0;j<=6;j++){let x=left+j*(right-left)/6;line(x,top,x,bottom,'rgba(122,145,170,.07)')}
const bx=w*.075,maxWidth=w*.66;
// Value area band
const bandY=top+val*dy;ctx.fillStyle='rgba(49,104,159,.065)';ctx.fillRect(bx,bandY,maxWidth,(vah-val+1)*dy);
for(let i=0;i<N;i++){
const d=data[i],y=top+i*dy+dy*.1,bh=Math.max(1.5,dy*.76);
const wav=1+.022*Math.sin(t*.67+i*.4)+.013*Math.sin(t*1.6+i*.91);
const width=maxWidth*(d.vol/maxVol)*wav;
const isValue=i>=val&&i<=vah;const isPOC=i===pocIndex;
const sellW=width*d.split,buyW=width-sellW;
ctx.fillStyle=isPOC?'#e16b86':isValue?'rgba(174,74,117,.85)':'rgba(112,58,86,.48)';ctx.fillRect(bx,y,sellW,bh);
ctx.fillStyle=isPOC?'#77c9f3':isValue?'rgba(71,148,216,.93)':'rgba(55,102,156,.55)';ctx.fillRect(bx+sellW,y,buyW,bh);
if(isPOC){ctx.shadowColor='rgba(244,194,88,.55)';ctx.shadowBlur=8;ctx.strokeStyle='rgba(255,211,113,.75)';ctx.lineWidth=.7;ctx.strokeRect(bx,y,width,bh);ctx.shadowBlur=0}
}
const cy=i=>top+(i+.5)*dy;
line(bx,cy(val),right-33,cy(val),'rgba(235,104,127,.52)',.8,[3,4]);label('VAL',right,cy(val)-4,'#e18a9b');
line(bx,cy(vah),right-33,cy(vah),'rgba(91,214,167,.62)',.8,[3,4]);label('VAH',right,cy(vah)-4,'#6bd5b3');
line(bx,cy(pocIndex),right-33,cy(pocIndex),'rgba(255,202,97,.94)',1.35);label('POC',right,cy(pocIndex)-5,'#ffd16d');
// Market activity curve, deliberately separate from the histogram and clearly illustrative.
const px=w*.73,span=w*.20;ctx.beginPath();for(let k=0;k<85;k++){
const x=px+k/84*span,y=h*.52+Math.sin(k*.21+t*.56)*h*.105+Math.sin(k*.51+t*.27)*h*.035+Math.sin(t*.17)*h*.055;
if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.strokeStyle='rgba(91,226,188,.85)';ctx.lineWidth=1.4;ctx.shadowBlur=6;ctx.shadowColor='#4cdbb1';ctx.stroke();ctx.shadowBlur=0;
for(let i=0;i<5;i++){const x=w*.76+((i*.23+t*.018)%1)*w*.17,y=h*(.25+.12*i)+Math.sin(t*.42+i*1.7)*7;ctx.beginPath();ctx.arc(x,y,1.2,0,Math.PI*2);ctx.fillStyle='rgba(115,225,202,.58)';ctx.fill()}
}
function tick(now){if(!active)return;if(now-last>34){render(now);last=now}raf=requestAnimationFrame(tick)}
const ro=new ResizeObserver(resize);ro.observe(c);resize();render(0);
const io=new IntersectionObserver(es=>{active=es[0].isIntersecting&&!reduced;cancelAnimationFrame(raf);if(active)raf=requestAnimationFrame(tick)},{threshold:.02});io.observe(c);
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);if(!document.hidden&&active)raf=requestAnimationFrame(tick)});
})();