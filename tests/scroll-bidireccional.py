"""Test de scroll bidireccional del portfolio (Playwright, Python).

Uso (con la página servida por http, no por file://):
    py -m http.server 8767 --directory portfolio-memorable
    py tests/scroll-bidireccional.py [URL] [--browser RUTA_AL_EJECUTABLE] [--headed]

Si no se indica --browser, usa Brave si está instalado; si no, el Chromium de Playwright.
Para cada tamaño (1920x1080, 1536x864, 1366x768, 390x844) y con el desplazamiento suave
del navegador apagado y encendido, verifica:
  1. Rueda hasta el final y vuelta a 0 con saltos de 150 y 400 px: en la subida scrollY
     nunca aumenta y termina en 0.
  2. Teclado: End, varias veces PageUp y Home.
  3. Clic en "Caso TodoHandball" y en "Contacto" del menú y después rueda hacia arriba hasta 0.
  4. Detenerse a mitad de Experiencia y a mitad del caso y alternar subir/bajar.
  5. Ráfaga rápida de rueda hacia arriba (sin pausas) desde el final.
También registra errores de consola propios del sitio.
"""
import os
import sys
import time

from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:8767/")
HEADED = "--headed" in sys.argv
BROWSER = None
if "--browser" in sys.argv:
    BROWSER = sys.argv[sys.argv.index("--browser") + 1]
else:
    for p in (r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
              r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe"):
        if os.path.exists(p):
            BROWSER = p
            break

SIZES = [(1920, 1080), (1536, 864), (1366, 768), (390, 844)]
if "--only" in sys.argv:
    _w, _h = sys.argv[sys.argv.index("--only") + 1].split("x")
    SIZES = [(int(_w), int(_h))]
MODES = (False,) if "--fast" in sys.argv else (False, True)
THIRD_PARTY = ("fonts.googleapis", "fonts.gstatic", "youtube", "ytimg", "instagram", "cdninstagram", "facebook", "fbcdn")

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("  OK   " if ok else "  FALLA") + "  " + name + ("  · " + detail if detail else ""))


def sy(page):
    return page.evaluate("window.scrollY")


def max_y(page):
    return page.evaluate("document.documentElement.scrollHeight - innerHeight")


def wait_still(page, timeout=3.0):
    """Espera a que scrollY deje de cambiar (fin de animaciones de scroll)."""
    last, same, t0 = sy(page), 0, time.time()
    while time.time() - t0 < timeout:
        page.wait_for_timeout(60)
        cur = sy(page)
        same = same + 1 if abs(cur - last) < 0.5 else 0
        last = cur
        if same >= 5:
            break
    return last


def wheel_to_end(page, step, pause=40):
    stuck = 0
    prev = sy(page)
    for _ in range(4000):
        page.mouse.wheel(0, step)
        page.wait_for_timeout(pause)
        cur = sy(page)
        if cur >= max_y(page) - 1:
            break
        stuck = stuck + 1 if cur <= prev + 0.5 else 0
        if stuck > 25:
            return False, cur
        prev = cur
    return True, wait_still(page)


def wheel_to_top(page, step, pause=40):
    """Sube con la rueda; devuelve (llegó a 0, monótono, detalle)."""
    seq = [sy(page)]
    stuck = 0
    for _ in range(4000):
        page.mouse.wheel(0, -step)
        page.wait_for_timeout(pause)
        cur = sy(page)
        seq.append(cur)
        if cur <= 0:
            break
        stuck = stuck + 1 if cur >= seq[-2] - 0.5 else 0
        if stuck > 25:
            break
    final = wait_still(page)
    seq.append(final)
    rises = [(i, seq[i - 1], seq[i]) for i in range(1, len(seq)) if seq[i] > seq[i - 1] + 1]
    detail = "pasos=%d final=%.0f" % (len(seq), final)
    if rises:
        detail += " subidas=%s" % rises[:3]
    return final <= 0.5, not rises, detail


def go_top(page):
    page.evaluate("window.scrollTo(0, 0)")
    wait_still(page)


def run_size(pw, w, h, smooth):
    tag = "%dx%d %s" % (w, h, "suave" if smooth else "sin suave")
    print("\n== " + tag + " ==")
    args = ["--enable-smooth-scrolling"] if smooth else ["--disable-smooth-scrolling"]
    launch = dict(headless=not HEADED, args=args)
    if BROWSER:
        launch["executable_path"] = BROWSER
    browser = pw.chromium.launch(**launch)
    mobile = w < 768
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1,
                              is_mobile=False, has_touch=mobile)
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and not any(t in m.text for t in THIRD_PARTY) else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL, wait_until="load")
    page.wait_for_timeout(2600)
    page.mouse.move(w / 2, h / 2)

    # 1. Rueda abajo/arriba con dos tamaños de salto
    for step in (150, 400):
        go_top(page)
        ok_down, y_end = wheel_to_end(page, step)
        check(tag + " · rueda %dpx hasta el final" % step, ok_down, "y=%.0f max=%.0f" % (y_end, max_y(page)))
        ok0, mono, det = wheel_to_top(page, step)
        check(tag + " · rueda %dpx de vuelta a 0" % step, ok0 and mono, det)

    # 2. Teclado
    go_top(page)
    page.keyboard.press("End")
    y = wait_still(page, 4)
    check(tag + " · tecla End", y >= max_y(page) - 2, "y=%.0f" % y)
    seq = [y]
    for _ in range(400):
        page.keyboard.press("PageUp")
        seq.append(wait_still(page, 1.5))
        if seq[-1] <= 0:
            break
    rises = [i for i in range(1, len(seq)) if seq[i] > seq[i - 1] + 1]
    check(tag + " · PageUp hasta 0", seq[-1] <= 0.5 and not rises, "pasos=%d final=%.0f" % (len(seq), seq[-1]))
    page.keyboard.press("End"); wait_still(page, 4)
    page.keyboard.press("Home")
    y = wait_still(page, 4)
    check(tag + " · tecla Home", y <= 0.5, "y=%.0f" % y)

    # 3. Menú: Caso y Contacto, después rueda arriba
    for label, sel in (("Caso TodoHandball", "#caso"), ("Contacto", "#contacto")):
        go_top(page)
        toggle = page.locator("[data-nav-toggle]")
        if toggle.is_visible():
            toggle.click()
            page.wait_for_timeout(300)
        page.locator(".nav-list a", has_text=label).click()
        y = wait_still(page, 4)
        top = page.evaluate("document.querySelector('%s').getBoundingClientRect().top" % sel)
        check(tag + " · menú «%s» llega a la sección" % label, abs(top - 64) < 6 or y >= max_y(page) - 2, "top=%.0f y=%.0f" % (top, y))
        ok0, mono, det = wheel_to_top(page, 400)
        check(tag + " · después de «%s», rueda arriba hasta 0" % label, ok0 and mono, det)

    # 4. Mitad de Experiencia y mitad del caso: alternar
    spots = page.evaluate("""() => {
        const out = {};
        const ex = document.querySelector('[data-hscroll-scroller]');
        const cs = document.querySelector('[data-case-scroller]');
        const top = el => el.getBoundingClientRect().top + scrollY;
        out.exp = top(ex) + Math.max(0, ex.offsetHeight - innerHeight) / 2;
        out.caso = top(cs) + Math.max(0, cs.offsetHeight - innerHeight) / 2;
        return out;
    }""")
    for name, target in spots.items():
        page.evaluate("y => window.scrollTo(0, y)", target)
        wait_still(page)
        bad = []
        snap0 = page.evaluate("[scrollY, (document.querySelector('[data-hscroll-track]').style.transform||''), document.querySelector('[data-giant]').textContent]")
        for i in range(12):
            d = -300 if i % 2 == 0 else 300
            before = sy(page)
            page.mouse.wheel(0, d)
            after = wait_still(page, 1.5)
            if (d < 0 and not after < before - 1) or (d > 0 and not after > before + 1):
                bad.append((i, d, round(before), round(after)))
        page.evaluate("y => window.scrollTo(0, y)", snap0[0])
        wait_still(page)
        page.wait_for_timeout(150)
        snap1 = page.evaluate("[scrollY, (document.querySelector('[data-hscroll-track]').style.transform||''), document.querySelector('[data-giant]').textContent]")
        check(tag + " · mitad de %s: subir/bajar alternado" % name, not bad, str(bad[:3]) if bad else "12 cambios de sentido")
        check(tag + " · mitad de %s: mismo scroll = mismo estado" % name, snap0 == snap1, "%s / %s" % (snap0[1:], snap1[1:]))
        ok0, mono, det = wheel_to_top(page, 150)
        check(tag + " · desde la mitad de %s, rueda arriba hasta 0" % name, ok0 and mono, det)

    # 5. Ráfaga rápida desde el final
    page.keyboard.press("End"); wait_still(page, 4)
    for _ in range(80):
        page.mouse.wheel(0, -400)
    page.wait_for_timeout(200)
    ok0, mono, det = wheel_to_top(page, 400, pause=10)
    check(tag + " · ráfaga rápida hacia arriba", ok0, det)

    check(tag + " · sin errores de consola propios", not errors, "; ".join(errors[:3]))
    browser.close()


def main():
    print("URL:", URL)
    print("Navegador:", BROWSER or "Chromium de Playwright")
    with sync_playwright() as pw:
        for smooth in MODES:
            for (w, h) in SIZES:
                run_size(pw, w, h, smooth)
    fails = [r for r in results if not r[1]]
    print("\nResumen: %d verificaciones, %d fallas" % (len(results), len(fails)))
    for f in fails:
        print("  FALLA:", f[0], "·", f[2])
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
