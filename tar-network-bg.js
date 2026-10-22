/* TAR Quant Engine Ambient Background v2 — decorative, not live market data */
(()=>{'use strict';
 if(document.getElementById('tar-network-background'))return;
 const c=document.createElement('canvas');c.id='tar-network-background';c.setAttribute('aria-hidden','true');document.body.prepend(c);document.body.classList.add('tar-network-enabled');
 const g=c.getContext('2d',{alpha:true});if(!g)return;
 const media=matchMedia('(prefers-reduced-motion: reduce)');let reduced=media.matches,active=!document.hidden,w=0,h=0,dpr=1,raf=0,last=0;
 const mobile=matchMedia('(max-width: 720px)').matches;
 let seed=884213;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const nodes=Array.from({length:mobile?32:92},(_,i)=>({x:rand(),y:rand(),phase:rand()*6.283,v:.28+rand()*.8,r:.6+rand()*1.6,group:i%5}));
 const clusters=Array.from({length:mobile?2:5},(_,i)=>({x:[.13,.77,.42,.88,.19][i],y:[.3,.27,.77,.7,.83][i],radius:mobile?45:75+i*9,phase:rand()*6.28}));
 function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,1.75);c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);g.setTransform(dpr,0,0,dpr,0,0)}
 function line(x1,y1,x2,y2,color,width=1){g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.strokeStyle=color;g.lineWidth=width;g.stroke()}
 function draw(ms){const t=reduced?0:ms*.001;g.clearRect(0,0,w,h);
 // Dim depth glow: preserve legibility of the original black/gold website.
 for(const [x,y,r,color] of [[.8,.3,.46,'89,56,160'],[.16,.78,.4,'17,110,106'],[.5,.48,.42,'22,47,95']]){const rad=Math.max(w,h)*r,grad=g.createRadialGradient(w*x,h*y,0,w*x,h*y,rad);grad.addColorStop(0,`rgba(${color},.12)`);grad.addColorStop(1,`rgba(${color},0)`);g.fillStyle=grad;g.fillRect(0,0,w,h)}
 // Faint technical grid with staggered scan pulses.
 const step=mobile?68:86;g.strokeStyle='rgba(101,129,160,.045)';g.lineWidth=.6;for(let x=0;x<w;x+=step)line(x,0,x,h,'rgba(112,135,164,.042)',.6);for(let y=0;y<h;y+=step)line(0,y,w,y,'rgba(112,135,164,.042)',.6);
 const pts=nodes.map(n=>({x:n.x*w+Math.sin(t*n.v*.26+n.phase)*30,y:n.y*h+Math.cos(t*n.v*.23+n.phase)*26,r:n.r,group:n.group}));
 const max=mobile?130:205,edges=[];
 for(let i=0;i<pts.length;i++){const a=pts[i];for(let j=i+1;j<pts.length;j++){const b=pts[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>max)continue;const op=Math.pow(1-d/max,1.4);const same=a.group===b.group;line(a.x,a.y,b.x,b.y,same?`rgba(84,205,179,${op*.21})`:`rgba(125,101,207,${op*.13})`,same?.8:.55);if(op>.36&&edges.length<120)edges.push([a,b,op])}}
 // Moving particles flowing through network links.
 if(!reduced){for(let k=0;k<Math.min(edges.length,mobile?9:32);k++){const [a,b,op]=edges[(k*13)%edges.length];const f=(t*(.13+k%4*.045)+k*.271)%1;const x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f;g.fillStyle=`rgba(${k%3?'93,237,201':'184,137,255'},${op*.67})`;g.shadowColor=k%3?'#4fe9c0':'#9a64ff';g.shadowBlur=7;g.beginPath();g.arc(x,y,1.35,0,6.283);g.fill()}g.shadowBlur=0}
 for(const p of pts){g.fillStyle='rgba(102,236,201,.43)';g.beginPath();g.arc(p.x,p.y,p.r,0,6.283);g.fill();if(p.r>1.65){g.strokeStyle='rgba(113,212,191,.13)';g.beginPath();g.arc(p.x,p.y,5.5+Math.sin(t*.7+p.x)*1.5,0,6.283);g.stroke()}}
 // Rotating data-core rings / geometry; decorative and intentionally low contrast.
 for(let i=0;i<clusters.length;i++){const q=clusters[i],x=q.x*w,y=q.y*h,r=q.radius*(mobile?.75:1),a=t*(i%2?-.075:.09)+q.phase;g.save();g.translate(x,y);g.rotate(a);g.strokeStyle='rgba(119,94,203,.14)';g.lineWidth=.8;g.setLineDash([5,11]);g.beginPath();g.arc(0,0,r,0,6.283);g.stroke();g.setLineDash([]);g.strokeStyle='rgba(70,201,173,.11)';g.beginPath();g.arc(0,0,r*.64,.15,Math.PI*1.55);g.stroke();for(let k=0;k<6;k++){const ang=k*Math.PI/3;line(Math.cos(ang)*r*.35,Math.sin(ang)*r*.35,Math.cos(ang)*r*.7,Math.sin(ang)*r*.7,'rgba(136,122,217,.12)',.7)}g.restore()}
 // Gentle scan sweep, not a flashing effect.
 if(!reduced){const y=((t*12)%(h+280))-140,gr=g.createLinearGradient(0,y-90,0,y+90);gr.addColorStop(0,'rgba(36,190,159,0)');gr.addColorStop(.5,'rgba(36,190,159,.018)');gr.addColorStop(1,'rgba(36,190,159,0)');g.fillStyle=gr;g.fillRect(0,y-90,w,180)}
 }
 function loop(ms){if(!active||reduced)return;if(ms-last>=33){draw(ms);last=ms}raf=requestAnimationFrame(loop)}
 function sync(){reduced=media.matches;cancelAnimationFrame(raf);draw(0);if(!reduced&&active)raf=requestAnimationFrame(loop)}
 addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',()=>{active=!document.hidden;cancelAnimationFrame(raf);if(active&&!reduced)raf=requestAnimationFrame(loop)});if(media.addEventListener)media.addEventListener('change',sync);else if(media.addListener)media.addListener(sync);
 resize();sync();
})();
