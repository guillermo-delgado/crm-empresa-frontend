import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";

/* ======================================================
   ✨ INAUGURACIÓN CRM V2
   Animación a pantalla completa (canvas, sin librerías):
   1. Partículas que viajan en espiral y forman "CRM V2".
   2. Destello + onda expansiva, el texto se enciende con brillo.
   3. Cañones de confeti y fuegos artificiales.
   4. Mensaje de bienvenida y botón "Entrar".

   - Sale UNA sola vez por empleado (se recuerda en localStorage).
   - Para verla otra vez (pruebas): ?bienvenida=1 en la URL, con cualquier rol.
====================================================== */

// <<ANIM
type Particula = {
  tx: number; ty: number; sx: number; sy: number;
  d: number; c: string; r: number; sw: number; ph: number;
};
type Confeti = {
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number; w: number; h: number; c: string; ph: number;
};
type Chispa = {
  x: number; y: number; vx: number; vy: number;
  c: string; vida: number; max: number;
};

function iniciarAnimacion(canvas: HTMLCanvasElement, reducir: boolean): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const c2d: CanvasRenderingContext2D = ctx;

  const TEXTO = "CRM V2";
  const T_FLASH = 3.2; // segundo en el que se forma el logo
  const PALETA = ["#2f5bd3", "#7aa2ff", "#ffffff", "#ffd166", "#ff6b9d", "#5eead4", "#a78bfa"];

  let w = 0, h = 0, dpr = 1, fs = 100, cx = 0, cy = 0, wt = 0;
  let raf = 0;
  let particulas: Particula[] = [];
  const confeti: Confeti[] = [];
  const chispas: Chispa[] = [];
  const estrellas = Array.from({ length: 110 }, () => ({
    x: Math.random(), y: Math.random(), z: Math.random() * 0.8 + 0.2, ph: Math.random() * 6.28,
  }));
  let confetiLanzado = false;
  const fuegos = [3.9, 4.5, 5.1, 5.8, 6.6];
  let fuegoIdx = 0;

  const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const fuente = (s: number) =>
    '900 ' + s + 'px Inter, "Segoe UI", system-ui, -apple-system, sans-serif';

  function construir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    const off = document.createElement("canvas");
    off.width = Math.ceil(w);
    off.height = Math.ceil(h);
    const o = off.getContext("2d", { willReadFrequently: true });
    if (!o) return;

    o.font = fuente(100);
    const ancho100 = o.measureText(TEXTO).width;
    fs = Math.min((Math.min(w * 0.86, 1150) / ancho100) * 100, h * 0.32);
    cx = w / 2;
    cy = h * 0.37;

    o.font = fuente(fs);
    o.textAlign = "center";
    o.textBaseline = "middle";
    o.fillStyle = "#fff";
    o.fillText(TEXTO, cx, cy);
    wt = o.measureText(TEXTO).width;
    const v2x = cx - wt / 2 + o.measureText("CRM ").width;

    const data = o.getImageData(0, 0, off.width, off.height).data;
    let paso = Math.max(2, Math.round(fs / 55));
    let puntos: number[][] = [];
    for (;;) {
      puntos = [];
      for (let y = 0; y < off.height; y += paso)
        for (let x = 0; x < off.width; x += paso)
          if (data[(y * off.width + x) * 4 + 3] > 128) puntos.push([x, y]);
      if (puntos.length <= 4200 || paso > 14) break;
      paso++;
    }

    particulas = puntos.map(([tx, ty]) => {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.max(w, h) * (0.55 + Math.random() * 0.5);
      const esV2 = tx >= v2x - 2;
      return {
        tx, ty,
        sx: cx + Math.cos(ang) * rad,
        sy: cy + Math.sin(ang) * rad * 0.7,
        d: Math.random() * 1.1,
        c: esV2 ? "#ffffff" : Math.random() < 0.5 ? "#7aa2ff" : "#a9c1ff",
        r: paso * 0.55 * (0.8 + Math.random() * 0.6),
        sw: (Math.random() - 0.5) * 2,
        ph: Math.random() * 6.28,
      };
    });
  }

  function lanzarConfeti() {
    for (let i = 0; i < 280; i++) {
      const lado = i % 2;
      const base = lado ? -Math.PI * 0.62 : -Math.PI * 0.38;
      const ang = base + (Math.random() - 0.5) * 0.7;
      const vel = h * (0.8 + Math.random() * 0.6);
      confeti.push({
        x: lado ? w * 0.97 : w * 0.03,
        y: h * 1.02,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 14,
        w: 6 + Math.random() * 7,
        h: 9 + Math.random() * 8,
        c: PALETA[Math.floor(Math.random() * PALETA.length)],
        ph: Math.random() * 6.28,
      });
    }
  }

  function fuegoArtificial() {
    const x = w * (0.12 + Math.random() * 0.76);
    const y = h * (0.1 + Math.random() * 0.4);
    const color = PALETA[Math.floor(Math.random() * PALETA.length)];
    const color2 = PALETA[Math.floor(Math.random() * PALETA.length)];
    for (let i = 0; i < 80; i++) {
      const ang = Math.random() * Math.PI * 2;
      const vel = 60 + Math.random() * 230;
      chispas.push({
        x, y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        c: i % 3 === 0 ? color2 : color,
        vida: 0,
        max: 1.0 + Math.random() * 0.9,
      });
    }
  }

  let ultimo = performance.now();
  const t0 = ultimo;

  function cuadro(ahora: number) {
    const t = reducir ? 9 : (ahora - t0) / 1000;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;

    // Fondo con estela
    c2d.globalCompositeOperation = "source-over";
    c2d.globalAlpha = 1;
    c2d.fillStyle = "rgba(5,10,28,0.26)";
    c2d.fillRect(0, 0, w, h);

    // Resplandor ambiental
    const amb = c2d.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.65);
    amb.addColorStop(0, "rgba(47,91,211,0.20)");
    amb.addColorStop(1, "rgba(47,91,211,0)");
    c2d.fillStyle = amb;
    c2d.fillRect(0, 0, w, h);

    // Estrellas
    c2d.globalCompositeOperation = "lighter";
    for (const e of estrellas) {
      const y = (e.y + t * 0.012 * e.z) % 1;
      c2d.globalAlpha = (0.25 + 0.5 * Math.abs(Math.sin(t * 1.3 + e.ph))) * e.z;
      c2d.fillStyle = "#cfe0ff";
      c2d.fillRect(e.x * w, y * h, 1.6 * e.z, 1.6 * e.z);
    }

    // Partículas formando el logo
    const dim = t < T_FLASH ? 1 : Math.max(0.16, 1 - (t - T_FLASH) * 0.9);
    for (const p of particulas) {
      const k = clamp((t - p.d) / 2.1);
      const e = 1 - Math.pow(1 - k, 3);
      const dx = p.tx - p.sx, dy = p.ty - p.sy;
      const len = Math.hypot(dx, dy) || 1;
      const giro = (1 - e) * Math.sin(k * Math.PI) * p.sw * 110;
      let x = p.sx + dx * e + (-dy / len) * giro;
      let y = p.sy + dy * e + (dx / len) * giro;
      if (k >= 1) {
        x += Math.sin(t * 2 + p.ph) * 0.6;
        y += Math.cos(t * 1.7 + p.ph) * 0.6;
      }
      c2d.globalAlpha = (0.35 + 0.65 * k) * dim;
      c2d.fillStyle = p.c;
      c2d.beginPath();
      c2d.arc(x, y, p.r, 0, 6.2832);
      c2d.fill();
    }

    // Destello + onda expansiva
    if (t >= T_FLASH) {
      const s = t - T_FLASH;
      const fa = Math.max(0, 0.6 - s * 0.95);
      if (fa > 0) {
        const g = c2d.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
        g.addColorStop(0, "rgba(190,212,255," + fa + ")");
        g.addColorStop(1, "rgba(190,212,255,0)");
        c2d.globalAlpha = 1;
        c2d.fillStyle = g;
        c2d.fillRect(0, 0, w, h);
      }
      for (let i = 0; i < 2; i++) {
        const ss = s - i * 0.18;
        if (ss <= 0) continue;
        const ra = Math.max(0, 0.85 - ss * 0.65);
        if (ra <= 0) continue;
        c2d.globalAlpha = 1;
        c2d.strokeStyle = "rgba(160,192,255," + ra + ")";
        c2d.lineWidth = 4 - i * 2;
        c2d.beginPath();
        c2d.arc(cx, cy, ss * Math.max(w, h) * 0.85, 0, 6.2832);
        c2d.stroke();
      }
    }

    // Logo sólido con brillo
    if (t >= T_FLASH) {
      const a = clamp((t - T_FLASH) / 0.7);
      c2d.globalCompositeOperation = "source-over";
      c2d.font = fuente(fs);
      c2d.textAlign = "center";
      c2d.textBaseline = "middle";

      const base = c2d.createLinearGradient(cx - wt / 2, 0, cx + wt / 2, 0);
      base.addColorStop(0, "#7fa4ff");
      base.addColorStop(0.58, "#c4d6ff");
      base.addColorStop(0.6, "#ffffff");
      base.addColorStop(1, "#ffffff");
      c2d.globalAlpha = a;
      c2d.shadowColor = "rgba(110,155,255,0.9)";
      c2d.shadowBlur = 36;
      c2d.fillStyle = base;
      c2d.fillText(TEXTO, cx, cy);
      c2d.shadowBlur = 0;

      // Barrido de luz
      const pos = (((t - T_FLASH - 0.4) * 0.5) % 1.9) - 0.45;
      if (pos > 0.05 && pos < 0.95) {
        const sh = c2d.createLinearGradient(cx - wt / 2, 0, cx + wt / 2, 0);
        sh.addColorStop(Math.max(0, pos - 0.1), "rgba(255,255,255,0)");
        sh.addColorStop(pos, "rgba(255,255,255,0.95)");
        sh.addColorStop(Math.min(1, pos + 0.1), "rgba(255,255,255,0)");
        c2d.globalAlpha = a;
        c2d.fillStyle = sh;
        c2d.fillText(TEXTO, cx, cy);
      }
    }

    // Confeti
    if (!reducir && t >= T_FLASH + 0.15 && !confetiLanzado) {
      confetiLanzado = true;
      lanzarConfeti();
    }
    c2d.globalCompositeOperation = "source-over";
    for (let i = confeti.length - 1; i >= 0; i--) {
      const f = confeti[i];
      f.vy += h * 1.1 * dt;
      const arrastre = Math.pow(0.32, dt);
      f.vx *= arrastre;
      f.vy = Math.min(f.vy * arrastre, 230);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (f.y > h + 30) {
        confeti.splice(i, 1);
        continue;
      }
      c2d.save();
      c2d.globalAlpha = 0.95;
      c2d.translate(f.x, f.y);
      c2d.rotate(f.rot);
      c2d.scale(1, Math.cos(t * 5 + f.ph));
      c2d.fillStyle = f.c;
      c2d.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
      c2d.restore();
    }

    // Fuegos artificiales
    if (!reducir) {
      while (fuegoIdx < fuegos.length && t >= fuegos[fuegoIdx]) {
        fuegoArtificial();
        fuegoIdx++;
      }
    }
    c2d.globalCompositeOperation = "lighter";
    for (let i = chispas.length - 1; i >= 0; i--) {
      const s = chispas[i];
      s.vida += dt;
      if (s.vida >= s.max) {
        chispas.splice(i, 1);
        continue;
      }
      s.vy += 140 * dt;
      s.vx *= Math.pow(0.4, dt);
      s.vy *= Math.pow(0.55, dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      c2d.globalAlpha = 1 - s.vida / s.max;
      c2d.fillStyle = s.c;
      c2d.beginPath();
      c2d.arc(s.x, s.y, 2.2, 0, 6.2832);
      c2d.fill();
    }

    c2d.globalAlpha = 1;
    c2d.globalCompositeOperation = "source-over";
    if (!reducir) raf = requestAnimationFrame(cuadro);
  }

  const alRedimensionar = () => construir();
  construir();
  window.addEventListener("resize", alRedimensionar);
  if (reducir) cuadro(performance.now());
  else raf = requestAnimationFrame(cuadro);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", alRedimensionar);
  };
}
// ANIM>>

function leerUsuario(): any {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function yaVisto(clave: string) {
  try {
    return localStorage.getItem(clave) === "1";
  } catch {
    return false;
  }
}

export default function BienvenidaV2() {
  const usuario = useMemo(leerUsuario, []);
  const clave = `crm_v2_bienvenida_${
    usuario?._id || usuario?.id || usuario?.email || "anon"
  }`;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    const forzada =
      new URLSearchParams(window.location.search).get("bienvenida") === "1";
    return forzada || (usuario?.role === "empleado" && !yaVisto(clave));
  });
  const [saliendo, setSaliendo] = useState(false);

  const cerrar = () => {
    if (saliendo) return;
    setSaliendo(true);
    setTimeout(() => {
      try {
        localStorage.setItem(clave, "1");
      } catch {
        /* sin almacenamiento: se mostrará de nuevo */
      }
      setVisible(false);
    }, 550);
  };

  // Animación de fondo
  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    const reducir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return iniciarAnimacion(canvasRef.current, !!reducir);
  }, [visible]);

  // Sin scroll de fondo y Esc para saltar
  useEffect(() => {
    if (!visible) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, saliendo]);

  if (!visible) return null;

  const nombre = String(usuario?.nombre || "").trim().split(" ")[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Inauguración del CRM V2"
      className={`fixed inset-0 z-[120] overflow-hidden bg-[#050a1c] ${
        saliendo ? "v2-out" : "v2-in"
      }`}
    >
      <style>{`
        @keyframes v2-rise{from{opacity:0;transform:translateY(22px);filter:blur(8px)}to{opacity:1;transform:none;filter:blur(0)}}
        @keyframes v2-fade{from{opacity:0}to{opacity:1}}
        @keyframes v2-leave{from{opacity:1;transform:scale(1);filter:blur(0)}to{opacity:0;transform:scale(1.08);filter:blur(10px)}}
        @keyframes v2-glow{0%,100%{box-shadow:0 0 0 0 rgba(122,162,255,.55),0 10px 40px rgba(47,91,211,.55)}50%{box-shadow:0 0 0 14px rgba(122,162,255,0),0 10px 50px rgba(47,91,211,.8)}}
        .v2-in{animation:v2-fade .5s ease both}
        .v2-out{animation:v2-leave .55s ease both}
        .v2-r{animation-name:v2-rise;animation-duration:.9s;animation-fill-mode:both;animation-timing-function:cubic-bezier(.2,.8,.2,1)}
        @media (prefers-reduced-motion: reduce){
          .v2-in,.v2-out,.v2-r,.v2-btn{animation:none!important}
        }
      `}</style>

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Saltar */}
      <button
        type="button"
        onClick={cerrar}
        className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur transition hover:bg-white/20"
      >
        Saltar <X className="h-4 w-4" />
      </button>

      {/* Mensaje */}
      <div className="pointer-events-none absolute inset-x-0 top-[58%] flex flex-col items-center px-6 text-center">
        <span
          className="v2-r mb-4 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.35em] text-blue-100 backdrop-blur"
          style={{ animationDelay: "3.5s" }}
        >
          ✦ Inauguración ✦
        </span>

        <h2
          className="v2-r text-2xl font-extrabold text-white sm:text-4xl"
          style={{ animationDelay: "3.9s" }}
        >
          {nombre ? `Hola, ${nombre}. ` : ""}Bienvenida al nuevo CRM
        </h2>

        <p
          className="v2-r mt-3 max-w-xl text-sm text-blue-100/80 sm:text-base"
          style={{ animationDelay: "4.4s" }}
        >
          Más rápido, en tiempo real, un formmulario para todo y sorteos.
        </p>

        <button
          type="button"
          onClick={cerrar}
          autoFocus
          className="v2-r v2-btn pointer-events-auto mt-8 inline-flex items-center gap-2 rounded-2xl bg-[#2f5bd3] px-8 py-4 text-base font-bold text-white transition hover:bg-[#3a6df0]"
          style={{
            animationName: "v2-rise, v2-glow",
            animationDuration: ".9s, 2.4s",
            animationDelay: "5s, 5.9s",
            animationIterationCount: "1, infinite",
            animationFillMode: "both, none",
          }}
        >
          Entrar al CRM
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}