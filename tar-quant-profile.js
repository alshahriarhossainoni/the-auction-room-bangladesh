(()=>{'use strict';
const canvas=document.getElementById('tar-quant-profile');if(!canvas)return;
const ctx=canvas.getContext('2d');if(!ctx)return;
const pocText=document.getElementById('qp-poc'),deltaText=document.getElementById('qp-delta'),stateText=document.getElementById('qp-state');
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let w=0,h=0,dpr=1,frame=0,raf=0,active=true,last=0;
const N=29;const weights=Array.from({length:N},(_,i)=>Math.exp(-Math.pow((i-15)/8.3,2))*(.68+.32*Math.sin(i*1.91)**2)+.1);
function resize(){const rect=canvas.getBoundingClientRect();w=Math.max(100,rect.width);h=Math.max(100,rect.height);dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
function line(x1,y1,x2,y2,color,lw=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.stroke()}
function draw(time){if(!w||!h)return;ctx.clearRect(0,0,w,h);const t=reduce?0:time*.001;
const x0=11,span=w*.69,top=8,innerH=h-18,step=innerH/N,baseX=w*.08;
for(let k=0;k<7;k++){let y=top+innerH*k/6;line(0,y,w,y,'rgba(108,133,147,.12)')}
for(let k=0;k<7;k++){let x=k*w/6;line(x,0,x,h,'rgba(108,133,147,.09)')}
let maxIndex=0,maxVol=-1;
for(let i=0;i<N;i++){const y=top+i*step;const wav=1+.075*Math.sin(t*.78+i*.52)+.035*Math.sin(t*1.7+i*1.31);const vol=weights[i]*wav;if(vol>maxVol){maxVol=vol;maxIndex=i}
const width=Math.min(span,span*.93*vol),buy=.37+.26*(.5+.5*Math.sin(i*.68+t*.4));const buyW=width*buy;
ctx.fillStyle='rgba(197,77,112,.54)';ctx.fillRect(baseX,y+1,Math.max(1,width-buyW),Math.max(2,step-2));ctx.fillStyle='rgba(79,139,213,.63)';ctx.fillRect(baseX+width-buyW,y+1,buyW,Math.max(2,step-2));
ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(baseX+width,y+1,Math.max(1,width*.025),Math.max(2,step-2));
}
const pocY=top+(maxIndex+.5)*step;line(baseX,pocY,w-8,pocY,'rgba(243,195,91,.95)',1.4);ctx.fillStyle='#f5c763';ctx.font='bold 9px Inter,sans-serif';ctx.fillText('POC',w-33,Math.max(10,pocY-5));
const vPrice=top+innerH*(.5+.26*Math.sin(t*.18));line(0,vPrice,w,vPrice,'rgba(98,223,183,.45)',.8);ctx.fillStyle='#65dcb9';ctx.fillRect(w-5,vPrice-3,5,6);
ctx.beginPath();for(let k=0;k<65;k++){const x=w*.48+k/64*w*.49;const y=h*.50+Math.sin(k*.28+t*.85)*h*.11+Math.sin(k*.61+t*.37)*h*.065+Math.cos(k*.1+t*.21)*h*.15;if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.strokeStyle='#61e6bb';ctx.lineWidth=1.5;ctx.shadowBlur=7;ctx.shadowColor='#4bd6b3';ctx.stroke();ctx.shadowBlur=0;
for(let j=0;j<9;j++){let x=w*.46+((j*.143+t*.036)%1)*w*.51;let y=h*.52+Math.sin(j*1.92+t*.9)*h*.25;ctx.beginPath();ctx.arc(x,y,1.4+(j%3)*.4,0,Math.PI*2);ctx.fillStyle=j%3?'rgba(111,220,194,.7)':'rgba(241,191,93,.8)';ctx.fill()}
if(!reduce){frame++;if(frame%80===0){pocText.textContent=(4183.8+Math.sin(t*.22)*1.1).toFixed(1);const v=12.4+Math.sin(t*.29)*14;deltaText.textContent=(v>=0?'+':'')+v.toFixed(1)+'%';deltaText.style.color=v>=0?'#62ddb7':'#ff7787';stateText.textContent=Math.abs(v)<6?'BALANCED':v>0?'BUY PRESSURE':'SELL PRESSURE'}}
}
function tick(now){if(!active)return;if(now-last>30){draw(now);last=now}raf=requestAnimationFrame(tick)}
const ro=new ResizeObserver(resize);ro.observe(canvas);resize();draw(0);
const io=new IntersectionObserver(entries=>{active=entries[0].isIntersecting&&!reduce;if(active){cancelAnimationFrame(raf);raf=requestAnimationFrame(tick)}else cancelAnimationFrame(raf)},{threshold:.02});io.observe(canvas);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf)}else if(active&&!reduce){cancelAnimationFrame(raf);raf=requestAnimationFrame(tick)}});
})();
