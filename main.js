(function () {
  "use strict";
  /* Portfolio de Ramiro Carugati Slipczuk — comportamiento.
     Patrón IIFE, sin módulos. Cada efecto va aislado en safe(); el contenido ya está en el HTML,
     así que si algo falla (o una librería no carga) el sitio se lee completo.

     Scroll: nada en este archivo mueve la posición de scroll mientras el usuario la controla.
     Las secciones "fijadas" son position: sticky y su avance se calcula SIEMPRE a partir de la
     posición actual (getBoundingClientRect), en un único listener pasivo + requestAnimationFrame.
     Sin pins, sin pin-spacer, sin scrub con retraso y sin ScrollTrigger.refresh(). */

  const $ = (sel, scope) => (scope || document).querySelector(sel);
  const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasIO = typeof IntersectionObserver !== "undefined";
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = t => t * t * (3 - 2 * t);
  const vw = () => root.clientWidth;
  const vh = () => innerHeight;

  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }

  // Estado compartido entre secciones (lo lee la pelota)
  const S = { hx: { on: false, p: 0, dist: 0 }, cs: { mode: "static", p: 1 } };

  /* ---------- Motor de scroll: lecturas primero, escrituras después, una vez por cuadro ---------- */
  const reads = [], writes = [], resizers = [];
  let frameReq = null;
  function frame() {
    frameReq = null;
    const y = window.scrollY;
    for (let i = 0; i < reads.length; i++) { try { reads[i](y); } catch (e) { console.warn(e); } }
    for (let i = 0; i < writes.length; i++) { try { writes[i](y); } catch (e) { console.warn(e); } }
  }
  function requestFrame() { if (!frameReq) frameReq = requestAnimationFrame(frame); }
  function onScroll(read, write) { if (read) reads.push(read); if (write) writes.push(write); }
  function onResize(fn) { resizers.push(fn); }
  function runResize() { resizers.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } }); requestFrame(); }
  addEventListener("scroll", requestFrame, { passive: true });
  let resizeT = null;
  addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(runResize, 100); requestFrame(); });

  // Una vez, cuando el elemento entra en pantalla (umbral bajo)
  function onEnter(els, cb, margin) {
    if (!els.length) return;
    if (!hasIO) { els.forEach(cb); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); cb(e.target); } });
    }, { threshold: 0.01, rootMargin: margin || "0px 0px -6% 0px" });
    els.forEach(el => io.observe(el));
  }

  // Corre fn(t) en cada cuadro solo mientras el elemento está visible
  function whileVisible(el, fn) {
    let visible = false, raf = null;
    const loop = t => { raf = null; if (!visible || document.hidden) return; fn(t); raf = requestAnimationFrame(loop); };
    const start = () => { if (!raf) raf = requestAnimationFrame(loop); };
    if (hasIO) {
      new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(el);
    } else { visible = true; start(); }
    document.addEventListener("visibilitychange", () => { if (!document.hidden && visible) start(); });
  }

  /* ---------- Pantalla de carga ---------- */
  let introDelay = 0;
  function initSplash() {
    const splash = $("[data-splash]");
    if (!splash) return;
    if (reduced) { splash.remove(); return; }
    introDelay = 0.95;
    const hide = () => splash.classList.add("is-out");
    setTimeout(hide, 1150);                  // la animación CSS lo saca igual a los 1,8 s
    setTimeout(() => splash.remove(), 2200);
  }

  /* ---------- Inicio: título por líneas con máscara + elementos ---------- */
  function initHeroIntro() {
    const lines = $$("[data-hero-title] .ln-i");
    const items = $$("[data-hero-item]");
    if (!root.classList.contains("motion") || !window.gsap) { root.classList.remove("motion"); return; }
    gsap.ticker.lagSmoothing(0);              // el tiempo manda aunque se pierdan cuadros
    const tl = gsap.timeline({ delay: introDelay });
    // y: 0 explícito: si no, GSAP toma el translateY(108%) del CSS como "y" en píxeles y la línea queda corrida
    tl.fromTo(lines, { y: 0, yPercent: 108 }, { y: 0, yPercent: 0, duration: 1.15, ease: "expo.out", stagger: 0.12 })
      .fromTo(items, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 }, "-=0.75");
    root.classList.remove("motion");          // GSAP ya tomó el control con estilos en línea
    setTimeout(() => tl.progress(1), 4000);   // si la pestaña arrancó en segundo plano
  }

  /* ---------- Malla de degradado que sigue al mouse (en táctil, deriva sola) ---------- */
  function initMesh() {
    const mesh = $("[data-mesh]");
    const hero = $("[data-hero]");
    if (!mesh || !hero) return;
    let tx = 70, ty = 30, cx = tx, cy = ty, pointer = false;
    if (fine) {
      hero.addEventListener("pointermove", e => {
        const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width) * 100;
        ty = ((e.clientY - r.top) / r.height) * 100;
        pointer = true;
      });
      hero.addEventListener("pointerleave", () => { pointer = false; });
    }
    const speed = reduced ? 0.00005 : 0.00018;
    whileVisible(hero, t => {
      if (!pointer) { tx = 62 + Math.sin(t * speed) * 22; ty = 34 + Math.cos(t * speed * 1.3) * 18; }
      cx = lerp(cx, tx, 0.05); cy = lerp(cy, ty, 0.05);
      mesh.style.setProperty("--mx", cx.toFixed(2) + "%");
      mesh.style.setProperty("--my", cy.toFixed(2) + "%");
    });
  }

  /* ---------- Visor de cámara: timecode, REC y autoenfoque ---------- */
  function initViewfinder() {
    const vf = $("[data-viewfinder]");
    const hero = $("[data-hero]");
    if (!vf || !hero) return;
    const tc = $("[data-timecode]", vf);
    const af = $("[data-af]", vf);
    const t0 = performance.now();
    const pad = n => (n < 10 ? "0" : "") + n;
    let lastFrame = -1, w = 1, h = 1;
    let tx = 0, ty = 0, x = 0, y = 0, pointer = false, lastMove = 0, overTarget = false, locked = false, lockX = 0, lockY = 0;
    const measure = () => { const r = vf.getBoundingClientRect(); w = r.width || 1; h = r.height || 1; };
    measure(); onResize(measure);
    x = tx = w * 0.66; y = ty = h * 0.42;
    vf.classList.add("vf-on");
    const unlock = () => { if (locked) { locked = false; af.classList.remove("is-locked"); } };
    if (fine) {
      hero.addEventListener("pointermove", e => {
        const r = vf.getBoundingClientRect();
        tx = e.clientX - r.left; ty = e.clientY - r.top;
        pointer = true; lastMove = performance.now();
        overTarget = !!(e.target.closest && e.target.closest("[data-af-target], img"));
        if (locked && Math.hypot(tx - lockX, ty - lockY) > 10) unlock();
      });
      hero.addEventListener("pointerleave", () => { pointer = false; unlock(); });
    }
    whileVisible(hero, now => {
      const ms = now - t0;
      const fr = Math.floor((ms % 1000) / 40);               // 25 cuadros por segundo
      if (fr !== lastFrame) {
        lastFrame = fr;
        const s = Math.floor(ms / 1000);
        tc.textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60) + ":" + pad(fr);
      }
      if (!pointer) {                                          // sin mouse: deriva lenta
        tx = w * (0.6 + Math.sin(now * 0.00021) * 0.2);
        ty = h * (0.45 + Math.cos(now * 0.00016) * 0.22);
      }
      x = lerp(x, tx, reduced ? 1 : 0.075); y = lerp(y, ty, reduced ? 1 : 0.075);
      const tf = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
      af.style.transform = tf;
      af.style.setProperty("--aft", tf);
      if (pointer && !locked && overTarget && now - lastMove > 320 && Math.hypot(tx - x, ty - y) < 6) {
        locked = true; lockX = tx; lockY = ty; af.classList.add("is-locked");
      }
    });
  }

  /* ---------- Barra de progreso, encabezado y pastilla del CV ---------- */
  function initProgress() {
    const bar = $("[data-progress]");
    const header = $("[data-header]");
    const pill = $("[data-cv-pill]");
    const hero = $("[data-hero]");
    const contact = $("[data-contact]");
    const nav = $("[data-nav]");
    const cv = $("#cv");
    let max = 1, heroH = 0, contactTop = 0, showPill = false;
    onScroll(y => {
      max = Math.max(1, root.scrollHeight - vh());
      heroH = hero ? hero.offsetHeight : 600;
      contactTop = contact ? contact.getBoundingClientRect().top : 1e9;
      const cr = cv ? cv.getBoundingClientRect() : null;
      const cvInView = !!cr && cr.top < vh() && cr.bottom > 0;   // en la sección CV los botones propios ya están a la vista
      showPill = y > heroH * 0.8 && contactTop > vh() * 0.85 && !cvInView && !(nav && nav.classList.contains("is-open"));
    }, y => {
      if (bar) bar.style.transform = "scaleX(" + Math.min(1, y / max).toFixed(4) + ")";
      if (header) header.classList.toggle("is-scrolled", y > 30);
      if (pill) pill.classList.toggle("is-on", showPill);
    });
  }

  function initNav() {
    const toggle = $("[data-nav-toggle]");
    const nav = $("[data-nav]");
    if (toggle && nav) {
      const set = open => {
        nav.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.textContent = open ? "Cerrar" : "Menú";
        requestFrame();
      };
      toggle.addEventListener("click", () => set(!nav.classList.contains("is-open")));
      nav.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && nav.classList.contains("is-open")) { set(false); toggle.focus(); } });
    }
    const links = $$('.nav-list a[href^="#"]');
    const map = new Map(links.map(a => [a.getAttribute("href").slice(1), a]));
    if (!hasIO) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(a => a.setAttribute("aria-current", "false"));
        const a = map.get(en.target.id);
        if (a) a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- Enlaces internos: desplazamiento suave solo al hacer clic, cancelable ---------- */
  function initAnchors() {
    let active = false, timer = null;
    const NAV_KEYS = { ArrowUp: 1, ArrowDown: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1, " ": 1 };
    const end = () => {
      active = false; clearTimeout(timer);
      removeEventListener("wheel", cancel, { passive: true });
      removeEventListener("touchstart", cancel, { passive: true });
      removeEventListener("keydown", onKey);
      removeEventListener("scrollend", end);
    };
    // El usuario retoma el control: se corta la animación en la posición actual (una sola vez)
    function cancel() { if (!active) return; end(); scrollTo({ top: scrollY, behavior: "instant" }); }
    function onKey(e) { if (NAV_KEYS[e.key]) cancel(); }
    document.addEventListener("click", e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const id = decodeURIComponent(a.getAttribute("href").slice(1));
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      e.preventDefault();
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      const top = Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY - margin));
      if (history.pushState) history.pushState(null, "", "#" + id);
      if (!el.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute("tabindex", "-1");
      try { el.focus({ preventScroll: true }); } catch (_) {}
      if (reduced) { scrollTo(0, top); return; }
      end();
      active = true;
      scrollTo({ top, behavior: "smooth" });
      addEventListener("wheel", cancel, { passive: true });
      addEventListener("touchstart", cancel, { passive: true });
      addEventListener("keydown", onKey);
      addEventListener("scrollend", end);
      timer = setTimeout(end, 2500);            // por si el navegador no emite "scrollend"
    });
  }

  /* ---------- Cursor personalizado (solo escritorio) ---------- */
  function initCursor() {
    const cur = $("[data-cursor]");
    if (!cur || !fine) return;
    root.classList.add("has-cursor");
    const dot = $(".cursor-dot", cur), ring = $(".cursor-ring", cur);
    let x = -100, y = -100, rx = -100, ry = -100, first = true, raf = null;
    addEventListener("pointermove", e => {
      x = e.clientX; y = e.clientY;
      dot.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      if (first) { first = false; rx = x; ry = y; cur.classList.add("is-ready"); }
      if (!raf) raf = requestAnimationFrame(tick);
      const t = e.target;
      const view = t.closest && t.closest("[data-cursor-label]");
      cur.classList.toggle("is-view", !!view);
      cur.classList.toggle("is-link", !view && !!(t.closest && t.closest("a, button, [data-ball-hit]")));
    }, { passive: true });
    document.addEventListener("pointerleave", () => cur.classList.remove("is-ready"));
    document.addEventListener("pointerenter", () => { if (!first) cur.classList.add("is-ready"); });
    function tick() {
      rx = lerp(rx, x, 0.2); ry = lerp(ry, y, 0.2);
      ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0)";
      raf = (Math.abs(rx - x) > 0.2 || Math.abs(ry - y) > 0.2) ? requestAnimationFrame(tick) : null;
    }
  }

  /* ---------- Botones magnéticos ---------- */
  function initMagnetic() {
    if (!fine) return;
    $$("[data-magnetic]").forEach(btn => {
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
      const loop = () => {
        cx = lerp(cx, tx, 0.2); cy = lerp(cy, ty, 0.2);
        btn.style.transform = "translate3d(" + cx.toFixed(2) + "px," + cy.toFixed(2) + "px,0)";
        raf = (Math.abs(cx - tx) > 0.05 || Math.abs(cy - ty) > 0.05) ? requestAnimationFrame(loop) : null;
      };
      btn.addEventListener("pointermove", e => {
        const r = btn.getBoundingClientRect();
        tx = (e.clientX - r.left - r.width / 2) * 0.3; ty = (e.clientY - r.top - r.height / 2) * 0.35;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      btn.addEventListener("pointerleave", () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
    });
  }

  /* ---------- Revelados al scroll (bloques y máscaras) ---------- */
  function initReveals() {
    const els = $$("[data-reveal], .mask-reveal");
    if (!els.length || !hasIO || reduced) return;   // con movimiento reducido el contenido queda en bloque, sin ocultarse
    root.classList.add("fx");
    onEnter(els, el => {
      el.classList.add("is-in");
      if (el.hasAttribute("data-tilt")) setTimeout(() => el.classList.add("tilt-ready"), 950);
    });
    // Red de seguridad: a los 6 s, todo lo que siga oculto se muestra
    setTimeout(() => els.forEach(el => el.classList.add("is-in")), 6000);
    setTimeout(() => $$("[data-tilt]").forEach(el => el.classList.add("tilt-ready")), 7000);
  }

  /* ---------- Párrafos que se revelan por líneas ---------- */
  function initLines() {
    if (reduced || !hasIO) return;
    const paras = $$("[data-lines]");
    paras.forEach(p => {
      if (p.dataset.linesBound) return;            // idempotente
      p.dataset.linesBound = "1";
      const original = p.innerHTML;
      const words = p.textContent.trim().split(/\s+/);
      p.innerHTML = words.map(w => "<span class=\"lw\">" + w.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) + "</span>").join(" ");
      const spans = $$(".lw", p);
      const lines = [];
      let top = null;
      spans.forEach(s => {
        const t = s.offsetTop;
        if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
        lines[lines.length - 1].push(s.textContent);
      });
      p.innerHTML = lines.map((l, i) => "<span class=\"line-mask\"><span style=\"transition-delay:" + (i * 0.09).toFixed(2) + "s\">" + l.join(" ") + "</span></span>").join("");
      p.setAttribute("aria-label", p.textContent);
      const restore = () => { p.innerHTML = original; p.removeAttribute("aria-label"); p.classList.remove("lines-in"); };
      onEnter([p], () => {
        requestAnimationFrame(() => p.classList.add("lines-in"));
        setTimeout(restore, 1400 + lines.length * 90);   // vuelve al texto normal (se adapta a cualquier ancho)
      });
      setTimeout(() => { if (p.querySelector(".line-mask")) restore(); }, 6000);
    });
  }

  /* ---------- Contadores (el valor final ya está en el HTML) ---------- */
  function initCounters() {
    onEnter($$("[data-count]"), el => {
      const finalText = el.textContent;
      const target = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.dec || "0", 10);
      if (!isFinite(target)) return;
      const fmt = v => v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      const t0 = performance.now(), dur = 1500;
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = p < 1 ? fmt(target * e) : finalText;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      setTimeout(() => { el.textContent = finalText; }, dur + 1500);
    }, "0px 0px -4% 0px");
  }

  /* ---------- Trayectoria: la línea se dibuja con el scroll y los hitos se encienden ---------- */
  function initTimeline() {
    const tl = $("[data-timeline]");
    if (!tl || reduced) return;
    const fill = $("[data-tl-fill]", tl);
    const items = $$("[data-tl-item]", tl);
    root.classList.add("tl-on");
    let p = 0, lit = [];
    onScroll(() => {
      const r = tl.getBoundingClientRect();
      p = clamp((vh() * 0.62 - r.top) / Math.max(1, r.height), 0, 1);
      const lineY = r.top + p * r.height;
      lit = items.map(it => it.getBoundingClientRect().top + 14 <= lineY);
    }, () => {
      fill.style.setProperty("--tl", p.toFixed(4));
      items.forEach((it, i) => it.classList.toggle("is-lit", lit[i]));
    });
  }

  /* ---------- Perfil: la foto se revela con un diafragma de 8 láminas guiado por el scroll ---------- */
  function initIris() {
    const fig = $("[data-iris]");
    if (!fig || reduced) return;
    const NS = "http://www.w3.org/2000/svg";
    if ($(".iris", fig)) return;                       // idempotente
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "iris");
    svg.setAttribute("viewBox", "-100 -125 200 250");
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.setAttribute("aria-hidden", "true");
    const blades = [];
    for (let k = 0; k < 8; k++) {
      const b = document.createElementNS(NS, "rect");
      b.setAttribute("class", "iris-blade");
      b.setAttribute("x", "0"); b.setAttribute("y", "-420"); b.setAttribute("width", "520"); b.setAttribute("height", "840");
      svg.appendChild(b); blades.push(b);
    }
    const ring = document.createElementNS(NS, "circle");
    ring.setAttribute("class", "iris-ring"); ring.setAttribute("cx", "0"); ring.setAttribute("cy", "0");
    svg.appendChild(ring);
    fig.appendChild(svg);
    const RMAX = 172;                                   // más allá de las esquinas del recuadro 4:5
    let e = 0;
    onScroll(() => {
      const r = fig.getBoundingClientRect();
      e = smooth(clamp((vh() - r.top) / (vh() * 0.72), 0, 1));
    }, () => {
      const open = e >= 0.999;
      fig.classList.toggle("iris-open", open);
      if (open) return;
      const rad = 3 + e * RMAX;
      blades.forEach((b, k) => b.setAttribute("transform", "rotate(" + (k * 45 + (1 - e) * 70).toFixed(2) + ") translate(" + rad.toFixed(2) + " 0)"));
      ring.setAttribute("r", (rad + 1.5).toFixed(2));
      ring.style.opacity = (1 - e).toFixed(3);
    });
  }

  /* ---------- Experiencia: sticky con avance horizontal (escritorio) ---------- */
  function initHScroll() {
    const sec = $("[data-hscroll]");
    const scroller = $("[data-hscroll-scroller]");
    const sticky = $("[data-hscroll-sticky]");
    const track = $("[data-hscroll-track]");
    if (!sec || !scroller || !sticky || !track || reduced) return;
    const mq = matchMedia("(min-width: 1024px) and (min-height: 620px)");
    const measure = () => {
      if (!S.hx.on) return;
      S.hx.dist = Math.max(0, Math.round(track.scrollWidth - vw()));
      scroller.style.height = "calc(100vh + " + S.hx.dist + "px)";
    };
    const set = () => {
      S.hx.on = mq.matches;
      sec.classList.toggle("hx-on", S.hx.on);
      if (!S.hx.on) { scroller.style.height = ""; track.style.transform = ""; S.hx.p = 0; }
      measure(); requestFrame();
    };
    onScroll(() => {
      if (!S.hx.on) return;
      const top = scroller.getBoundingClientRect().top;
      S.hx.p = S.hx.dist > 0 ? clamp(-top / S.hx.dist, 0, 1) : 0;
    }, () => {
      if (!S.hx.on) return;
      track.style.transform = "translate3d(" + (-S.hx.p * S.hx.dist).toFixed(1) + "px,0,0)";
    });
    onResize(measure);
    if (mq.addEventListener) mq.addEventListener("change", set); else if (mq.addListener) mq.addListener(set);
    if ("ResizeObserver" in window) new ResizeObserver(() => { measure(); requestFrame(); }).observe(track);
    set();
  }

  /* ---------- "De cero a 10.000": sticky en escritorio; en móvil se reproduce al entrar ---------- */
  function initCase() {
    const sec = $("#caso");
    const scroller = $("[data-case-scroller]");
    const stage = $("[data-case]");
    if (!sec || !scroller || !stage || reduced) return;
    const giant = $("[data-giant]", stage);
    const line = $("[data-chart-line]", stage);
    const dot = $("[data-chart-dot]", stage);
    const ms = $$("[data-milestone]", stage);
    const FINAL = giant.textContent;                 // "10.000" exacto
    const backOut = t => { const c1 = 2.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
    line.style.strokeDasharray = "1";
    let shown = -1;
    function render(p) {
      S.cs.p = p;
      if (p === shown) return;
      shown = p;
      giant.textContent = p >= 0.9995 ? FINAL : Math.min(9999, Math.round(10000 * p)).toLocaleString("es-AR");
      line.style.strokeDashoffset = (1 - p).toFixed(4);
      const d = clamp((p - 0.88) / 0.12, 0, 1);
      dot.style.transform = "scale(" + (d > 0 ? backOut(d) : 0).toFixed(3) + ")";
      // Se animan los textos de cada hito (no la celda, para que la grilla no cambie de color)
      ms.forEach((m, i) => {
        const t = clamp((p - (0.12 + i * 0.22)) / 0.16, 0, 1);
        Array.prototype.forEach.call(m.children, c => {
          c.style.opacity = t.toFixed(3);
          c.style.transform = t < 1 ? "translateY(" + ((1 - t) * 14).toFixed(1) + "px)" : "";
        });
      });
      if (S.cs.mode === "once") requestFrame();      // la pelota sigue a la animación aunque no haya scroll
    }
    // Móvil / ventanas bajas: animación única al entrar, con red de seguridad
    let played = false, playing = false;
    function play() {
      if (played || playing) return;
      playing = true;
      const t0 = performance.now(), dur = 2600;
      const tick = now => {
        if (S.cs.mode !== "once") { playing = false; return; }
        const t = clamp((now - t0) / dur, 0, 1);
        render(1 - Math.pow(1 - t, 2));
        if (t < 1) requestAnimationFrame(tick); else { played = true; playing = false; }
      };
      requestAnimationFrame(tick);
      setTimeout(() => { if (S.cs.mode === "once") { render(1); played = true; } }, dur + 1200);
    }
    const mq = matchMedia("(min-width: 1024px) and (min-height: 620px)");
    let armed = false;
    const set = () => {
      const sticky = mq.matches;
      S.cs.mode = sticky ? "sticky" : "once";
      sec.classList.toggle("cs-on", sticky);
      scroller.style.height = sticky ? "240vh" : "";
      if (!sticky) {
        render(played ? 1 : 0);
        if (!armed) { armed = true; onEnter([stage], () => { if (S.cs.mode === "once") play(); else played = true; }, "0px 0px -20% 0px"); }
        if (armed && !played) {                       // si ya estaba en pantalla al cambiar de modo
          const r = stage.getBoundingClientRect();
          if (r.top < vh() * 0.8 && r.bottom > 0) play();
        }
      }
      requestFrame();
    };
    let p = 0;
    onScroll(() => {
      if (S.cs.mode !== "sticky") return;
      // El estado final (10.000 exacto) se alcanza al 97 % del recorrido y se mantiene hasta soltar la sección
      p = clamp(-scroller.getBoundingClientRect().top / (1.4 * vh() * 0.97), 0, 1);
      S.cs.p = p;                                    // disponible para la pelota en este mismo cuadro
    }, () => { if (S.cs.mode === "sticky") render(p); });
    if (mq.addEventListener) mq.addEventListener("change", set); else if (mq.addListener) mq.addListener(set);
    set();
  }

  /* ---------- Inclinación 3D suave de las tarjetas de experiencia ---------- */
  function initTilt() {
    if (!fine || reduced) return;
    $$("[data-tilt]").forEach(card => {
      card.addEventListener("pointermove", e => {
        if (!card.classList.contains("tilt-ready")) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = "perspective(900px) rotateX(" + (-py * 6).toFixed(2) + "deg) rotateY(" + (px * 7).toFixed(2) + "deg) translateZ(0)";
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
  }

  function initCvTilt() {
    const el = $("[data-cv-tilt]");
    if (!el || !fine || reduced) return;
    el.addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--ry", (((e.clientX - r.left) / r.width - 0.5) * 12).toFixed(2) + "deg");
      el.style.setProperty("--rx", (((e.clientY - r.top) / r.height - 0.5) * -9).toFixed(2) + "deg");
    });
    el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  }

  /* ---------- Tira de titulares: scroll nativo con snap, arrastre, botones y progreso ---------- */
  function initStrip() {
    const wrap = $("[data-strip]");
    if (!wrap) return;
    const track = $("[data-strip-track]", wrap);
    const bar = $("[data-strip-bar]", wrap);
    const ctrl = $("[data-strip-ctrl]", wrap);
    const prev = $("[data-strip-prev]", wrap);
    const next = $("[data-strip-next]", wrap);
    const imgs = $$("[data-strip-parallax]", wrap);
    if (!track) return;
    if (ctrl) ctrl.hidden = false;
    const step = () => {
      const c = $(".strip-card", track);
      const gap = parseFloat(getComputedStyle(track).columnGap) || 16;
      return c ? c.getBoundingClientRect().width + gap : 300;
    };
    if (prev) prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: reduced ? "auto" : "smooth" }));
    if (next) next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: reduced ? "auto" : "smooth" }));
    let raf = null;
    const update = () => {
      raf = null;
      const max = track.scrollWidth - track.clientWidth;
      const sl = track.scrollLeft;
      if (bar) bar.style.setProperty("--sp", (track.scrollWidth > 0 ? clamp((track.clientWidth + sl) / track.scrollWidth, 0.05, 1) : 1).toFixed(4));
      if (prev) prev.disabled = sl <= 2;
      if (next) next.disabled = sl >= max - 2;
      if (!reduced && imgs.length) {
        const tr = track.getBoundingClientRect();
        const cx = tr.left + tr.width / 2;
        imgs.forEach(img => {
          const r = img.parentElement.getBoundingClientRect();
          const c = (r.left + r.width / 2 - cx) / Math.max(1, tr.width);
          img.style.setProperty("--px", clamp(-c * 7, -7, 7).toFixed(2) + "%");
        });
      }
    };
    track.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    onResize(update);
    update();
    // Arrastre con el mouse (en táctil, el desplazamiento nativo ya lo resuelve)
    let down = false, moved = false, sx = 0, sl0 = 0;
    track.addEventListener("pointerdown", e => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; sl0 = track.scrollLeft;
    });
    addEventListener("pointermove", e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add("is-dragging"); }
      if (moved) track.scrollLeft = sl0 - dx;
    });
    addEventListener("pointerup", e => {
      if (!down) return;
      down = false;
      if (!moved) return;
      // Al soltar, la tira se acomoda en la tarjeta siguiente en el sentido del arrastre
      const st = step(), pos = track.scrollLeft / st;
      const target = (e.clientX < sx ? Math.ceil(pos - 0.08) : Math.floor(pos + 0.08)) * st;
      track.classList.remove("is-dragging");
      track.scrollTo({ left: target, behavior: reduced ? "auto" : "smooth" });
    });
    track.addEventListener("click", e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    track.addEventListener("dragstart", e => e.preventDefault());
  }

  /* ---------- Franja en movimiento: cambia de sentido según el scroll ---------- */
  function initMarquee() {
    const box = $("[data-marquee]");
    const track = $("[data-marquee-track]");
    if (!box || !track || reduced) return;
    let x = 0, dir = -1, boost = 0, lastY = scrollY, last = performance.now(), half = 0;
    const measure = () => { half = track.firstElementChild.getBoundingClientRect().width; };
    measure(); onResize(measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    addEventListener("scroll", () => {
      const dy = scrollY - lastY; lastY = scrollY;
      if (Math.abs(dy) > 1) { dir = dy > 0 ? -1 : 1; boost = Math.min(4, boost + Math.abs(dy) * 0.02); }
    }, { passive: true });
    whileVisible(box, now => {
      const dt = Math.min(64, now - last); last = now;
      x += dir * (0.04 + boost * 0.05) * dt;
      boost *= 0.94;
      if (half > 0) { if (x <= -half) x += half; if (x > 0) x -= half; }
      track.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)";
    });
  }

  /* ---------- Transiciones entre secciones: cortina y línea que se dibuja ---------- */
  function initSeams() {
    const seams = $$("[data-seam]");
    if (!seams.length || reduced) return;
    root.classList.add("seams-on");
    const parts = seams.map(s => ({ s, cover: $(".seam-cover", s), line: $(".seam-line", s), p: 0 }));
    onScroll(() => {
      const H = vh();
      parts.forEach(o => {
        const r = o.s.getBoundingClientRect();
        // de "arriba del bloque en el borde inferior" a "abajo del bloque al 35 % de la pantalla"
        o.p = clamp((H - r.top) / (H * 0.65 + r.height), 0, 1);
      });
    }, () => {
      parts.forEach(o => {
        o.cover.style.clipPath = "inset(0% 0% " + (o.p * 100).toFixed(2) + "% 0%)";
        o.line.style.transform = "scaleX(" + Math.min(1, o.p / 0.6).toFixed(4) + ")";
        o.line.style.opacity = (o.p > 0.7 ? 1 - (o.p - 0.7) / 0.3 : 1).toFixed(3);
      });
    });
  }

  /* ---------- Video: póster con botón; al hacer clic se inserta el reproductor ---------- */
  function initVideo() {
    const screen = $("[data-yt]");
    if (!screen) return;
    const poster = $("[data-yt-poster]", screen);
    const btn = $("[data-yt-play]", screen);
    const noPoster = () => screen.classList.add("yt-noposter");
    if (poster) {
      // Póster: primero WebP; si falla, el JPG que publica YouTube; si también falla, degradado azul
      poster.addEventListener("error", function onErr() {
        if (poster.dataset.fallbackId && !poster.dataset.triedJpg) {
          poster.dataset.triedJpg = "1";
          poster.src = "https://i.ytimg.com/vi/" + poster.dataset.fallbackId + "/hqdefault.jpg";
        } else { poster.removeEventListener("error", onErr); noPoster(); }
      });
      // YouTube devuelve una imagen gris de 120 px cuando no hay miniatura
      const check = () => { if (poster.naturalWidth && poster.naturalWidth <= 120) noPoster(); };
      if (poster.complete) check(); else poster.addEventListener("load", check, { once: true });
    }
    if (!btn) return;
    btn.addEventListener("click", () => {
      if ($("iframe", screen)) return;              // idempotente
      const id = screen.dataset.ytId;
      const f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&playsinline=1";
      f.title = "Presentación en video de Ramiro Carugati Slipczuk";
      f.allow = "autoplay; encrypted-media; picture-in-picture";
      f.allowFullscreen = true;
      f.setAttribute("allowfullscreen", "");
      btn.remove();
      screen.appendChild(f);
      try { f.focus({ preventScroll: true }); } catch (_) {}
    });
  }

  /* ---------- Reel de Instagram: embed real con carga diferida y portada de respaldo ---------- */
  function initReel() {
    const fig = $("[data-reel]");
    if (!fig || location.protocol === "file:") return;   // los embeds no funcionan en file://
    const fallback = $("[data-reel-fallback]", fig);
    const embed = $("[data-reel-embed]", fig);
    if (!fallback || !embed) return;
    onEnter([fig], () => {
      if (fig.dataset.reelBound) return;                 // idempotente
      fig.dataset.reelBound = "1";
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://www.instagram.com/embed.js";
      s.onload = () => {
        try {
          embed.classList.add("is-loading");
          embed.hidden = false;
          if (window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process();
        } catch (e) { embed.hidden = true; return; }
        let tries = 0, bound = false;
        const giveUp = setTimeout(() => {                 // 10 s sin cargar: queda la portada de respaldo
          if (!fallback.hidden) { embed.hidden = true; embed.classList.remove("is-loading"); }
        }, 10000);
        const check = setInterval(() => {
          tries++;
          const frameEl = $("iframe", embed);
          if (frameEl && !bound) {
            bound = true;
            clearInterval(check);
            frameEl.addEventListener("load", () => {
              clearTimeout(giveUp);
              embed.classList.remove("is-loading");
              fallback.hidden = true;
              requestFrame();
            }, { once: true });
          } else if (tries > 40) {
            clearInterval(check);
          }
        }, 250);
      };
      s.onerror = () => { embed.hidden = true; };
      document.body.appendChild(s);
    }, "400px 0px 400px 0px");
  }

  /* ---------- Visor ampliado accesible ---------- */
  function initLightbox() {
    const box = $("[data-lb-root]");
    const items = $$("[data-lb]");
    if (!box || !items.length) return;
    const img = $("[data-lb-img]", box);
    const cap = $("[data-lb-cap]", box);
    const btnClose = $("[data-lb-close]", box);
    const btnPrev = $("[data-lb-prev]", box);
    const btnNext = $("[data-lb-next]", box);
    let list = [], idx = 0, opener = null;
    const show = i => {
      idx = (i + list.length) % list.length;
      const a = list[idx];
      const thumb = $("img", a);
      img.src = a.getAttribute("href");
      img.alt = thumb ? thumb.alt : "";
      cap.textContent = a.dataset.lbCaption || (thumb ? thumb.alt : "");
    };
    const open = a => {
      const g = a.dataset.lbGroup;
      list = g ? items.filter(x => x.dataset.lbGroup === g) : [a];
      opener = a;
      box.classList.toggle("lb-single", list.length < 2);
      show(list.indexOf(a));
      box.hidden = false;
      root.classList.add("lb-open");
      btnClose.focus();
    };
    const close = () => {
      if (box.hidden) return;
      box.hidden = true;
      root.classList.remove("lb-open");
      if (opener) { try { opener.focus({ preventScroll: true }); } catch (_) {} }
    };
    items.forEach(a => a.addEventListener("click", e => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      open(a);
    }));
    btnClose.addEventListener("click", close);
    btnPrev.addEventListener("click", () => show(idx - 1));
    btnNext.addEventListener("click", () => show(idx + 1));
    box.addEventListener("click", e => { if (e.target === box || e.target.classList.contains("lb-fig")) close(); });
    // Mientras está abierto, la rueda y el toque no mueven la página de atrás
    box.addEventListener("wheel", e => e.preventDefault(), { passive: false });
    box.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
    document.addEventListener("keydown", e => {
      if (box.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowRight" && list.length > 1) { e.preventDefault(); show(idx + 1); }
      else if (e.key === "ArrowLeft" && list.length > 1) { e.preventDefault(); show(idx - 1); }
      else if (e.key === "Tab") {
        const f = [btnClose, btnPrev, btnNext].filter(b => b.offsetParent !== null);
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
  }

  /* ---------- Flash de obturador al hacer clic en una foto (solo escritorio) ---------- */
  function initShutter() {
    const fl = $("[data-flash]");
    if (!fl || !fine || reduced) return;
    fl.addEventListener("animationend", () => fl.classList.remove("is-on"));
    document.addEventListener("click", e => {
      const t = e.target.closest && e.target.closest("[data-shutter]");
      if (!t || e.button !== 0) return;
      fl.classList.remove("is-on");
      void fl.offsetWidth;                      // reinicia la animación
      fl.classList.add("is-on");
    }, true);
  }

  /* ---------- Copiar el mail ---------- */
  function initCopy() {
    $$("[data-copy]").forEach(btn => {
      const original = btn.textContent;
      btn.addEventListener("click", () => {
        const done = () => { btn.textContent = "Copiado"; setTimeout(() => { btn.textContent = original; }, 1800); };
        const fallback = () => {
          const el = $("[data-email]");
          if (!el) return;
          const r = document.createRange(); r.selectNodeContents(el);
          const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
          btn.textContent = "Seleccionado";
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(btn.dataset.copy).then(done, fallback);
        else fallback();
      });
    });
  }

  /* ---------- Pelota 3D de handball (Three.js local) ---------- */
  // Textura: icosaedro truncado proyectado en la esfera (12 pentágonos rojos, 20 hexágonos blancos, costuras azul marino)
  function ballTexture(W, H) {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const im = g.createImageData(W, H);
    const d = im.data;
    const phi = (1 + Math.sqrt(5)) / 2;
    const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
    const V = [[0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi], [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0], [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]].map(norm);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const F = [];                                                // centros de las 20 caras = hexágonos
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
      if (dot(V[i], V[j]) > 0.4 && dot(V[i], V[k]) > 0.4 && dot(V[j], V[k]) > 0.4) {
        F.push(norm([V[i][0] + V[j][0] + V[k][0], V[i][1] + V[j][1] + V[k][1], V[i][2] + V[j][2] + V[k][2]]));
      }
    }
    const WP = 0.0747;            // achica los pentágonos a la proporción real del icosaedro truncado
    const SEAM = 0.016, AA = Math.PI / H * 1.2;
    const RED = [215, 38, 61], WHITE = [246, 244, 238], NAVY = [27, 42, 74];
    let o = 0;
    for (let j = 0; j < H; j++) {
      const th = (j + 0.5) / H * Math.PI, st = Math.sin(th), ct = Math.cos(th);
      for (let i = 0; i < W; i++) {
        const ph = (i + 0.5) / W * Math.PI * 2;
        const x = -Math.cos(ph) * st, y = ct, z = Math.sin(ph) * st;
        let p1 = -2;
        for (let k = 0; k < 12; k++) { const v = V[k], q = x * v[0] + y * v[1] + z * v[2]; if (q > p1) p1 = q; }
        let h1 = -2, h2 = -2;
        for (let k = 0; k < F.length; k++) { const v = F[k], q = x * v[0] + y * v[1] + z * v[2]; if (q > h1) { h2 = h1; h1 = q; } else if (q > h2) h2 = q; }
        const aP = Math.acos(clamp(p1, -1, 1)) + WP, aH1 = Math.acos(clamp(h1, -1, 1)), aH2 = Math.acos(clamp(h2, -1, 1));
        let near, second, isP;
        if (aP < aH1) { near = aP; second = aH1; isP = true; } else { near = aH1; second = Math.min(aP, aH2); isP = false; }
        const t = smooth(clamp((second - near - SEAM) / AA, 0, 1));
        const base = isP ? RED : WHITE;
        d[o] = NAVY[0] + (base[0] - NAVY[0]) * t;
        d[o + 1] = NAVY[1] + (base[1] - NAVY[1]) * t;
        d[o + 2] = NAVY[2] + (base[2] - NAVY[2]) * t;
        d[o + 3] = 255;
        o += 4;
      }
    }
    g.putImageData(im, 0, 0);
    return c;
  }

  function initBall() {
    const host = $("[data-ball]");
    const hero = $("[data-hero]");
    if (!host || !hero) return;
    const holder = $("[data-ball-canvas]", host);
    const shadow = $("[data-ball-shadow]", host);
    const hit = $("[data-ball-hit]", host);
    const T = window.THREE;
    const fallback = () => {
      host.remove();
      root.classList.remove("ball-on");
      if (!$(".ball-css", hero)) {
        const b = document.createElement("span");
        b.className = "ball-css"; b.setAttribute("aria-hidden", "true");
        hero.insertBefore(b, hero.firstChild);
      }
    };
    if (!T || !T.WebGLRenderer) { fallback(); return; }
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); } catch (e) { fallback(); return; }
    if (!renderer || !renderer.getContext()) { fallback(); return; }
    if ("outputColorSpace" in renderer && T.SRGBColorSpace) renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const cvs = renderer.domElement;
    cvs.setAttribute("aria-hidden", "true");
    holder.appendChild(cvs);
    cvs.addEventListener("webglcontextlost", e => { e.preventDefault(); stopLoop(); fallback(); });

    const isMobile = () => vw() < 900;
    const scene = new T.Scene();
    const cam = new T.OrthographicCamera(-1.25, 1.25, 1.25, -1.25, 0.1, 10);   // la esfera ocupa el 80 % del lienzo
    cam.position.set(0, 0, 5);
    const tex = new T.CanvasTexture(ballTexture(isMobile() ? 512 : 1024, isMobile() ? 256 : 512));
    if ("colorSpace" in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    const mat = new T.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 });
    const mesh = new T.Mesh(new T.SphereGeometry(1, 64, 48), mat);
    const roll = new T.Group();
    roll.add(mesh); scene.add(roll);
    scene.add(new T.AmbientLight(0xffffff, 0.55));
    scene.add(new T.HemisphereLight(0x9DB4FF, 0x0B1530, 0.35));
    const sun = new T.DirectionalLight(0xffffff, 1.35);
    sun.position.set(-2.2, 2.8, 4);
    scene.add(sun);
    mesh.rotation.set(0.42, 0.6, 0);

    // Lienzo de tamaño escalonado: se reasigna solo cuando cambia de escalón
    const BUCKETS = [128, 200, 320, 480, 720];
    let S_css = 0;
    const sizeFor = d => { const want = d * 1.3; for (let i = 0; i < BUCKETS.length; i++) if (BUCKETS[i] >= want) return BUCKETS[i]; return BUCKETS[BUCKETS.length - 1]; };
    const setSize = s => {
      if (s === S_css) return;
      S_css = s;
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      renderer.setSize(s, s, false);
      holder.style.width = s + "px"; holder.style.height = s + "px";
    };

    // Puntos de la curva del caso (coordenadas del SVG 600 × 300)
    const chartPath = $("[data-chart-line]");
    const chartSvg = chartPath && chartPath.ownerSVGElement;
    const curve = [];
    if (chartPath && chartPath.getTotalLength) {
      const L = chartPath.getTotalLength();
      for (let i = 0; i <= 120; i++) { const pt = chartPath.getPointAtLength(L * i / 120); curve.push([pt.x, pt.y]); }
    }
    const photo = $("[data-iris]");
    const title = $("[data-hero-title]");
    const scroller = $("[data-hscroll-scroller]");
    const sticky = $("[data-hscroll-sticky]");
    const track = $("[data-hscroll-track]");
    const caseScroller = $("[data-case-scroller]");
    const caseStage = $("[data-case]");
    const contact = $("[data-contact]");
    const contactTitle = $(".contact-title");
    const docTop = el => el.getBoundingClientRect().top + scrollY;

    // Estados por sección: {x, y, d (diámetro), roll, live (zona clicable activa), floor (sombra)}
    const st = {
      hero(y) {
        const W = vw(), H = vh(), r = hero.getBoundingClientRect();
        if (isMobile()) {
          const d = Math.min(W * 0.36, 150);
          const tr = title.getBoundingClientRect();
          return { x: W - 16 - d / 2, y: tr.top + tr.height * 0.48, d, live: true };
        }
        const d = Math.min(W * 0.32, H * 0.56, 520);
        return { x: Math.min(W * 0.78, W - d / 2 - 40), y: r.top + r.height * 0.5, d, live: true, floor: true };
      },
      profile() {
        const r = photo.getBoundingClientRect();
        const d = isMobile() ? 76 : 120;
        return { x: r.right - d * (isMobile() ? 0.62 : 0.2), y: r.bottom - d * 0.3, d };
      },
      exp() {
        const W = vw(), sr = sticky.getBoundingClientRect(), tr = track.getBoundingClientRect();
        const space = sr.bottom - tr.bottom;
        const d = clamp(space - 26, 46, 92);
        const x0 = W * 0.82, x = lerp(x0, W * 0.1, S.hx.p);
        return { x, y: sr.bottom - d / 2 - 12, d, roll: (x0 - x) / (d / 2), floor: true };
      },
      case() {
        const r = chartSvg.getBoundingClientRect();
        const n = curve.length - 1, f = clamp(S.cs.p, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
        const px = lerp(curve[i][0], curve[i + 1][0], t), py = lerp(curve[i][1], curve[i + 1][1], t);
        const d = isMobile() ? 52 : 84;
        const hop = Math.abs(Math.sin(S.cs.p * Math.PI * 6)) * d * 0.28 * (1 - S.cs.p * 0.6);
        return { x: r.left + (px / 600) * r.width, y: r.top + (py / 300) * r.height - d / 2 - 4 - hop, d, hop, floor: true };
      },
      contact() {
        const W = vw(), r = contact.getBoundingClientRect(), tr = contactTitle.getBoundingClientRect();
        if (isMobile()) { const d = 84; return { x: W - 16 - d / 2, y: tr.top + tr.height * 0.5, d, live: true }; }
        const d = Math.min(W * 0.2, 240);
        return { x: Math.min(W - d / 2 - 30, Math.max(tr.right + d * 0.75, W * 0.72)), y: r.top + r.height * 0.44, d, live: true, floor: true, rest: true };
      }
    };
    // Tramos en coordenadas de scroll (se recalculan en cada cuadro: siempre derivados del layout actual)
    function stations() {
      const H = vh(), out = [];
      out.push({ s: -1e9, e: hero.offsetHeight * 0.22, f: st.hero });
      if (photo) { const t = docTop(photo); out.push({ s: t - H * 0.9, e: t + photo.offsetHeight - H * 0.35, f: st.profile }); }
      if (S.hx.on && scroller) { const t = docTop(scroller); out.push({ s: t - H * 0.25, e: t + S.hx.dist + H * 0.05, f: st.exp }); }
      if (chartSvg && curve.length) {
        if (S.cs.mode === "sticky") { const t = docTop(caseScroller); out.push({ s: t - H * 0.3, e: t + 1.4 * H, f: st.case }); }
        else if (S.cs.mode === "once") { const t = docTop(caseStage); out.push({ s: t - H * 0.55, e: t + caseStage.offsetHeight - H * 0.45, f: st.case }); }
      }
      if (contact) out.push({ s: Math.min(docTop(contact) - H * 0.3, root.scrollHeight - H - 1), e: 1e9, f: st.contact });
      return out;
    }
    const mix = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), d: lerp(a.d, b.d, t), roll: lerp(a.roll || 0, b.roll || 0, t), hop: 0, floor: t < 0.5 ? a.floor : b.floor, live: false });
    let cur = { x: 0, y: 0, d: 100, o: 0, roll: 0, live: false, floor: false, hop: 0 };
    function compute(y) {
      const H = vh(), list = stations();
      for (let i = 0; i < list.length; i++) {
        const a = list[i], b = list[i + 1];
        if (!b || y <= a.e) { const s = a.f(y); s.o = 1; return s; }   // dentro de la sección a
        if (y >= b.s) continue;                                          // ya está en b o más adelante
        const gap = b.s - a.e;
        if (gap <= H * 1.1) {                                            // tramo corto: viaja de una sección a la otra
          const s = mix(a.f(y), b.f(y), smooth((y - a.e) / gap)); s.o = 1; return s;
        }
        const fade = H * 0.45;                                           // tramo largo: se va con su sección y vuelve en la siguiente
        if (y < a.e + fade) { const s = a.f(y); s.o = 1 - (y - a.e) / fade; return s; }
        if (y > b.s - fade) { const s = b.f(y); s.o = 1 - (b.s - y) / fade; return s; }
        return { x: cur.x, y: cur.y, d: cur.d, o: 0 };
      }
      return cur;
    }

    // Interacción: el mouse inclina la pelota; clic o toque = rebote con compresión y giro
    let mx = 0, my = 0, tiltX = 0, tiltY = 0, spin = 0, spinVel = 0, kickT = -1e9;
    if (fine) addEventListener("pointermove", e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
    hit.addEventListener("pointerdown", e => { e.preventDefault(); kickT = performance.now(); spinVel += 0.012; start(); });

    let raf = null, last = performance.now(), intro = 0;
    const introT0 = performance.now() + (reduced ? 0 : 900);
    function draw(now) {
      const dt = Math.min(64, now - last); last = now;
      intro = reduced ? 1 : smooth(clamp((now - introT0) / 900, 0, 1));
      // Rebote al hacer clic (900 ms): compresión breve y salto
      const kt = (now - kickT) / 900;
      let sx = 1, sy = 1, jump = 0;
      if (kt >= 0 && kt < 1) {
        if (kt < 0.14) { const q = Math.sin(Math.PI * kt / 0.14); sy = 1 - 0.22 * q; sx = 1 + 0.12 * q; }
        else { const q = Math.sin(Math.PI * (kt - 0.14) / 0.86); jump = q * cur.d * 0.55; sy = 1 + 0.06 * q; sx = 1 - 0.03 * q; }
      }
      spinVel *= 0.965;
      spin += (reduced ? 0 : 0.00028 * dt) + spinVel * dt * 0.06;
      tiltX = lerp(tiltX, my * 0.5, 0.05); tiltY = lerp(tiltY, mx * 0.8, 0.05);
      mesh.rotation.set(0.42 + tiltX, 0.6 + spin + tiltY, 0);
      roll.rotation.z = cur.roll || 0;
      mesh.scale.set(sx, sy, sx);
      const d = cur.d * (0.85 + 0.15 * intro);
      setSize(sizeFor(d));
      const sc = d / (S_css * 0.8);
      const by = cur.y - jump + d * (1 - sy) * 0.5;               // al comprimirse, apoya la base
      holder.style.transform = "translate3d(" + (cur.x - S_css * sc / 2).toFixed(1) + "px," + (by - S_css * sc / 2).toFixed(1) + "px,0) scale(" + sc.toFixed(4) + ")";
      holder.style.opacity = (cur.o * intro).toFixed(3);
      // Sombra de contacto blanda (solo escritorio)
      if (!isMobile() && cur.floor) {
        const lift = (cur.hop || 0) + jump;
        const k = clamp(1 - lift / (d * 0.9), 0.25, 1);
        shadow.style.transform = "translate3d(" + cur.x.toFixed(1) + "px," + (cur.y + d * 0.52).toFixed(1) + "px,0) scale(" + (d / 100 * (0.6 + 0.4 * k)).toFixed(3) + "," + (d / 100 * 0.7 * (0.6 + 0.4 * k)).toFixed(3) + ")";
        shadow.style.opacity = (cur.o * intro * (cur.rest ? 0.75 : 0.5) * k).toFixed(3);
      } else shadow.style.opacity = "0";
      // Zona clicable propia, solo donde la pelota no tapa contenido
      const live = cur.live && cur.o > 0.9;
      hit.classList.toggle("is-live", live);
      if (live) { hit.style.width = hit.style.height = d.toFixed(0) + "px"; hit.style.transform = "translate3d(" + (cur.x - d / 2).toFixed(1) + "px," + (cur.y - jump - d / 2).toFixed(1) + "px,0)"; }
      if (cur.o > 0.01) renderer.render(scene, cam);
    }
    function loop(now) {
      raf = null;
      if (document.hidden) return;
      draw(now);
      const busy = cur.o > 0.01 || now - kickT < 900;
      if (busy && !reduced) raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } }
    function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = null; }
    document.addEventListener("visibilitychange", () => { if (document.hidden) stopLoop(); else start(); });

    root.classList.add("ball-on");
    if (reduced) {
      // Movimiento reducido: pelota quieta en el inicio, sin recorrido
      host.style.cssText = "position:absolute;left:0;top:0;width:100%;overflow:hidden;";
      const fit = () => { host.style.height = (hero.getBoundingClientRect().bottom + scrollY) + "px"; };
      fit(); onResize(fit);
      const place = () => {
        const s = st.hero(0);                          // coordenadas de pantalla → del documento
        cur = { x: s.x, y: s.y + scrollY, d: s.d, o: 1, roll: 0, floor: s.floor, live: false };
        draw(performance.now());
      };
      place(); onResize(place);
      return;
    }
    onScroll(y => { cur = compute(y); }, () => start());
    requestFrame();
  }

  function boot() {
    safe(initSplash, "initSplash");
    safe(initHeroIntro, "initHeroIntro");
    safe(initMesh, "initMesh");
    safe(initViewfinder, "initViewfinder");
    safe(initProgress, "initProgress");
    safe(initNav, "initNav");
    safe(initAnchors, "initAnchors");
    safe(initCursor, "initCursor");
    safe(initMagnetic, "initMagnetic");
    safe(initReveals, "initReveals");
    safe(initLines, "initLines");
    safe(initCounters, "initCounters");
    safe(initTimeline, "initTimeline");
    safe(initIris, "initIris");
    safe(initHScroll, "initHScroll");
    safe(initCase, "initCase");
    safe(initTilt, "initTilt");
    safe(initCvTilt, "initCvTilt");
    safe(initStrip, "initStrip");
    safe(initMarquee, "initMarquee");
    safe(initSeams, "initSeams");
    safe(initVideo, "initVideo");
    safe(initReel, "initReel");
    safe(initLightbox, "initLightbox");
    safe(initShutter, "initShutter");
    safe(initCopy, "initCopy");
    safe(initBall, "initBall");
    requestFrame();
    // Solo se recalculan medidas (altura de las secciones sticky); nunca se toca la posición de scroll
    addEventListener("load", runResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(runResize);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
