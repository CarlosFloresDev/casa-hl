/**
 * Movimiento del sitio público. Se monta en cada `astro:page-load` y se desmonta en
 * `astro:before-swap`, así funciona con las transiciones de página de Astro.
 *
 * Atributos que entiende:
 *  - data-reveal / data-reveal="mask" / data-lines → añade .is-in al entrar en pantalla
 *  - data-scrub        → sus .scrub-word se "encienden" según el avance del scroll
 *  - data-parallax="0.2" → se desplaza con el scroll (fracción de la velocidad)
 *  - data-mouse="12"   → se mueve con el puntero (px máximos), con resorte
 *  - data-tilt         → inclinación 3D al pasar el puntero, con resorte
 *  - data-stack        → contenedor de tarjetas sticky que se reducen al ser cubiertas
 *  - data-site-header  → recibe data-scrolled="true" al bajar
 */
import Lenis from 'lenis';

type Cleanup = () => void;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

let cleanups: Cleanup[] = [];
let lenis: Lenis | null = null;

function setupLenis() {
  if (reduceMotion()) return;
  lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95, anchors: { offset: -84 } });
  let id = 0;
  const raf = (t: number) => {
    lenis?.raf(t);
    id = requestAnimationFrame(raf);
  };
  id = requestAnimationFrame(raf);
  cleanups.push(() => {
    cancelAnimationFrame(id);
    lenis?.destroy();
    lenis = null;
  });
}

function setupReveals() {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal], [data-lines]');
  if (reduceMotion() || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  // Un elemento recortado al 100% con clip-path cuenta como "no visible" para el observador,
  // así que las máscaras se observan a través de su contenedor.
  const byObserved = new Map<Element, HTMLElement[]>();
  targets.forEach((el) => {
    const observed = el.dataset.reveal === 'mask' && el.parentElement ? el.parentElement : el;
    byObserved.set(observed, [...(byObserved.get(observed) ?? []), el]);
  });
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          byObserved.get(e.target)?.forEach((el) => el.classList.add('is-in'));
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
  );
  byObserved.forEach((_, observed) => io.observe(observed));
  cleanups.push(() => io.disconnect());
}

/** Un solo bucle por cuadro para todo lo que depende del scroll o del puntero. */
function setupFrameLoop() {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  const scrubs = [...document.querySelectorAll<HTMLElement>('[data-scrub]')].map((el) => ({
    el,
    words: [...el.querySelectorAll<HTMLElement>('.scrub-word')],
  }));
  const parallax = [...document.querySelectorAll<HTMLElement>('[data-parallax]')].map((el) => ({
    el,
    speed: Number(el.dataset.parallax) || 0.2,
  }));
  const mouse = [...document.querySelectorAll<HTMLElement>('[data-mouse]')].map((el) => ({
    el,
    amount: Number(el.dataset.mouse) || 10,
    x: 0,
    y: 0,
  }));
  const stacks = [...document.querySelectorAll<HTMLElement>('[data-stack]')].map((el) => ({
    cards: [...el.querySelectorAll<HTMLElement>('.room-card')],
  }));

  const motion = !reduceMotion();
  const pointer = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
  };
  if (motion && finePointer() && mouse.length) {
    window.addEventListener('pointermove', onPointer, { passive: true });
  }

  let id = 0;
  const frame = () => {
    const vh = window.innerHeight;
    header?.setAttribute('data-scrolled', String(window.scrollY > 40));

    // Palabras que se encienden: 0 cuando el bloque entra por abajo, 1 al llegar al 35% superior.
    for (const s of scrubs) {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 1.5) continue;
      const progress = clamp((vh * 0.9 - r.top) / (r.height + vh * 0.45));
      const n = s.words.length;
      s.words.forEach((w, i) => {
        const local = clamp(progress * n - i);
        w.style.setProperty('--o', motion ? String(0.16 + local * 0.84) : '1');
      });
    }

    if (motion) {
      for (const p of parallax) {
        const r = p.el.parentElement?.getBoundingClientRect();
        if (!r || r.bottom < 0 || r.top > vh) continue;
        // Desplazamiento proporcional a cuánto ha avanzado la sección respecto al borde superior.
        p.el.style.transform = `translate3d(0, ${(-r.top * p.speed).toFixed(1)}px, 0)`;
      }
      for (const m of mouse) {
        m.x = lerp(m.x, pointer.x * m.amount, 0.06);
        m.y = lerp(m.y, pointer.y * m.amount, 0.06);
        m.el.style.translate = `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
      }
      for (const st of stacks) {
        st.cards.forEach((card, i) => {
          const next = st.cards[i + 1];
          if (!next || window.innerWidth < 1024) {
            card.style.transform = '';
            return;
          }
          const stickyTop = parseFloat(getComputedStyle(card).top) || 0;
          const nextTop = next.getBoundingClientRect().top;
          const covered = clamp(1 - (nextTop - stickyTop) / (vh - stickyTop));
          card.style.transform = `scale(${(1 - covered * 0.07).toFixed(4)})`;
          const shade = card.querySelector<HTMLElement>('[data-shade]');
          if (shade) shade.style.opacity = (covered * 0.55).toFixed(3);
        });
      }
    }
    id = requestAnimationFrame(frame);
  };
  id = requestAnimationFrame(frame);

  cleanups.push(() => {
    cancelAnimationFrame(id);
    window.removeEventListener('pointermove', onPointer);
  });
}

/** Inclinación 3D con resorte: el objetivo cambia con el puntero y el valor lo persigue. */
function setupTilt() {
  if (reduceMotion() || !finePointer()) return;
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    const max = Number(el.dataset.tilt) || 6;
    let tx = 0,
      ty = 0,
      rx = 0,
      ry = 0,
      vx = 0,
      vy = 0,
      raf = 0;
    const step = () => {
      // resorte amortiguado (rigidez 0.08, amortiguación 0.78)
      vx = (vx + (tx - rx) * 0.08) * 0.78;
      vy = (vy + (ty - ry) * 0.08) * 0.78;
      rx += vx;
      ry += vy;
      el.style.setProperty('--rx', `${rx.toFixed(3)}deg`);
      el.style.setProperty('--ry', `${ry.toFixed(3)}deg`);
      if (Math.abs(tx - rx) + Math.abs(ty - ry) + Math.abs(vx) + Math.abs(vy) > 0.01) {
        raf = requestAnimationFrame(step);
      } else {
        raf = 0;
      }
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = -((e.clientY - r.top) / r.height - 0.5) * max;
      ty = ((e.clientX - r.left) / r.width - 0.5) * max;
      kick();
    };
    const leave = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    cleanups.push(() => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    });
  });
}

function mount() {
  setupLenis();
  setupReveals();
  setupFrameLoop();
  setupTilt();
}

function unmount() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
}

document.addEventListener('astro:page-load', mount);
document.addEventListener('astro:before-swap', unmount);
