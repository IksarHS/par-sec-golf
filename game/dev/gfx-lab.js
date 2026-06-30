// ─────────────────────────────────────────────────────────────────────────────────────────────
// GFX LAB — WebGL post-process shader lab (flag-gated ?gfx)
// Grabs the game's 2D canvas as a texture each frame and runs a GLSL fragment shader over it (a
// real post-process pass), then shows the result on an overlay WebGL canvas. The 2D game keeps
// rendering underneath EXACTLY as it does now — the shader just eats the final image. Heavy effects
// CSS can't do: pixelate · posterize · ordered (Bayer) dither · bloom · chromatic aberration ·
// halftone · duotone · scanlines/CRT · vignette · grain. Live dials + presets. Inert unless ?gfx.
// (This is the slot to paste any GLSL you find/buy — drop it into the fragment shader below.)
// ─────────────────────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  if (!/[?&]gfx\b/.test(location.search)) return;

  var VS =
    'attribute vec2 aPos; varying vec2 vUv;' +
    'void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }';

  var FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime;',
    'uniform float uBright,uContrast,uSat,uHue,uTintAmt,uPixel,uPoster,uDither,uBloom,uChroma,uHalf,uDuo,uScan,uVig,uGrain,uEdge,uPlasma,uPalette,uSun,uHills,uParallax;',
    'uniform vec3 uTint,uDuoA,uDuoB,uEdgeColor;',
    'float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }',
    'vec3 hueShift(vec3 c, float a){ const vec3 k=vec3(0.57735); float co=cos(a),si=sin(a); return c*co + cross(k,c)*si + k*dot(k,c)*(1.0-co); }',
    'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
    'float Bayer2(vec2 a){ a=floor(a); return fract(a.x*0.5 + a.y*a.y*0.75); }',
    'float Bayer4(vec2 a){ return Bayer2(0.5*a)*0.25 + Bayer2(a); }',
    'float Bayer8(vec2 a){ return Bayer4(0.5*a)*0.25 + Bayer2(a); }',
    'vec3 plasma(vec2 uv, vec3 c1, vec3 c2, vec3 c3, float t){',
    '  vec2 p=(uv-0.5); p.x*=uRes.x/uRes.y; float len=length(p); float speed=t*0.25+302.2;',
    '  float ang=atan(p.y,p.x)+speed-20.0*(0.7*len+0.3);',
    '  p=vec2(len*cos(ang),len*sin(ang))*22.0; vec2 q=vec2(p.x+p.y);',
    '  for(int i=0;i<5;i++){ q+=sin(max(p.x,p.y))+p;',
    '    p+=0.5*vec2(cos(5.1123+0.353*q.y+speed*0.131), sin(q.x-0.113*speed));',
    '    p-=cos(p.x+p.y)-sin(p.x*0.711-p.y); }',
    '  float paint=min(2.0,max(0.0,length(p)*0.0035));',
    '  float a=max(0.0,1.0-1.4*abs(1.0-paint)); float b=max(0.0,1.0-1.4*abs(paint)); float cc=1.0-min(1.0,a+b);',
    '  return a*c1+b*c2+cc*c3; }',
    'float regionIdx(vec3 c, vec3 sR, vec3 gR){',          // in-shader region code (no ID buffer): sky/ground/bright/object
    '  if (luma(c) > 0.78) return 3.0;',                   // ball / bright highlight
    '  float dS=distance(c,sR), dG=distance(c,gR);',
    '  if (min(dS,dG) > 0.32) return 4.0;',                // distinct object (flag, cup)
    '  return dS < dG ? 1.0 : 2.0; }',                     // 1=sky 2=ground
    'void main(){',
    '  vec2 res = uRes; vec2 uv = vUv;',
    '  if (uPixel > 1.0){ vec2 px = uPixel/res; uv = (floor(uv/px)+0.5)*px; }',
    '  vec3 col;',
    '  if (uChroma > 0.0){ vec2 off = (uv-0.5)*uChroma*0.02;',
    '    col.r = texture2D(uTex, uv+off).r; col.g = texture2D(uTex, uv).g; col.b = texture2D(uTex, uv-off).b;',
    '  } else { col = texture2D(uTex, uv).rgb; }',
    '  if (uPlasma > 0.0 || uPalette > 0.0 || uSun > 0.0 || uHills > 0.0){',  // RISO COSMOS: sky/ground detected IN-SHADER
    '    vec3 skyRef = texture2D(uTex, vec2(0.5, 0.97)).rgb;',
    '    vec3 grdRef = texture2D(uTex, vec2(0.5, 0.05)).rgb;',
    '    float dS=distance(col,skyRef), dG=distance(col,grdRef), lm=luma(col);',
    '    bool flatSky=(lm<0.82 && dS<dG && dS<0.30);',     // big flats only -> protects ball (bright) + flag (distinct)
    '    bool flatGrd=(lm<0.80 && dG<=dS && dG<0.30);',
    '    if (uPalette>0.0){ if(flatSky) col=mix(col,skyRef,uPalette); else if(flatGrd) col=mix(col,grdRef,uPalette); }',
    '    if (uPlasma>0.0 && flatSky){ col=mix(col, plasma(uv, skyRef, mix(skyRef,vec3(1.0),0.22), mix(skyRef,vec3(0.0),0.28), uTime), uPlasma); }',
    '    if (uSun>0.0 && flatSky){',                        // SUN: flat pale disc in the upper sky (crisp rim)
    '      vec2 sd=(uv-vec2(0.72,0.82)); sd.x*=uRes.x/uRes.y; float sr=length(sd);',
    '      float sun=1.0 - smoothstep(0.097,0.103,sr);',
    '      col=mix(col, mix(skyRef, vec3(1.0,0.93,0.74), 0.92), uSun*sun); }',
    '    if (uHills>0.0 && flatSky){',                      // PARALLAX HILLS: ridges anchored just above the per-column horizon
    '      float hz=0.0;',                                  // find where this column transitions sky -> ground
    '      for (int i=0;i<10;i++){ float vv=0.60-float(i)*0.05; vec3 cc=texture2D(uTex,vec2(uv.x,vv)).rgb;',
    '        if (distance(cc,grdRef)<distance(cc,skyRef)){ hz=vv; break; } }',
    '      if (hz>0.0 && uv.y>hz && uv.y<hz+0.16){',        // a hill band sitting on the horizon
    '        for (int L=0; L<3; L++){ float fL=float(L);',
    '          float top=hz + (0.13 - fL*0.038);',
    '          float amp=0.03 - fL*0.008;',
    '          float ph=uParallax*(0.4+fL*0.30) + fL*2.3;',
    '          float ridge=top + amp*sin(uv.x*7.0 + ph) + amp*0.4*sin(uv.x*16.0 + ph*1.6);',
    '          if (uv.y < ridge){ col=mix(col, mix(skyRef, grdRef, 0.5 + fL*0.16), uHills); }',
    '        }',
    '      }',
    '    }',
    '  }',
    '  if (uBloom > 0.0){ vec3 b=vec3(0.0); float tot=0.0;',
    '    for(int i=-2;i<=2;i++){ for(int j=-2;j<=2;j++){',
    '      vec2 o = vec2(float(i),float(j))*2.5/res; vec3 s = texture2D(uTex, uv+o).rgb;',
    '      b += s*max(0.0, luma(s)-0.62); tot += 1.0; }}',
    '    col += (b/tot)*uBloom*3.5; }',
    '  col *= uBright;',
    '  col = (col-0.5)*uContrast + 0.5;',
    '  float l = luma(col); col = mix(vec3(l), col, uSat);',
    '  if (abs(uHue) > 0.001) col = hueShift(col, uHue);',
    '  if (uTintAmt > 0.0) col = mix(col, uTint*luma(col)*1.8, uTintAmt);',
    '  col = clamp(col,0.0,1.0);',
    '  if (uDuo > 0.0){ col = mix(col, mix(uDuoA, uDuoB, luma(col)), uDuo); }',
    '  if (uHalf > 1.0){ vec2 gp = gl_FragCoord.xy/uHalf; vec2 cell = fract(gp)-0.5;',
    '    float r = sqrt(1.0-luma(col))*0.5; float m = smoothstep(r+0.08, r-0.08, length(cell));',
    '    col = mix(min(col*1.25+0.08,1.0), col*0.5, m); }',
    '  if (uPoster > 1.0){ vec3 d = (uDither>0.0) ? vec3(Bayer8(gl_FragCoord.xy)-0.5)*uDither : vec3(0.0);',
    '    col = floor(col*uPoster + 0.5 + d)/uPoster; }',
    '  if (uEdge > 0.0){ vec2 te=1.0/res;',                     // CRISP outline: region Sobel OR hard colour edge (catches thin features like the flagstick)
    '    vec3 sR=texture2D(uTex,vec2(0.5,0.97)).rgb, gR=texture2D(uTex,vec2(0.5,0.05)).rgb;',
    '    vec3 p0=texture2D(uTex,uv).rgb;',
    '    vec3 pR=texture2D(uTex,uv+vec2(te.x,0.0)).rgb, pL=texture2D(uTex,uv-vec2(te.x,0.0)).rgb;',
    '    vec3 pD=texture2D(uTex,uv+vec2(0.0,te.y)).rgb, pU=texture2D(uTex,uv-vec2(0.0,te.y)).rgb;',
    '    float i0=regionIdx(p0,sR,gR);',
    '    float er=abs(regionIdx(pR,sR,gR)-i0)+abs(regionIdx(pL,sR,gR)-i0)+abs(regionIdx(pD,sR,gR)-i0)+abs(regionIdx(pU,sR,gR)-i0);',
    '    vec3 gx=abs(pR-pL), gy=abs(pD-pU);',                   // per-channel colour gradient (no extra samples)
    '    float ec=max(max(max(gx.r,gx.g),gx.b), max(max(gy.r,gy.g),gy.b));',
    '    float e=max(step(0.5,er), step(0.17,ec));',           // region boundary OR a hard colour edge -> crisp 1px ink
    '    col = mix(col, uEdgeColor, e*uEdge); }',
    '  if (uScan > 0.0){ float s = 0.5+0.5*sin(uv.y*res.y*3.14159); col *= 1.0 - uScan*(1.0-s); }',
    '  if (uVig > 0.0){ float v = smoothstep(0.92, 0.34, length((uv-0.5)*vec2(1.0,1.35))); col *= mix(1.0, v, uVig); }',
    '  if (uGrain > 0.0){ col += (hash(uv*res + fract(uTime))-0.5)*uGrain; }',
    '  gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);',
    '}'
  ].join('\n');

  var game = document.querySelector('canvas');
  var glc = document.createElement('canvas');
  glc.id = 'gfx-canvas';
  glc.style.cssText = 'position:fixed;z-index:5;pointer-events:none;';
  var gl;

  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error('[gfx] shader compile:', gl.getShaderInfoLog(s)); return null; }
    return s;
  }

  var prog, U = {}, tex;
  function initGL() {
    gl = glc.getContext('webgl', { premultipliedAlpha: false }) || glc.getContext('experimental-webgl');
    if (!gl) { console.warn('[gfx] no WebGL'); return false; }
    var vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error('[gfx] link:', gl.getProgramInfoLog(prog)); return false; }
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    ['uTex', 'uRes', 'uTime', 'uBright', 'uContrast', 'uSat', 'uHue', 'uTintAmt', 'uTint', 'uPixel', 'uPoster', 'uDither', 'uBloom', 'uChroma', 'uHalf', 'uDuo', 'uDuoA', 'uDuoB', 'uScan', 'uVig', 'uGrain', 'uEdge', 'uEdgeColor', 'uPlasma', 'uPalette', 'uSun', 'uHills', 'uParallax']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    return true;
  }

  // effect state
  var P = {
    bright: 1, contrast: 1, sat: 1, hue: 0, tint: '#ff8a3c', tintAmt: 0,
    pixel: 0, poster: 0, dither: 0, bloom: 0, chroma: 0, half: 0,
    duo: 0, duoA: '#16092e', duoB: '#ffd9a0', scan: 0, vig: 0, grain: 0, edge: 0, edgeColor: '#141019', plasma: 0, palette: 0, sun: 0, hills: 0
  };
  function hex2rgb(h) { return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255]; }

  var t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  function render() {
    if (!game || !game.width) { game = document.querySelector('canvas'); requestAnimationFrame(render); return; }
    var r = game.getBoundingClientRect();
    glc.style.left = r.left + 'px'; glc.style.top = r.top + 'px'; glc.style.width = r.width + 'px'; glc.style.height = r.height + 'px';
    if (glc.width !== game.width || glc.height !== game.height) { glc.width = game.width; glc.height = game.height; }
    gl.viewport(0, 0, glc.width, glc.height);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, game); } catch (e) {}
    gl.uniform1i(U.uTex, 0);
    gl.uniform2f(U.uRes, glc.width, glc.height);
    gl.uniform1f(U.uTime, ((typeof performance !== 'undefined' ? performance.now() : 0) - t0) * 0.001);
    gl.uniform1f(U.uBright, P.bright); gl.uniform1f(U.uContrast, P.contrast); gl.uniform1f(U.uSat, P.sat);
    gl.uniform1f(U.uHue, P.hue * 0.01745329); gl.uniform1f(U.uTintAmt, P.tintAmt);
    gl.uniform3fv(U.uTint, hex2rgb(P.tint));
    gl.uniform1f(U.uPixel, P.pixel); gl.uniform1f(U.uPoster, P.poster); gl.uniform1f(U.uDither, P.dither);
    gl.uniform1f(U.uBloom, P.bloom); gl.uniform1f(U.uChroma, P.chroma); gl.uniform1f(U.uHalf, P.half);
    gl.uniform1f(U.uDuo, P.duo); gl.uniform3fv(U.uDuoA, hex2rgb(P.duoA)); gl.uniform3fv(U.uDuoB, hex2rgb(P.duoB));
    gl.uniform1f(U.uScan, P.scan); gl.uniform1f(U.uVig, P.vig); gl.uniform1f(U.uGrain, P.grain);
    gl.uniform1f(U.uEdge, P.edge); gl.uniform3fv(U.uEdgeColor, hex2rgb(P.edgeColor));
    gl.uniform1f(U.uPlasma, P.plasma); gl.uniform1f(U.uPalette, P.palette);
    gl.uniform1f(U.uSun, P.sun); gl.uniform1f(U.uHills, P.hills);
    var _cx = 0; try { _cx = (window.camera && camera.x) || 0; } catch (e) {}
    gl.uniform1f(U.uParallax, _cx * 0.004);                 // hills drift with the world camera
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  // ── presets ──
  var PRESETS = {
    'Off':        { bright:1,contrast:1,sat:1,hue:0,tintAmt:0,pixel:0,poster:0,dither:0,bloom:0,chroma:0,half:0,duo:0,scan:0,vig:0,grain:0,edge:0,plasma:0,palette:0,sun:0,hills:0 },
    'Riso Cosmos':{ palette:0.9,contrast:1.06,sat:1.14,half:7,dither:0.45,grain:0.35,edge:0.95,edgeColor:'#1a1726',plasma:0.55,bloom:0,vig:0.42,sun:0,hills:0 },
    'Riso Cosmos+':{ palette:0.9,contrast:1.06,sat:1.14,half:7,dither:0.45,grain:0.35,edge:0.95,edgeColor:'#1a1726',plasma:0.55,bloom:0,vig:0.42,sun:1,hills:0.85 },
    'Mosaic':     { pixel:8,poster:4,dither:0.45,edge:0.30,edgeColor:'#10131c',contrast:1.10,sat:1.12 },
    'Riso Press': { contrast:1.16,sat:1.22,poster:4,dither:0.9,chroma:0.35,grain:0.36,vig:0.20,edge:0.22,edgeColor:'#2a2320' },
    'Comic Ink':  { contrast:1.22,sat:1.30,poster:5,half:12,edge:0.85,edgeColor:'#120f18',vig:0.14 },
    'Deep Signal':{ sat:0,contrast:1.32,poster:2,dither:0.95,edge:0.9,edgeColor:'#0a0a12',grain:0.10,vig:0.26 },
    'Cathode':    { contrast:1.12,sat:1.10,bloom:0.40,chroma:0.50,scan:0.42,vig:0.44,grain:0.05 },
    'Soft Orbit': { bright:1.06,contrast:0.95,sat:1.14,bloom:0.82,vig:0.24,grain:0.04,tint:'#ffd9a0',tintAmt:0.12 },
    'Neon Void':  { contrast:1.08,sat:1.45,hue:14,chroma:0.60,scan:0.16,bloom:0.60,vig:0.45,tint:'#b34aff',tintAmt:0.20 }
  };
  function loadPreset(n) {
    var base = JSON.parse(JSON.stringify(PRESETS.Off)); base.tint = P.tint; base.duoA = P.duoA; base.duoB = P.duoB;
    var p = PRESETS[n]; for (var k in base) P[k] = base[k]; for (var k2 in p) P[k2] = p[k2]; syncInputs();
  }

  // ── panel ──
  var open = false, panel, inputs = {};
  function row(label, key, min, max, step) {
    var r = document.createElement('div'); r.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';
    var l = document.createElement('span'); l.textContent = label; l.style.cssText = 'width:70px;flex:0 0 auto;color:#9fb0c8;';
    var inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = P[key]; inp.style.cssText = 'flex:1;height:18px;'; inputs[key] = inp;
    var v = document.createElement('span'); v.textContent = (+P[key]).toFixed(2); v.style.cssText = 'width:38px;text-align:right;color:#ffd27a;'; inp._v = v;
    inp.addEventListener('input', function () { P[key] = parseFloat(inp.value); v.textContent = (+P[key]).toFixed(2); });
    r.appendChild(l); r.appendChild(inp); r.appendChild(v); return r;
  }
  function colorRow(label, key) {
    var r = document.createElement('div'); r.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';
    var l = document.createElement('span'); l.textContent = label; l.style.cssText = 'width:70px;color:#9fb0c8;';
    var c = document.createElement('input'); c.type = 'color'; c.value = P[key]; c.style.cssText = 'width:34px;height:22px;border:none;background:none;padding:0;'; inputs[key] = c;
    c.addEventListener('input', function () { P[key] = c.value; });
    r.appendChild(l); r.appendChild(c); return r;
  }
  function syncInputs() { for (var k in inputs) { var el = inputs[k]; el.value = P[k]; if (el._v) el._v.textContent = (+P[k]).toFixed(2); } }
  function btn(label, fn, bg) { var b = document.createElement('button'); b.textContent = label; b.style.cssText = 'font:11px monospace;color:#eaf;background:' + (bg || '#26344a') + ';border:1px solid #3a536e;border-radius:5px;padding:4px 7px;margin:2px;cursor:pointer;'; b.onclick = fn; return b; }
  function toast(m) { var t = document.getElementById('gfx-toast'); if (!t) { t = document.createElement('div'); t.id = 'gfx-toast'; t.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:99999;background:rgba(10,13,20,0.95);color:#ffd27a;font:12px monospace;padding:6px 12px;border-radius:6px;border:1px solid #3a536e;'; document.body.appendChild(t); } t.textContent = m; t.style.opacity = '1'; clearTimeout(t._h); t._h = setTimeout(function () { t.style.opacity = '0'; }, 1400); }

  function buildPanel() {
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:66vh;overflow-y:auto;z-index:99998;display:none;' +
      "font:12px 'Departure Mono',monospace;color:#cfe;background:rgba(10,13,20,0.95);border-top:1px solid #3a536e;padding:10px 12px 16px;";
    var pr = document.createElement('div'); pr.style.cssText = 'margin-bottom:6px;';
    Object.keys(PRESETS).forEach(function (n) { pr.appendChild(btn(n, function () { loadPreset(n); }, '#2a3f5e')); });
    panel.appendChild(pr);
    panel.appendChild(row('bright', 'bright', 0.4, 1.8, 0.01));
    panel.appendChild(row('contrast', 'contrast', 0.4, 2.2, 0.01));
    panel.appendChild(row('saturate', 'sat', 0, 2.4, 0.01));
    panel.appendChild(row('hue', 'hue', -180, 180, 1));
    panel.appendChild(colorRow('tint', 'tint')); panel.appendChild(row('tint mix', 'tintAmt', 0, 1, 0.01));
    panel.appendChild(row('pixelate', 'pixel', 0, 14, 1));
    panel.appendChild(row('posterize', 'poster', 0, 8, 1));
    panel.appendChild(row('dither', 'dither', 0, 1, 0.01));
    panel.appendChild(row('bloom', 'bloom', 0, 1.5, 0.01));
    panel.appendChild(row('chroma', 'chroma', 0, 1.5, 0.01));
    panel.appendChild(row('halftone', 'half', 0, 16, 1));
    panel.appendChild(row('edge ink', 'edge', 0, 1, 0.01)); panel.appendChild(colorRow('ink color', 'edgeColor'));
    panel.appendChild(row('plasma sky', 'plasma', 0, 1, 0.01));
    panel.appendChild(row('palette snap', 'palette', 0, 1, 0.01));
    panel.appendChild(row('sun', 'sun', 0, 1, 0.01));
    panel.appendChild(row('parallax hills', 'hills', 0, 1, 0.01));
    panel.appendChild(colorRow('duo dark', 'duoA')); panel.appendChild(colorRow('duo light', 'duoB')); panel.appendChild(row('duotone', 'duo', 0, 1, 0.01));
    panel.appendChild(row('scanlines', 'scan', 0, 0.8, 0.01));
    panel.appendChild(row('vignette', 'vig', 0, 1, 0.01));
    panel.appendChild(row('grain', 'grain', 0, 0.5, 0.01));
    var act = document.createElement('div'); act.style.cssText = 'margin-top:8px;display:flex;flex-wrap:wrap;';
    act.appendChild(btn('↻ new holes', function () { try { RG.startRun({ course: RG.course, seed: RG.rollSeed() }); } catch (e) {} }, '#2e4a2e'));
    act.appendChild(btn('▸ next planet', function () { try { var it = window.SOLAR_ITINERARY || []; var i = it.indexOf(RG.course); var nx = it[(i + 1) % it.length]; if (nx) RG.startRun({ course: nx, seed: RG.rollSeed() }); } catch (e) {} }, '#2e3f5e'));
    act.appendChild(btn('⧉ copy settings', function () { try { navigator.clipboard.writeText(JSON.stringify(P)); } catch (e) {} toast('copied shader settings'); }, '#4a3a2e'));
    panel.appendChild(act);
    (document.body || document.documentElement).appendChild(panel);
  }
  function buildToggle() {
    var b = document.createElement('button'); b.textContent = '◉ GFX';
    b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;font:12px monospace;color:#fff;background:rgba(10,13,20,0.85);border:1px solid #3a536e;border-radius:6px;padding:6px 10px;cursor:pointer;';
    b.onclick = function () { open = !open; panel.style.display = open ? 'block' : 'none'; b.textContent = open ? '✕ GFX' : '◉ GFX'; };
    (document.body || document.documentElement).appendChild(b);
  }

  function boot() {
    if (!document.body) { return setTimeout(boot, 40); }
    game = document.querySelector('canvas');
    document.body.appendChild(glc);
    if (!initGL()) { try { glc.remove(); } catch (e) {} console.warn('[gfx] init failed — overlay removed, game unaffected'); return; }
    buildPanel(); buildToggle(); requestAnimationFrame(render);
    console.log('[gfx] WebGL shader lab armed (?gfx)');
  }
  boot();
})();
