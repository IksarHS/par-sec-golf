// ─────────────────────────────────────────────────────────────────────────────────────────────
// FX LAB — flag-gated (?fx) post-process "filter lab" for trying looks live over the finished frame.
// Pure CSS/SVG layers ON TOP of the canvas (no render-loop changes): a canvas `filter`
// (brightness/contrast/saturate/hue/sepia/blur) + overlay layers (colour grade w/ blend mode,
// vignette, film grain, scanlines). Sliders + presets + "copy settings" + re-roll-hole / next-planet
// so you can test looks across holes and planet palettes. Inert unless ?fx — peel the file + tag → gone.
// (CSS/SVG covers the cheap, live stuff. True posterize/dither/bloom/LUT want the WebGL tier — separate.)
// ─────────────────────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  if (!/[?&]fx\b/.test(location.search)) return;

  var S = {
    brightness: 1, contrast: 1, saturate: 1, hue: 0, sepia: 0, blur: 0,
    gradeColor: '#ff8a3c', gradeBlend: 'soft-light', gradeOpacity: 0,
    vignette: 0, grain: 0, scan: 0
  };

  // ── overlay layers (cover the screen, never eat input) ──
  function mkLayer(css) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:45;' + css;
    (document.body || document.documentElement).appendChild(d);
    return d;
  }
  var grainSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">' +
    '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>' +
    '<feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>';
  var grade = mkLayer('');
  var grain = mkLayer('background-image:url("data:image/svg+xml,' + encodeURIComponent(grainSVG) + '");' +
    'background-size:180px 180px;mix-blend-mode:overlay;');
  var vig = mkLayer('background:radial-gradient(120% 90% at 50% 42%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.95) 100%);');
  var scan = mkLayer('background:repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0 1px, rgba(0,0,0,0) 1px 3px);mix-blend-mode:multiply;');

  function apply() {
    var cv = document.querySelector('canvas');
    if (cv) cv.style.filter = 'brightness(' + S.brightness + ') contrast(' + S.contrast + ') saturate(' + S.saturate +
      ') hue-rotate(' + S.hue + 'deg) sepia(' + S.sepia + ') blur(' + S.blur + 'px)';
    grade.style.background = S.gradeColor; grade.style.mixBlendMode = S.gradeBlend; grade.style.opacity = S.gradeOpacity;
    vig.style.opacity = S.vignette;
    grain.style.opacity = S.grain;
    scan.style.opacity = S.scan;
  }

  // ── presets (reflect the look directions) ──
  var PRESETS = {
    'Off':      { brightness:1, contrast:1, saturate:1, hue:0, sepia:0, blur:0, gradeOpacity:0, vignette:0, grain:0, scan:0 },
    'Warm Sun': { brightness:1.05, contrast:1.10, saturate:1.18, hue:5, sepia:0.05, blur:0, gradeColor:'#ff7a2e', gradeBlend:'soft-light', gradeOpacity:0.34, vignette:0.26, grain:0.08, scan:0 },
    'Cold Moon':{ brightness:0.96, contrast:1.16, saturate:0.82, hue:-12, sepia:0, blur:0, gradeColor:'#5a86c8', gradeBlend:'soft-light', gradeOpacity:0.32, vignette:0.32, grain:0.06, scan:0 },
    'Risograph':{ brightness:1.04, contrast:1.16, saturate:1.30, hue:0, sepia:0, blur:0, gradeColor:'#ff3a6e', gradeBlend:'soft-light', gradeOpacity:0.26, vignette:0.12, grain:0.26, scan:0 },
    'Dreamy':   { brightness:1.08, contrast:0.95, saturate:1.12, hue:0, sepia:0, blur:0.7, gradeColor:'#ffd9a0', gradeBlend:'screen', gradeOpacity:0.16, vignette:0.20, grain:0.05, scan:0 },
    'Noir':     { brightness:0.98, contrast:1.42, saturate:0.08, hue:0, sepia:0.05, blur:0, gradeColor:'#101018', gradeBlend:'soft-light', gradeOpacity:0.2, vignette:0.46, grain:0.13, scan:0 },
    'Vaporwave':{ brightness:1.02, contrast:1.06, saturate:1.42, hue:18, sepia:0, blur:0, gradeColor:'#b34aff', gradeBlend:'overlay', gradeOpacity:0.30, vignette:0.18, grain:0.05, scan:0.12 }
  };
  function loadPreset(name) { var p = PRESETS[name]; if (!p) return; for (var k in p) S[k] = p[k]; apply(); syncInputs(); }

  // ── control panel ──
  var open = false, panel, toggleBtn, inputs = {};
  var BLENDS = ['normal','multiply','screen','overlay','soft-light','hard-light','color','hue','color-dodge','color-burn'];

  function row(label, key, min, max, step) {
    var r = document.createElement('div'); r.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';
    var l = document.createElement('span'); l.textContent = label; l.style.cssText = 'width:74px;flex:0 0 auto;color:#9fb0c8;';
    var inp = document.createElement('input'); inp.type='range'; inp.min=min; inp.max=max; inp.step=step; inp.value=S[key];
    inp.style.cssText = 'flex:1;height:18px;'; inputs[key]=inp;
    var val = document.createElement('span'); val.textContent=(+S[key]).toFixed(2); val.style.cssText='width:36px;text-align:right;color:#ffd27a;';
    inp.addEventListener('input', function(){ S[key]=parseFloat(inp.value); val.textContent=(+S[key]).toFixed(2); apply(); });
    inp._val = val;
    r.appendChild(l); r.appendChild(inp); r.appendChild(val); return r;
  }
  function syncInputs(){ for (var k in inputs){ inputs[k].value=S[k]; if(inputs[k]._val) inputs[k]._val.textContent=(+S[k]).toFixed(2); }
    if (inputs.gradeColor) inputs.gradeColor.value=S.gradeColor; if (inputs.gradeBlend) inputs.gradeBlend.value=S.gradeBlend; }

  function btn(label, fn, bg) {
    var b = document.createElement('button'); b.textContent=label;
    b.style.cssText='font:11px monospace;color:#eaf;background:'+(bg||'#26344a')+';border:1px solid #3a536e;border-radius:5px;padding:4px 7px;margin:2px;cursor:pointer;';
    b.onclick=fn; return b;
  }

  function buildPanel() {
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:62vh;overflow-y:auto;z-index:99998;display:none;' +
      "font:12px 'Departure Mono',monospace;color:#cfe;background:rgba(10,13,20,0.94);border-top:1px solid #3a536e;padding:10px 12px 16px;";
    // presets
    var pr = document.createElement('div'); pr.style.cssText='margin-bottom:6px;';
    Object.keys(PRESETS).forEach(function(n){ pr.appendChild(btn(n, function(){ loadPreset(n); }, '#2a3f5e')); });
    panel.appendChild(pr);
    // sliders
    panel.appendChild(row('bright', 'brightness', 0.4, 1.8, 0.01));
    panel.appendChild(row('contrast', 'contrast', 0.4, 2.2, 0.01));
    panel.appendChild(row('saturate', 'saturate', 0, 2.4, 0.01));
    panel.appendChild(row('hue', 'hue', -90, 90, 1));
    panel.appendChild(row('sepia', 'sepia', 0, 1, 0.01));
    panel.appendChild(row('blur', 'blur', 0, 4, 0.1));
    // grade color + blend
    var gr = document.createElement('div'); gr.style.cssText='display:flex;align-items:center;gap:6px;margin:5px 0;';
    var gl = document.createElement('span'); gl.textContent='grade'; gl.style.cssText='width:74px;color:#9fb0c8;';
    var gc = document.createElement('input'); gc.type='color'; gc.value=S.gradeColor; gc.style.cssText='width:34px;height:22px;padding:0;border:none;background:none;'; inputs.gradeColor=gc;
    gc.addEventListener('input', function(){ S.gradeColor=gc.value; apply(); });
    var gb = document.createElement('select'); gb.style.cssText='flex:1;font:11px monospace;background:#16202e;color:#cfe;border:1px solid #3a536e;border-radius:4px;'; inputs.gradeBlend=gb;
    BLENDS.forEach(function(m){ var o=document.createElement('option'); o.value=m; o.textContent=m; if(m===S.gradeBlend)o.selected=true; gb.appendChild(o); });
    gb.addEventListener('change', function(){ S.gradeBlend=gb.value; apply(); });
    gr.appendChild(gl); gr.appendChild(gc); gr.appendChild(gb); panel.appendChild(gr);
    panel.appendChild(row('grade mix', 'gradeOpacity', 0, 1, 0.01));
    panel.appendChild(row('vignette', 'vignette', 0, 1, 0.01));
    panel.appendChild(row('grain', 'grain', 0, 0.7, 0.01));
    panel.appendChild(row('scanlines', 'scan', 0, 0.6, 0.01));
    // actions
    var act = document.createElement('div'); act.style.cssText='margin-top:8px;display:flex;flex-wrap:wrap;';
    act.appendChild(btn('↻ new holes', function(){ try{ RG.startRun({ course: RG.course, seed: RG.rollSeed() }); }catch(e){} }, '#2e4a2e'));
    act.appendChild(btn('▸ next planet', function(){ try{ var it=window.SOLAR_ITINERARY||[]; var i=it.indexOf(RG.course); var nx=it[(i+1)%it.length]; if(nx) RG.startRun({ course:nx, seed:RG.rollSeed() }); }catch(e){} }, '#2e3f5e'));
    act.appendChild(btn('⧉ copy settings', function(){ var t=JSON.stringify(S); try{ navigator.clipboard.writeText(t); }catch(e){} toast('copied — '+S.gradeBlend+' grade '+Math.round(S.gradeOpacity*100)+'%'); }, '#4a3a2e'));
    panel.appendChild(act);
    (document.body || document.documentElement).appendChild(panel);
  }

  function toast(msg){ var t=document.getElementById('fx-toast'); if(!t){ t=document.createElement('div'); t.id='fx-toast'; t.style.cssText='position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:99999;background:rgba(10,13,20,0.95);color:#ffd27a;font:12px monospace;padding:6px 12px;border-radius:6px;border:1px solid #3a536e;'; document.body.appendChild(t);} t.textContent=msg; t.style.opacity='1'; clearTimeout(t._h); t._h=setTimeout(function(){ t.style.opacity='0'; }, 1400); }

  function buildToggle() {
    toggleBtn = document.createElement('button'); toggleBtn.textContent='⚙ FX';
    toggleBtn.style.cssText='position:fixed;top:10px;right:10px;z-index:99999;font:12px monospace;color:#fff;background:rgba(10,13,20,0.85);border:1px solid #3a536e;border-radius:6px;padding:6px 10px;cursor:pointer;';
    toggleBtn.onclick=function(){ open=!open; panel.style.display=open?'block':'none'; toggleBtn.textContent=open?'✕ FX':'⚙ FX'; };
    (document.body || document.documentElement).appendChild(toggleBtn);
  }

  function boot(){ if(!document.body){ return setTimeout(boot,40); } buildPanel(); buildToggle(); apply(); syncInputs(); }
  boot();
})();
