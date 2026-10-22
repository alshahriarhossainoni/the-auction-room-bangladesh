/* TAR Quant Engine Background v3 — visual animation, not exchange data */
(()=>{'use strict';
 if(document.getElementById('tar-network-background'))return;
 const canvas=document.createElement('canvas');canvas.id='tar-network-background';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);document.body.classList.add('tar-network-enabled');
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),small=matchMedia('(max-width: 720px)');
 let W=0,H=0,dpr=1,frame=0,prev=0,visible=!document.hidden,mouse={x:.5,y:.5},pointer=false;
 let seed=20261022;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const mobile=small.matches,N=mobile?74:230;
 const cores=Array.from({length:mobile?3:7},(_,i)=>({x:[.12,.81,.43,.94,.14,.62,.87][i],y:[.22,.26,.79,.75,.67,.14,.52][i],z:.35+rnd()*.8,phase:rnd()*7,rot:rnd()*6.28}));
 const nodes=Array.from({length:N},(_,i)=>{const core=cores[i%cores.length];return {core:i%cores.length,dx:(rnd()-.5)*(mobile?.5:.43),dy:(rnd()-.5)*.48,depth:.35+rnd()*.95,phase:rnd()*6.28,r:.5+rnd()*1.65,velocity:.25+rnd()*.7}});
 function size(){W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,mobile?1.25:1.65);canvas.width=Math.max(1,Math.round(W*dpr));canvas.height=Math.max(1,Math.round(H*dpr));ctx.setTransform(dpr,0,0,dpr,0,0)}
 function stroke(a,b,color,width=.6){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
 function render(time){const t=motion.matches?0:time*.001;ctx.clearRect(0,0,W,H);
  // Muted aurora and spatial grid.
  for(const [x,y,c] of [[.15,.7,'21,173,139'],[.84,.25,'103,57,197'],[.55,.82,'25,93,165']]){const r=Math.max(W,H)*.53,gr=ctx.createRadialGradient(x*W,y*H,0,x*W,y*H,r);gr.addColorStop(0,`rgba(${c},.105)`);gr.addColorStop(1,`rgba(${c},0)`);ctx.fillStyle=gr;ctx.fillRect(0,0,W,H)}
  const step=mobile?85:105;for(let x=0;x<W;x+=step)stroke({x,y:0},{x,y:H},'rgba(92,125,146,.035)',.6);for(let y=0;y<H;y+=step)stroke({x:0,y},{x:W,y},'rgba(92,125,146,.035)',.6);
  const px=pointer?(mouse.x-.5)*18:0,py=pointer?(mouse.y-.5)*15:0;
  const points=nodes.map(n=>{const q=cores[n.core],a=q.rot+t*(n.core%2?-.043:.05)*n.velocity+n.phase*.08,dx=n.dx*W*.62,dy=n.dy*H*.72;return{x:q.x*W+dx*Math.cos(a)-dy*Math.sin(a)*.38+Math.sin(t*.27+n.phase)*9+px*n.depth,y:q.y*H+dy*Math.cos(a)*.73+dx*Math.sin(a)*.26+Math.cos(t*.21+n.phase)*10+py*n.depth,r:n.r*n.depth,core:n.core}});
  // Dense spatial network: localized triangulated clusters and cross-cluster bridges.
  const edges=[];const limit=mobile?105:143;
  for(let i=0;i<points.length;i++){const a=points[i];let neighbors=0;for(let j=i+1;j<points.length;j++){const b=points[j],dx=b.x-a.x,dy=b.y-a.y,dist2=dx*dx+dy*dy,same=a.core===b.core,max=same?limit:limit*.63;if(dist2>max*max)continue;if(!same&&((i+j)%4!==0))continue;const strength=1-Math.sqrt(dist2)/max;const alpha=(same?.30:.12)*strength;stroke(a,b,same?`rgba(76,218,179,${alpha})`:`rgba(160,103,235,${alpha})`,same?.75:.5);if(strength>.35&&edges.length<270)edges.push([a,b,strength,i+j]);if(++neighbors>12)break}}
  // Flowing energy pulses along selected network connections.
  if(!motion.matches){ctx.save();ctx.globalCompositeOperation='screen';for(let k=0;k<Math.min(edges.length,mobile?22:78);k++){const [a,b,strength,id]=edges[(k*19)%edges.length],u=(t*(.14+(k%7)*.024)+id*.031)%1,x=a.x+(b.x-a.x)*u,y=a.y+(b.y-a.y)*u;ctx.fillStyle=k%3?'rgba(73,255,198,.73)':'rgba(183,126,255,.7)';ctx.shadowColor=k%3?'#30f3bc':'#ae7bff';ctx.shadowBlur=mobile?4:9;ctx.beginPath();ctx.arc(x,y,(mobile?1:1.4)*strength+.35,0,Math.PI*2);ctx.fill()}ctx.restore()}
  // Core energy rings, radial filaments and layered particles.
  for(let i=0;i<cores.length;i++){const q=cores[i],x=q.x*W,y=q.y*H,rad=(mobile?24:38)*q.z*(1+.07*Math.sin(t*.45+q.phase));ctx.save();ctx.translate(x,y);ctx.rotate(t*(i%2?-.08:.1)+q.phase);ctx.setLineDash([3,9]);ctx.strokeStyle='rgba(112,94,222,.19)';ctx.lineWidth=.9;ctx.beginPath();ctx.arc(0,0,rad*1.7,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='rgba(72,236,184,.21)';ctx.beginPath();ctx.arc(0,0,rad,.3,Math.PI*1.65);ctx.stroke();for(let k=0;k<8;k++){const a=k*Math.PI/4;stroke({x:Math.cos(a)*rad*.3,y:Math.sin(a)*rad*.3},{x:Math.cos(a)*rad*1.4,y:Math.sin(a)*rad*1.4},'rgba(95,170,205,.1)',.7)}ctx.restore();const glow=ctx.createRadialGradient(x,y,0,x,y,rad*2.1);glow.addColorStop(0,i%2?'rgba(137,82,236,.13)':'rgba(40,231,174,.12)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,rad*2.1,0,Math.PI*2);ctx.fill()}
  for(const p of points){ctx.fillStyle=p.core%3===0?'rgba(177,126,255,.65)':'rgba(100,244,204,.62)';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();if(p.r>1.6){ctx.strokeStyle='rgba(99,230,200,.17)';ctx.beginPath();ctx.arc(p.x,p.y,p.r*3.2,0,Math.PI*2);ctx.stroke()}}
  // Gentle vignette ensures original site copy and buttons remain legible.
  const vignette=ctx.createLinearGradient(0,0,W,0);vignette.addColorStop(0,'rgba(3,6,10,.23)');vignette.addColorStop(.45,'rgba(3,6,10,.12)');vignette.addColorStop(1,'rgba(3,6,10,.23)');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
 }
 function loop(t){if(!visible||motion.matches)return;if(t-prev>=33){render(t);prev=t}frame=requestAnimationFrame(loop)}
 function restart(){cancelAnimationFrame(frame);render(0);if(visible&&!motion.matches)frame=requestAnimationFrame(loop)}
 addEventListener('resize',()=>{size();restart()},{passive:true});addEventListener('pointermove',e=>{pointer=true;mouse.x=e.clientX/Math.max(1,W);mouse.y=e.clientY/Math.max(1,H)},{passive:true});addEventListener('pointerleave',()=>{pointer=false},{passive:true});document.addEventListener('visibilitychange',()=>{visible=!document.hidden;restart()});if(motion.addEventListener)motion.addEventListener('change',restart);else motion.addListener(restart);
 size();restart();
})();
