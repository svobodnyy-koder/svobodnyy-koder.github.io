/* Visualizador 3D do cavalo (Three.js UMD já carregado como THREE) */
window.Horse3D = (function(){
  const V = THREE.Vector3;
  let renderer, scene, cam, controls, model, mesh, raf, ro;
  let container, overlay, markers = [], onPick = null, autorotate = true, ready = false;

  // Partes do cavalo em coordenadas do modelo (x = comprimento: -X cabeça, +X cauda; y = altura).
  // O z (lado) é resolvido por raycast até a superfície do lado próximo (+Z).
  const PARTS = [
    {n:"Focinho",                              x:-1.82, y:0.45},
    {n:"Narinas",                              x:-1.74, y:0.62},
    {n:"Olhos",                                x:-1.54, y:0.95},
    {n:"Fronte",                               x:-1.46, y:1.12},
    {n:"Orelhas",                              x:-1.38, y:1.30},
    {n:"Nuca",                                 x:-1.22, y:1.20},
    {n:"Ganacha",                              x:-1.52, y:0.58},
    {n:"Borda superior do pescoço (Crineira)", x:-1.00, y:1.15, short:"Crineira"},
    {n:"Borda inferior do pescoço",            x:-1.28, y:0.45, short:"Bordo inf. pescoço"},
    {n:"Cernelha",                             x:-0.52, y:0.82},
    {n:"Dorso",                                x:0.00,  y:0.78},
    {n:"Lombo",                                x:0.50,  y:0.90},
    {n:"Garupa",                               x:1.00,  y:0.82},
    {n:"Cauda (Rabo)",                         x:1.42,  y:0.52, short:"Cauda"},
    {n:"Anca",                                 x:0.88,  y:0.66},
    {n:"Nádega",                               x:1.34,  y:0.18},
    {n:"Espádua",                              x:-0.58, y:0.38},
    {n:"Tórax",                                x:0.05,  y:0.32},
    {n:"Flanco (Vazio)",                       x:0.68,  y:0.30, short:"Flanco"},
    {n:"Ventre",                               x:0.22,  y:0.02},
    {n:"Coxa",                                 x:1.00,  y:-0.05},
    {n:"Peitoral",                             x:-1.02, y:0.08},
    {n:"Braço",                                x:-0.72, y:0.00},
    {n:"Antebraço",                            x:-0.80, y:-0.55},
    {n:"Joelho",                               x:-0.82, y:-0.95},
    {n:"Canela (anterior)",                    x:-0.82, y:-1.25, short:"Canela ant."},
    {n:"Boleto (anterior)",                    x:-0.82, y:-1.50, short:"Boleto ant."},
    {n:"Casco (anterior)",                     x:-0.82, y:-1.58, short:"Casco ant."},
    {n:"Soldra",                               x:0.92,  y:-0.35},
    {n:"Curvilhão",                            x:1.00,  y:-0.90, short:"Curvilhão"},
    {n:"Canela (posterior)",                   x:1.00,  y:-1.22, short:"Canela post."},
    {n:"Boleto (posterior)",                   x:1.00,  y:-1.50, short:"Boleto post."},
    {n:"Casco (posterior)",                    x:1.00,  y:-1.58, short:"Casco post."}
  ];

  function init(host, opts){
    dispose();
    container = host; onPick = opts.onPick || null; autorotate = true; ready = false;
    container.style.position = "relative";
    const w = container.clientWidth || 600;
    const h = Math.max(300, Math.min(window.innerHeight*0.56, Math.round(w*0.72)));
    renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    if(THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setSize(w,h);
    const cv = renderer.domElement;
    cv.style.display="block"; cv.style.width="100%"; cv.style.height=h+"px"; cv.style.touchAction="none";
    container.appendChild(cv);
    overlay = document.createElement("div");
    overlay.className = "h3d-overlay";
    container.appendChild(overlay);

    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(42, w/h, 0.01, 20000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5c4a, 1.7));
    const dl = new THREE.DirectionalLight(0xffffff, 1.7); dl.position.set(5,9,8); scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0xffffff, 0.9); dl2.position.set(-7,5,-4); scene.add(dl2);
    const dl3 = new THREE.DirectionalLight(0xffffff, 0.7); dl3.position.set(2,2,-8); scene.add(dl3);

    controls = new THREE.OrbitControls(cam, cv);
    controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.85;
    controls.autoRotate = true; controls.autoRotateSpeed = 1.1;
    controls.addEventListener("start", ()=>{ autorotate=false; controls.autoRotate=false; });

    new THREE.GLTFLoader().load(opts.model, g=>onLoad(g), undefined, e=>{ if(opts.onError) opts.onError(e); });
    ro = new ResizeObserver(()=>resize()); ro.observe(container);
    loop();
  }

  function onLoad(g){
    model = g.scene; scene.add(model); model.updateWorldMatrix(true,true);
    const box = new THREE.Box3();
    model.traverse(n=>{ if(n.isMesh){ mesh=n; n.geometry.computeBoundingBox();
      box.union(n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld)); }});
    const size = box.getSize(new V()), c = box.getCenter(new V());
    const r = Math.max(size.x,size.y,size.z)*0.5, dist = r/Math.sin(Math.PI*21/180)*0.92;
    // vista 3/4 mostrando a cabeça (-X) e o lado próximo (+Z)
    controls.minDistance = r*0.7; controls.maxDistance = r*10;
    cam.position.set(c.x - dist*0.38, c.y + r*0.16, c.z + dist*0.9);
    controls.target.set(c.x, c.y + r*0.05, c.z); controls.update();
    window.__home = {p:cam.position.clone(), t:controls.target.clone()};
    window.__cam = cam; window.__dbg = {dist:dist, r:r, camPos:cam.position.toArray().map(v=>+v.toFixed(2)), center:c.toArray().map(v=>+v.toFixed(2)), camDist:+cam.position.distanceTo(c).toFixed(2)};

    // snap markers to the near (+Z) surface via raycast (comprimento = X)
    const ray = new THREE.Raycaster();
    const dir = new V(0,0,-1);
    const oz = box.max.z + 3;
    function snap(x,y){
      for(const dx of [0,0.06,-0.06,0.14,-0.14,0.24,-0.24]){
        for(const dy of [0,0.06,-0.06,0.14,-0.14]){
          ray.set(new V(x+dx, y+dy, oz), dir);
          const h = ray.intersectObject(model, true)[0];
          if(h) return h.point.clone().setX(x).setY(y).setZ(h.point.z+0.06);
        }
      }
      return null;
    }
    markers = PARTS.map((p,i)=>{
      let pos = snap(p.x, p.y);
      if(!pos) pos = new V(p.x, p.y, box.max.z - 0.2); // fallback: no plano da superfície próxima
      const el = document.createElement("button");
      el.className = "h3d-mk"; el.type="button";
      el.innerHTML = `<span>${i+1}</span>`;
      el.addEventListener("click", ev=>{ ev.stopPropagation(); if(onPick) onPick(i); });
      overlay.appendChild(el);
      return {part:p, pos, el, idx:i};
    });
    ready = true; window.__mesh = mesh; window.__box3 = box;
    window.__markers = markers.map(m=>({n:m.part.n, z:+m.pos.z.toFixed(2), fail:Math.abs(m.pos.z-(box.max.z-0.2))<0.001}));
    if (window.__h3dReady) window.__h3dReady(markers.length);
  }

  const _v = new V(), _ray = new THREE.Raycaster(), _cd = new V();
  function updateMarkers(){
    if(!ready) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const wpx = rect.width, hpx = rect.height;
    for(const m of markers){
      _v.copy(m.pos).project(cam);
      const behind = _v.z > 1;
      const x = (_v.x*0.5+0.5)*wpx, y = (-_v.y*0.5+0.5)*hpx;
      // occlusion: cast from camera to marker; if mesh hit clearly in front, dim
      _cd.copy(m.pos).sub(cam.position); const md=_cd.length(); _cd.normalize();
      _ray.set(cam.position, _cd);
      const h = _ray.intersectObject(model, true)[0];
      const occ = h && h.distance < md - 0.12;
      m.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
      m.el.style.display = behind ? "none" : "block";
      m.el.classList.toggle("occ", !!occ);
    }
  }

  function loop(){
    raf = requestAnimationFrame(loop);
    if(controls){ controls.update(); }
    if(renderer && scene && cam){ renderer.render(scene,cam); updateMarkers(); }
  }
  function resize(){
    if(!renderer||!container) return;
    const w = container.clientWidth || 600;
    const h = Math.max(300, Math.min(window.innerHeight*0.56, Math.round(w*0.72)));
    renderer.setSize(w,h); renderer.domElement.style.height=h+"px";
    cam.aspect = w/h; cam.updateProjectionMatrix();
  }

  // ---- public API ----
  function setLabels(mode){ // 'num' | 'name' | 'hide' | 'dot'
    markers.forEach(m=>{
      const nm = m.part.short || m.part.n;
      m.el.querySelector("span").textContent = mode==="name" ? nm : mode==="dot" ? "" : (m.idx+1);
      m.el.style.visibility = mode==="hide" ? "hidden" : "visible";
      m.el.classList.toggle("named", mode==="name");
    });
  }
  function highlight(i){ markers.forEach(m=>m.el.classList.toggle("pulse", m.idx===i)); }
  function showOnly(i){ markers.forEach(m=>{ const on=m.idx===i; m.el.style.visibility=on?"visible":"hidden"; m.el.classList.toggle("pulse",on); m.el.classList.remove("dim","good","bad","named"); m.el.querySelector("span").textContent="?"; }); }
  function mark(i, cls){ if(markers[i]) markers[i].el.classList.add(cls); }
  function clearMarks(){ markers.forEach(m=>m.el.classList.remove("pulse","good","bad","dim","named")); }
  function dim(except){ markers.forEach(m=>{ if(m.idx!==except) m.el.classList.add("dim"); }); }
  function show(on){ if(container) container.style.display = on?"block":"none"; }
  function resetView(){ if(window.__home){ cam.position.copy(window.__home.p); controls.target.copy(window.__home.t); controls.update(); } }
  function stopAuto(){ if(controls) controls.autoRotate=false; }
  function parts(){ return PARTS; }
  function dispose(){
    if(raf) cancelAnimationFrame(raf), raf=null;
    if(ro && container){ try{ro.disconnect();}catch(e){} ro=null; }
    if(renderer){ try{renderer.forceContextLoss();}catch(e){} renderer.dispose(); if(renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); }
    if(overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    renderer=scene=cam=controls=model=mesh=null; markers=[]; ready=false;
  }

  return { init, dispose, setLabels, highlight, showOnly, mark, clearMarks, dim, resetView, stopAuto, parts, isReady:()=>ready };
})();
