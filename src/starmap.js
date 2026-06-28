// ── starmap.js — the STAR MAP screen (META): a two-layer, flat, organic space map ──────────────────────
// LAYER 1 (galaxy): the star systems scattered in space; your route through them; uncharted ones fogged as
//   "???". Appears once you've charted 2+ systems and scales out as you chart more (progressive zoom).
// LAYER 2 (a system): that system's planets & moons, organically scattered (gas giants big, moons small),
//   your per-body scores, you-are-here, fog for unplayed. Tap a played world → travel back to replay it.
// Flat art style (solid discs + one darker crescent, like the game's planets), dense starfield, Departure
// Mono. Reads REAL progress from RG_SCORES. Owns this screen only; never touches run.html / the base game.
(function () {
'use strict';

var cv = document.getElementById('c'), ctx = cv.getContext('2d'), W = 0, H = 0, DPR = 1;
function resize() { DPR = window.devicePixelRatio || 1; W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
window.addEventListener('resize', function () { resize(); });

// ── real tour data ──
var ITIN = (typeof window.SOLAR_ITINERARY !== 'undefined') ? window.SOLAR_ITINERARY.slice() : [];
var COURSES = (window.WORLDS && WORLDS['run-world']) ? WORLDS['run-world'].courses : {};
var TRAPPIST_IDS = ['trappist1h','trappist1g','geryn','trappist1f','fenra','trappist1e','elai','trappist1d','trappist1c','trappist1b','trappist1'];
var BARNARD_IDS  = ['barnard_e','barnard_d','veil','hollow','ember','tidewell','solace','barnard_b','barnard_star'];
var KEPLER_IDS   = ['kepler90b','kepler90c','kepler90i','kepler90d','kepler90e','kepler90f','kepler90g','kepler90h','kepler90'];
var PROXIMA_IDS  = ['proxima_d','proxima_b','wisp','proxima_c','cinder','proxima'];
var TAUCETI_IDS  = ['tauceti_g','tauceti_h','liss','tauceti_e','caldra','tauceti_f','vesh','tauceti'];
function systemOf(id) {
  if (TRAPPIST_IDS.indexOf(id) >= 0) return 1;
  if (BARNARD_IDS.indexOf(id) >= 0) return 2;
  if (KEPLER_IDS.indexOf(id) >= 0) return 3;
  if (PROXIMA_IDS.indexOf(id) >= 0) return 4;
  if (TAUCETI_IDS.indexOf(id) >= 0) return 5;
  return 0;
}
var SYSTEMS = [
  { label:'THE SOLAR SYSTEM', accent:'#7fb2e0', star:'#ffd58a' },
  { label:'TRAPPIST-1',       accent:'#e0834f', star:'#ffb070' },
  { label:"BARNARD’S STAR",   accent:'#d94a1f', star:'#ff7a4a' },
  { label:'KEPLER-90',        accent:'#9ad06a', star:'#fff0c0' },
  { label:'PROXIMA CENTAURI', accent:'#e06a8a', star:'#ff8c70' },
  { label:'TAU CETI',         accent:'#5fd0c0', star:'#ffe6b0' },
];
var NSYS = SYSTEMS.length;
function nameOf(id) { var c = COURSES[id]; var n = (c && c.name) ? c.name : id; return String(n).split(' · ')[0].split(' (')[0]; }

// group the itinerary into ordered per-system body lists
var SYSBODIES = []; for (var s = 0; s < NSYS; s++) SYSBODIES.push([]);
for (var i = 0; i < ITIN.length; i++) SYSBODIES[systemOf(ITIN[i])].push(ITIN[i]);

// ── classification: star / gas-giant / moon → size & color ──
var STARS = {trappist1:1,barnard_star:1,kepler90:1,proxima:1,tauceti:1};
var GIANTS = {jupiter:1,saturn:1,uranus:1,neptune:1,barnard_e:1,kepler90b:1,proxima_d:1,tauceti_g:1};
var MOONS = {luna:1,phobos:1,deimos:1,io:1,europa:1,ganymede:1,callisto:1,titan:1,enceladus:1,mimas:1,rhea:1,
  miranda:1,ariel:1,oberon:1,triton:1,charon:1,
  geryn:1,fenra:1,elai:1,veil:1,hollow:1,ember:1,wisp:1,cinder:1,liss:1,caldra:1,vesh:1};
function isStar(id){ return !!STARS[id]; }
function isMoon(id){ return !!MOONS[id]; }
function baseR(id){ if (isStar(id)) return 42; if (GIANTS[id]) return 46; if (isMoon(id)) return 13; return 27; }
// body color: prefer the course's own palette, else a deterministic tint off the system accent
function hash(str){ var h=2166136261; for (var k=0;k<str.length;k++){ h^=str.charCodeAt(k); h=Math.imul(h,16777619);} return (h>>>0); }
function bodyColor(id, sysIdx){
  var c = COURSES[id];
  if (c){ var col = c.land || c.ground || c.sky || (c.palette && (c.palette.land||c.palette.ground)); if (col && /^#/.test(col)) return col; }
  // fallback: jitter the system accent by a per-id hue shift (stable)
  var base = SYSTEMS[sysIdx].accent.replace('#',''); var r=parseInt(base.substr(0,2),16),g=parseInt(base.substr(2,2),16),b=parseInt(base.substr(4,2),16);
  var hv = (hash(id)%60)-30; r=Math.max(40,Math.min(220,r+hv)); g=Math.max(40,Math.min(220,g-((hash(id)>>3)%30))); b=Math.max(40,Math.min(220,b+((hash(id)>>6)%40)-20));
  return 'rgb('+r+','+g+','+b+')';
}

// ── progress (REAL from RG_SCORES; dev reveal fallback) ──
var REAL = !!(window.RG_SCORES && window.RG_SCORES.all);
var played = {};          // id -> {par,total,best,plays}
var frontierId = null;    // first UNPLAYED body (the next one to play)
var hereId = null;        // the body the player is actually ON right now — "you are here"
var revealN = 1;          // dev fallback (standalone): how many itinerary steps revealed
function liveCourse(){    // the planet the running game is currently on (read across the iframe)
  try { var P=window.parent; if (P && P!==window && P.RG && P.RG.course) return P.RG.course; } catch(e){}
  try { return localStorage.getItem('rg-itin-pos') || null; } catch(e){}
  return null;
}
function refreshProgress(){
  played = {}; var furthest = -1;
  if (REAL){ var all = window.RG_SCORES.all();
    for (var i=0;i<ITIN.length;i++){ if (all[ITIN[i]]){ played[ITIN[i]] = all[ITIN[i]]; furthest = i; } } }
  else { for (var j=0;j<Math.min(revealN-1,ITIN.length);j++) played[ITIN[j]] = {total:0,par:0,best:0}; furthest = revealN-2; }
  var fi = Math.min(ITIN.length-1, furthest+1); frontierId = ITIN[fi] || ITIN[0] || null;
  var lc = liveCourse(); hereId = (lc && ITIN.indexOf(lc)>=0) ? lc : frontierId;   // the ACTUAL current planet
}
function isPlayed(id){ return !!played[id]; }
function isCurrent(id){ return id === hereId; }
function isReachable(id){ return isPlayed(id) || id===hereId; }     // tap-able / shown solid
// which systems are "charted" = have any reachable body
function systemCharted(s){ var b=SYSBODIES[s]; for (var k=0;k<b.length;k++) if (isReachable(b[k])) return true; return false; }
function chartedCount(){ var n=0; for (var s=0;s<NSYS;s++) if (systemCharted(s)) n++; return n; }
function currentSystem(){ return hereId!=null ? systemOf(hereId) : (frontierId!=null?systemOf(frontierId):0); }

// ── seeded RNG for stable organic scatter ──
function rng(seed){ var s=seed>>>0; return function(){ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }

// ── helpers ──
function darken(col,f){ var m=col.match(/\d+/g); if(col[0]==='#'){ var h=col.replace('#',''); return 'rgb('+Math.round(parseInt(h.substr(0,2),16)*f)+','+Math.round(parseInt(h.substr(2,2),16)*f)+','+Math.round(parseInt(h.substr(4,2),16)*f)+')'; }
  return 'rgb('+Math.round(m[0]*f)+','+Math.round(m[1]*f)+','+Math.round(m[2]*f)+')'; }
function flatBody(x,y,r,col){ ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fillStyle=col; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.clip(); ctx.fillStyle=darken(col,.72);
  ctx.beginPath(); ctx.arc(x+r*.6,y+r*.2,r*1.08,0,6.2832); ctx.fill(); ctx.restore(); }
function ringAt(x,y,r,col,w){ ctx.strokeStyle=col; ctx.lineWidth=w||2; ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.stroke(); }
function txt(s,x,y,col,px,al){ ctx.textAlign=al||'center'; ctx.fillStyle=col; ctx.font=(px||13)+'px '+FONT; ctx.fillText(s,x,y); }
function vs(rec){ if(rec.total==null||rec.par==null) return ''; var d=rec.total-rec.par; return d===0?'E':(d>0?'+'+d:''+d); }
function vcol(rec){ if(rec.total==null||rec.par==null) return '#c2cbe0'; var d=rec.total-rec.par; return d<0?'#7ec97a':(d===0?'#c2cbe0':'#e0a64a'); }
var FONT = "'Departure Mono', monospace";

// ── dense starfield ──
var stars=[]; (function(){ var R=rng(99); for(var i=0;i<460;i++){ var rr=R(); stars.push({x:R(),y:R(),s:rr<.80?1:(rr<.96?2:3),a:(.10+R()*.55).toFixed(2),b:R()<.22}); } })();
function drawSky(){ ctx.fillStyle='#0b0c12'; ctx.fillRect(0,0,W,H);
  for(var i=0;i<stars.length;i++){ var st=stars[i]; ctx.fillStyle=st.b?'rgba(190,210,255,'+st.a+')':'rgba(255,255,255,'+st.a+')'; ctx.fillRect(st.x*W,st.y*H,st.s,st.s); } }

// ── view state ──
var view = -2;            // -2 = uninitialised; -1 = galaxy; >=0 = system index
var hits = [];            // click regions
function hit(x,y,r,go){ hits.push({x:x,y:y,r:r,go:go}); }
var traveling = null;

// ── LAYER 1: galaxy (progressive — only charted systems + the next, scaled to fit) ──
function galaxyVisible(){ var vis=[]; for(var s=0;s<NSYS;s++){ if(systemCharted(s)) vis.push(s); }
  // include the next (frontier) system as a fog hint
  var cur=currentSystem(); if(vis.indexOf(cur)<0) vis.push(cur);
  var nxt=cur+1; if(nxt<NSYS && vis.indexOf(nxt)<0) vis.push(nxt);
  vis.sort(function(a,b){return a-b;}); return vis;
}
function drawGalaxy(){
  txt('STAR MAP', 70, 66, '#e9e4f2', 24, 'left');
  txt('THE GALAXY  ·  TAP A SYSTEM TO CHART ITS WORLDS  ·  ESC', 70, 90, '#7e8aa0', 13, 'left');
  txt(chartedCount()+' / '+NSYS+' SYSTEMS CHARTED', W-70, 66, '#7e8aa0', 13, 'right');

  var vis = galaxyVisible();
  // lay the visible systems along a gently winding path that fills the screen — progressive zoom: the
  // more systems, the more nodes packed in, so each shrinks (the known galaxy grows).
  var n = vis.length, xL = W*0.14, xR = W*0.86, midY = H*0.52, amp = Math.min(H*0.20, 170);
  var R0 = rng(7);
  var pos = [];
  for (var k=0;k<n;k++){ var t = n>1 ? k/(n-1) : 0.5;
    pos.push({ x: xL + (xR-xL)*t, y: midY + Math.sin(t*Math.PI*1.6 + 0.4)*amp*(0.5+0.5*R0()), s: vis[k] }); }
  // route line
  ctx.lineWidth=2;
  for (var e=0;e<n-1;e++){ var a=pos[e],b=pos[e+1], fog=!systemCharted(b.s);
    ctx.setLineDash(fog?[2,9]:[]); ctx.strokeStyle=fog?'rgba(255,255,255,.07)':'rgba(255,210,140,.28)';
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
  ctx.setLineDash([]);
  var scale = Math.max(0.55, 1 - (n-2)*0.08);
  for (var p=0;p<n;p++){ var P=pos[p], sy=SYSTEMS[P.s], charted=systemCharted(P.s), cur=(P.s===currentSystem());
    var r = (charted?26:7)*scale;
    if (!charted){ flatBody(P.x,P.y,r,'#3c4454'); txt('???',P.x,P.y-r-12,'rgba(150,165,190,.45)',13); continue; }
    flatBody(P.x,P.y,r,sy.star);
    if (cur){ ringAt(P.x,P.y,r+9,'#ffd27a'); txt('YOU ARE HERE',P.x,P.y-r-30,'#ffd27a',12); }
    txt(sy.label, P.x, P.y+r+28, cur?'#fff1d4':'#dbe2ee', 15*Math.max(0.8,scale));
    var prog = systemProgress(P.s);
    txt(prog, P.x, P.y+r+46, cur?'rgba(255,224,154,.8)':'#7e8aa0', 12);
    hit(P.x,P.y,r+16,P.s);
  }
}
function systemProgress(s){ var b=SYSBODIES[s], pn=0, under=0, any=false;
  for(var k=0;k<b.length;k++){ if(isPlayed(b[k])){ pn++; var rec=played[b[k]]; if(rec.total!=null&&rec.par!=null) under+=(rec.par-rec.total); } }
  return pn+' / '+b.length+' WORLDS'; }

// ── LAYER 2: a system (planets & moons, organic) ──
function drawSystem(si){
  var sy=SYSTEMS[si], B=SYSBODIES[si];
  if (chartedCount()>=2){ txt('‹ SYSTEMS   (ESC)', 70, 54, '#9fb0c8', 14, 'left'); hit(150,48,150,-1); }
  txt(sy.label, 70, 106, sy.accent, 32, 'left');

  // organic scatter (seeded by system) within a comfortable inset
  var R=rng(1000+si), pts=[], pad=120, x0=pad, x1=W-pad, y0=H*0.24, y1=H*0.84;
  for (var i=0;i<B.length;i++){ var t=B.length>1?i/(B.length-1):0.5;
    // generally progress left→right, but with organic vertical + gap jitter
    var x=x0+(x1-x0)*(t*0.92+ (R()-0.5)*0.06);
    var y=y0+(y1-y0)*(0.5 + Math.sin(t*Math.PI*2.0+si)*0.32 + (R()-0.5)*0.36);
    pts.push({x:x,y:y,id:B[i]}); }
  // faint journey line in play order
  ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=2; ctx.beginPath();
  for (var L=0;L<pts.length;L++){ if(L===0) ctx.moveTo(pts[L].x,pts[L].y); else ctx.lineTo(pts[L].x,pts[L].y); } ctx.stroke();

  for (var b=0;b<pts.length;b++){ var P=pts[b], id=P.id, r=baseR(id), pl=isPlayed(id), cur=isCurrent(id), moon=isMoon(id);
    var col=bodyColor(id,si);
    if (cur){ flatBody(P.x,P.y,r,col); ringAt(P.x,P.y,r+8,'#ffd27a');
      txt('YOU ARE HERE',P.x,P.y-r-24,'#ffd27a',11); txt(nameOf(id),P.x,P.y+r+22,'#fff1d4',13);
      if (pl) txt(vs(played[id]),P.x,P.y+r+40, vcol(played[id]), 13);
    } else if (pl){ flatBody(P.x,P.y,r,col);
      txt(nameOf(id),P.x,P.y-r-12, moon?'#9aa6bc':'#cdd6e6', moon?11:13);
      txt(vs(played[id]),P.x,P.y+r+22, vcol(played[id]), moon?13:16);
    } else { ringAt(P.x,P.y,Math.max(8,r-3),'rgba(150,165,190,.45)');
      txt(nameOf(id),P.x,P.y-r-12,'rgba(150,165,190,.55)', moon?11:13); }
    if (pl) hit(P.x,P.y,r+4,'go:'+id);
  }
}

// ── travel (tap a played world → reboot the game into that course, via the GAME's own URL) ──
function travelTo(id){ if(traveling) return; traveling={ id:id, name:nameOf(id), t:0, accent:SYSTEMS[systemOf(id)].accent, col:bodyColor(id,systemOf(id)) }; }
// Replay a world: IN-GAME, hand off to the game's OWN seamless travel (rise → deep-space → swap-in-void →
// descend), identical to normal planet→planet travel — no page reload, no asset popping. STANDALONE falls
// back to the map's own warp animation + navigate.
function replayTravel(id){
  try {
    var P = window.parent;
    if (P && P !== window && P.RG && typeof P.RG._beginTravel === 'function') {
      P.RG._beginTravel(id, 'descend');                                   // the real seamless sequence
      if (P.RG_STARMAP && typeof P.RG_STARMAP.close === 'function') P.RG_STARMAP.close();   // reveal it
      return;
    }
  } catch (e) {}
  travelTo(id);
}
function drawTravel(){ if(!traveling) return; var t=traveling.t, a=Math.min(1,t*2.2), maxR=Math.max(W,H)*0.72;
  ctx.save(); ctx.fillStyle='rgba(8,9,14,'+a.toFixed(3)+')'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=a;
  // warp star-streaks rushing past as you fly in (matches the game's fly-through-space feel)
  for(var i=0;i<150;i++){ var ang=i*2.39996, spd=1.4+(i%6)*0.7, r=((frame*spd*(0.6+t)+i*57)%maxR), c=Math.cos(ang), s=Math.sin(ang), len=4+r*0.08*(0.5+t);
    ctx.strokeStyle='rgba(255,255,255,'+(0.08+r/maxR*0.5).toFixed(2)+')'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(W/2+c*r,H/2+s*r); ctx.lineTo(W/2+c*(r+len),H/2+s*(r+len)); ctx.stroke(); }
  // the destination world, growing as you approach
  var pr=14+t*t*Math.min(W,H)*0.32; flatBody(W/2,H/2,pr,traveling.col);
  ctx.globalAlpha=1; ctx.restore();
  txt('ARRIVING AT', W/2, H*0.15, hexA(traveling.accent,.9), 14);
  txt(traveling.name.toUpperCase(), W/2, H*0.86, '#fff6df', 24);
}
function hexA(hex,al){ var h=hex.replace('#',''); return 'rgba('+parseInt(h.substr(0,2),16)+','+parseInt(h.substr(2,2),16)+','+parseInt(h.substr(4,2),16)+','+al+')'; }

// ── frame ──
var frame=0;
function draw(){ hits=[]; drawSky(); ctx.textBaseline='alphabetic';
  if (view===-1) drawGalaxy(); else if (view>=0) drawSystem(view);
  drawTravel(); }
function loop(){ frame++;
  if (traveling){ traveling.t+=0.018; if (traveling.t>=1.12){ var base; try{ var tl=(window.top&&window.top!==window.self)?window.top.location:location; base=tl.href.split('#')[0].split('?')[0]; }catch(e){ base='index.html'; }
    var url=base+'?course='+traveling.id; if(window.__STARMAP_NO_NAV){ console.log('[starmap] (nav suppressed) '+url); traveling=null; }
    else { try{ if(window.top&&window.top!==window.self) window.top.location.href=url; else location.href=url; }catch(e){ location.href=url; } } } }
  draw(); requestAnimationFrame(loop); }

// ── interaction ──
cv.addEventListener('click', function(e){ var b=cv.getBoundingClientRect(), x=(e.clientX-b.left)*(W/b.width), y=(e.clientY-b.top)*(H/b.height);
  for (var i=hits.length-1;i>=0;i--){ var h=hits[i]; if((x-h.x)*(x-h.x)+(y-h.y)*(y-h.y)<=h.r*h.r){
    if (typeof h.go==='number'){ view=h.go; } else if (typeof h.go==='string' && h.go.indexOf('go:')===0){ replayTravel(h.go.slice(3)); } draw(); return; } } });
window.addEventListener('keydown', function(e){ if(e.key==='Escape'){ if(view>=0 && chartedCount()>=2){ view=-1; draw(); } } });

function reset(){ refreshProgress();
  // progressive zoom: with <2 charted systems there's no galaxy — open straight into the current system.
  view = (chartedCount()>=2) ? -1 : currentSystem();
  resize(); draw(); }
reset(); requestAnimationFrame(loop);

// headless / external API
window.RG_STARMAP_VIEW = function(v){ view=v; draw(); };
window.__travel = function(id){ replayTravel(id); };
window.__reset = reset; window.__frame = draw;
window.__STARMAP_NO_NAV = /[?&]nonav\b/.test(location.search);
var mm = location.search.match(/[?&]reveal=(\d+)/); if (mm){ revealN = parseInt(mm[1],10); refreshProgress(); view=(chartedCount()>=2)?-1:currentSystem(); draw(); }
var ms = location.search.match(/[?&]sys=(\d+)/); if (ms){ view = parseInt(ms[1],10); draw(); }

})();
