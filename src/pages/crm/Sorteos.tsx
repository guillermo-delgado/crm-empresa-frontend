import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import { getSocket } from "../../services/socket";

type Ramo = { nombre: string; participaciones: number; activo: boolean };
type Participante = {
  _id: string; numeroPoliza: string; tomador: string; ramo: string; aseguradora?: string;
  fechaEfecto?: string; fechaRegistro?: string; participaciones: number; origen: "IMPORTACION" | "MANUAL" | string;
  primaNeta?: number; participacionesBase?: number; participacionesExtra?: number; participacionesPersonalizadas?: boolean;
  ventaId?: string; // venta de origen: permite retirar la póliza al instante si la venta se anula o se elimina
};
type Ganador = { tomador?: string; numeroPoliza?: string; ramo?: string; [key: string]: unknown };
type Sorteo = {
  _id: string; nombre: string; descripcion?: string;
  fechaInicio: string; fechaFin: string; imagenUrl?: string; criterioFecha: "REGISTRO" | "EFECTO";
  ramos: Ramo[]; participantes: Participante[]; ganadores: Ganador[];
  estado: "CONFIGURACION" | "ABIERTO" | "REALIZADO";
  fechaRealizacion?: string; createdAt?: string;
  auditoria?: { metodo?: string; totalParticipaciones?: number; huellaSHA256?: string };
  historialResultados?: { _id?: string; ganador: Ganador; fecha: string; motivo?: string; tipo: "INICIAL" | "REPETICION" }[];
};
type View = "overview" | "detail" | "create";
type Tab = "participantes" | "resultado" | "configuracion";

const RAMOS_DEFAULT: Ramo[] = [
  { nombre: "Autos", participaciones: 0, activo: false },
  { nombre: "Hogar", participaciones: 0, activo: false },
  { nombre: "Vida", participaciones: 0, activo: false },
  { nombre: "Accidentes", participaciones: 0, activo: false },
  { nombre: "Salud", participaciones: 0, activo: false },
  { nombre: "Decesos Prima Periodica", participaciones: 0, activo: false },
  { nombre: "Decesos Prima única", participaciones: 0, activo: false },
  { nombre: "Empresa sin multirriesgo", participaciones: 0, activo: false },
  { nombre: "Multirriesgo (074 o 078)", participaciones: 0, activo: false },
  { nombre: "Comunidades", participaciones: 0, activo: false },
  { nombre: "Patinetes", participaciones: 0, activo: false },
  { nombre: "Viajes", participaciones: 0, activo: false },
  { nombre: "financiero", participaciones: 0, activo: false },
  { nombre: "Resto", participaciones: 0, activo: false },
];
// Color de cada ramo: c = gráficos, bg/fg = insignias y avatares (contraste AA).
const RAMO_STYLE: Record<string, { c: string; bg: string; fg: string }> = {
  autos: { c: "#2f5bd3", bg: "#e6ecff", fg: "#2446a8" },
  hogar: { c: "#1aa38b", bg: "#def5f0", fg: "#0b6b5c" },
  decesos: { c: "#7a5ce0", bg: "#ece8fb", fg: "#4b3aa6" },
  vida: { c: "#e0527f", bg: "#fde7ef", fg: "#a3254f" },
  empresas: { c: "#e8a317", bg: "#fdf0d8", fg: "#8a5a06" },
  salud: { c: "#3aa655", bg: "#e1f5e6", fg: "#1c6b32" },
  rc: { c: "#64748b", bg: "#e8ecf2", fg: "#3b475c" },
  accidentes: { c: "#f97316", bg: "#ffedd5", fg: "#9a3412" },
  "decesos prima periodica": { c: "#7a5ce0", bg: "#ece8fb", fg: "#4b3aa6" },
  "decesos prima única": { c: "#a78bfa", bg: "#f1ecfe", fg: "#5b3fb5" },
  "empresa sin multirriesgo": { c: "#e8a317", bg: "#fdf0d8", fg: "#8a5a06" },
  "multirriesgo (074 o 078)": { c: "#0ea5e9", bg: "#e0f2fe", fg: "#075985" },
  comunidades: { c: "#84cc16", bg: "#ecfccb", fg: "#3f6212" },
  patinetes: { c: "#06b6d4", bg: "#cffafe", fg: "#155e75" },
  viajes: { c: "#6366f1", bg: "#e0e7ff", fg: "#3730a3" },
  financiero: { c: "#0f766e", bg: "#ccfbf1", fg: "#115e59" },
  resto: { c: "#8a94a8", bg: "#eef1f5", fg: "#475467" },
};
const ramoStyle = (r?: string) => RAMO_STYLE[String(r || "").trim().toLowerCase()] || { c: "#8a94a8", bg: "#eef1f5", fg: "#475467" };
const ICONS: Record<string, string> = {
  gift: "M2.5 7h15v4h-15zM4 11v6.5h12V11M10 7v10.5M10 7C8 7 6 6 6 4.5S8.5 3 10 7c1.5-4 4-3.5 4-2.5S12 7 10 7",
  users: "M10 3.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM3 17c.8-3.2 3.7-5 7-5s6.2 1.8 7 5",
  ticket: "M2.5 7.5V5h15v2.5a2.5 2.5 0 000 5V15h-15v-2.5a2.5 2.5 0 000-5zM12 5v10",
  doc: "M5 2.5h7l3.5 3.5v11.5H5zM8 10h5M8 13.5h5",
  trophy: "M6 3h8v4a4 4 0 01-8 0zM10 11v3.5M6.5 17h7",
  chart: "M4 17V9M10 17V3M16 17v-5",
  clock: "M10 3a7 7 0 100 14 7 7 0 000-14zM10 6.5V10l2.5 1.5",
  trend: "M3 14l4.5-4.5 3 3L17 6M12.5 6H17v4.5",
};
const Icon = ({ n, size = 20, color = "currentColor" }: { n: string; size?: number; color?: string }) =>
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[n]} /></svg>;

const API = "/crm/sorteos";
const ROLL_MS = 3200;
const PAGE = 15;
const DAY = 864e5;
const fecha = (v?: string) => v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES") : "—";
const fechaInput = (v?: string) => v ? String(v).slice(0, 10) : "";
const errorText = (e: any) => e?.response?.data?.message || e?.message || "Ha ocurrido un error.";
const sum = (list: Participante[]) => list.reduce((n, p) => n + (Number(p.participaciones) || 0), 0);
const aleatorio = (max: number) => { const b = new Uint32Array(1); crypto.getRandomValues(b); return Math.floor(b[0] / 2 ** 32 * max); };
// Pólizas que el usuario quitó a mano de un sorteo: la sincronización automática no debe devolverlas.
const exclKey = (id: string) => `sorteo-excluidas-${id}`;
const leerExcluidas = (id: string): string[] => { try { return JSON.parse(localStorage.getItem(exclKey(id)) || "[]"); } catch { return []; } };
const guardarExcluidas = (id: string, list: string[]) => { try { localStorage.setItem(exclKey(id), JSON.stringify(Array.from(new Set(list)))); } catch { /* sin almacenamiento local */ } };
const iniciales = (s = "") => s.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase() || "—";
const estadoLabel: Record<Sorteo["estado"], string> = { CONFIGURACION: "En configuración", ABIERTO: "Abierto", REALIZADO: "Realizado" };
/** Todos los ramos disponibles: los del sorteo con lo que se configuró al crearlo y el resto a 0 para poder incorporarlos. */
const ramosParaEditar = (guardados: Ramo[]): Ramo[] => {
  const clave = (n?: string) => String(n || "").trim().toLowerCase();
  const conf = (r: Ramo): Ramo => { const n = Math.max(0, Number(r.participaciones) || 0); return { nombre: r.nombre, participaciones: n, activo: r.activo !== false && n > 0 }; };
  const base = RAMOS_DEFAULT.map(b => { const f = guardados.find(r => clave(r.nombre) === clave(b.nombre)); return f ? conf({ ...f, nombre: b.nombre }) : { ...b }; });
  const propios = guardados.filter(r => !RAMOS_DEFAULT.some(b => clave(b.nombre) === clave(r.nombre))).map(conf);
  return [...base, ...propios];
};
const emptyForm = () => ({
  nombre: "", descripcion: "", fechaInicio: "", fechaFin: "", imagenUrl: "",
  criterioFecha: "EFECTO" as "EFECTO" | "REGISTRO", ramos: RAMOS_DEFAULT.map(r => ({ ...r })),
});

function WinnerCard({ g, fechaSorteo, prueba }: { g: Ganador; fechaSorteo?: string; prueba?: boolean }) {
  const rs = ramoStyle(g.ramo);
  return <div className="sr-win">
    <span className="sr-win-icon"><Icon n="trophy" size={26} color="#9a6406" /></span>
    <div className="sr-win-main">
      <span className="sr-muted">{prueba ? "Ganador de la prueba" : "Ganador del sorteo"}</span>
      <strong>{g.tomador || "Ganador"}</strong>
      <div className="sr-row" style={{ gap: 8 }}>
        <span className="sr-muted">Póliza {g.numeroPoliza || "—"}</span>
        {g.ramo && <span className="sr-rm" style={{ background: rs.bg, color: rs.fg }}>{g.ramo}</span>}
      </div>
    </div>
    <div className="sr-win-date">{prueba
      ? <><span className="sr-muted">Modo</span><strong>Simulacro</strong></>
      : <><span className="sr-muted">Realizado el</span><strong>{fecha(fechaSorteo)}</strong></>}</div>
  </div>;
}

export default function Sorteos() {
  let usuario: any = null;
  try { usuario = JSON.parse(localStorage.getItem("user") || "null"); } catch { usuario = null; }
  const esAdmin = usuario?.role === "admin";
  const [view, setView] = useState<View>("overview");
  const [sorteos, setSorteos] = useState<Sorteo[]>([]);
  const [actual, setActual] = useState<Sorteo | null>(null);
  const [tab, setTab] = useState<Tab>("participantes");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  /* Ventana de mensajes reutilizable: sustituye a window.confirm / window.prompt. */
  type Dialogo = { titulo: string; texto?: string; ok: string; peligro?: boolean; campo?: { etiqueta: string; valor: string; placeholder?: string; obligatorio?: boolean }; resolver: (v: string | boolean | null) => void };
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [dialogoValor, setDialogoValor] = useState("");
  const [dialogoError, setDialogoError] = useState("");
  /** Confirmación (devuelve true/false) o entrada de texto (devuelve el texto o null si se cancela). */
  const preguntar = useCallback((o: Omit<Dialogo, "resolver">) => new Promise<string | boolean | null>(resolve => {
    setDialogoValor(o.campo?.valor ?? ""); setDialogoError(""); setDialogo({ ...o, resolver: resolve });
  }), []);
  const cerrarDialogo = (v: string | boolean | null) => { dialogo?.resolver(v); setDialogo(null); };
  const aceptarDialogo = () => {
    if (!dialogo) return;
    if (!dialogo.campo) { cerrarDialogo(true); return; }
    if (dialogo.campo.obligatorio && !dialogoValor.trim()) { setDialogoError("Este campo es obligatorio."); return; }
    cerrarDialogo(dialogoValor);
  };
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("TODOS");
  const [query, setQuery] = useState("");
  const [ramoFilter, setRamoFilter] = useState("TODOS");
  const [origenFilter, setOrigenFilter] = useState("TODOS");
  const [pagina, setPagina] = useState(0);
  const [form, setForm] = useState(emptyForm());
  const [nuevoRamo, setNuevoRamo] = useState("");
  const [buscandoVentas, setBuscandoVentas] = useState(false);
  const [resultadosVentas, setResultadosVentas] = useState<any[] | null>(null);
  const [manualNumber, setManualNumber] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [draw, setDraw] = useState<null | { phase: "roll" | "done"; name: string; prueba?: boolean; ganador?: Participante }>(null);

  const cargarLista = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(API);
      setSorteos(Array.isArray(data) ? data : data?.sorteos || []);
    } catch (e) { setNotice(errorText(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void cargarLista(); }, [cargarLista]);

  /* ===== Sincronización automática con las ventas =====
     - Al abrir el sorteo, cada minuto y ante cambios de ventas: importa las pólizas nuevas del periodo
       (las duplicadas se omiten) y retira las de ventas anuladas.
     - Por socket (eventos de ventasSocketHandlers): VENTA_ANULADA y VENTA_ELIMINADA retiran la póliza al instante;
       VENTA_ACTUALIZADA y VENTA_REHABILITADA lanzan una sincronización.
     - Las pólizas que el usuario quitó a mano no se vuelven a añadir; las añadidas a mano no se retiran. */
  const actualRef = useRef<Sorteo | null>(null);
  const ocupadoRef = useRef(false);
  const enCursoRef = useRef(false);
  const ultimaSync = useRef(0);
  const sincronizadoId = useRef("");
  useEffect(() => { actualRef.current = actual; }, [actual]);
  useEffect(() => { ocupadoRef.current = busy || !!draw; }, [busy, draw]);

  const leerSorteo = useCallback(async (id: string) => {
    const r = await api.get(`${API}/${id}`);
    const fresco = (r.data?.sorteo || r.data) as Sorteo;
    setActual(prev => prev && prev._id === id ? fresco : prev);
    return fresco;
  }, []);

  /** Pólizas de ventas ANULADAS dentro del periodo del sorteo (null si no se pudo consultar: entonces no se retira nada). */
  const anuladasDelPeriodo = useCallback(async (s: Sorteo) => {
    const ini = new Date(`${fechaInput(s.fechaInicio)}T12:00:00`);
    const fin = new Date(`${fechaInput(s.fechaFin)}T12:00:00`);
    if (isNaN(ini.getTime()) || isNaN(fin.getTime()) || fin < ini) return null;
    const meses: { month: number; year: number }[] = [];
    for (let d = new Date(ini.getFullYear(), ini.getMonth(), 1); d <= fin && meses.length < 24; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      meses.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }
    try {
      const modoFecha = s.criterioFecha === "REGISTRO" ? "venta" : "efecto";
      const respuestas = await Promise.all(meses.map(m => api.get("/ventas/libro", { params: { ...m, modoFecha } })));
      const anuladas = new Set<string>();
      respuestas.forEach(r => (Array.isArray(r.data?.ventas) ? r.data.ventas : []).forEach((v: any) => {
        if (v.anulada || v.estado === "ANULADA") anuladas.add(String(v.numeroPoliza));
      }));
      return anuladas;
    } catch { return null; }
  }, []);

  const sincronizar = useCallback(async (s: Sorteo) => {
    if (enCursoRef.current) return;
    enCursoRef.current = true;
    try {
      const { data } = await api.post(`${API}/${s._id}/importar`, {
        fechaInicio: fechaInput(s.fechaInicio), fechaFin: fechaInput(s.fechaFin), criterioFecha: s.criterioFecha,
      });
      const nuevas = Number(data?.importadas) || 0;
      const anuladas = await anuladasDelPeriodo(s);
      const base = await leerSorteo(s._id);
      const excl = new Set(leerExcluidas(s._id));
      const aQuitar = (base.participantes || []).filter(p =>
        excl.has(p.numeroPoliza) || (p.origen !== "MANUAL" && !!anuladas?.has(String(p.numeroPoliza))));
      if (!nuevas && !aQuitar.length) return;
      if (aQuitar.length) {
        await Promise.all(aQuitar.map(p => api.delete(`${API}/${s._id}/participantes/${p._id}`)));
        await leerSorteo(s._id);
      }
      const devueltas = aQuitar.filter(p => excl.has(p.numeroPoliza)).length;
      const retiradas = aQuitar.length - devueltas;
      const netas = Math.max(0, nuevas - devueltas);
      const partes: string[] = [];
      if (netas) partes.push(netas === 1 ? "Se ha añadido 1 póliza nueva." : `Se han añadido ${netas} pólizas nuevas.`);
      if (retiradas) partes.push(retiradas === 1 ? "Se ha retirado 1 póliza porque su venta está anulada." : `Se han retirado ${retiradas} pólizas porque sus ventas están anuladas.`);
      if (partes.length) setNotice(partes.join(" "));
      void cargarLista();
    } catch { /* silencioso: «Importar pólizas» sigue disponible como alternativa manual */ }
    finally { enCursoRef.current = false; }
  }, [anuladasDelPeriodo, cargarLista, leerSorteo]);

  /** Retira al instante la póliza de una venta anulada o eliminada (eventos VENTA_ANULADA / VENTA_ELIMINADA). */
  const alRetirarVenta = useCallback(async (ventaId: string, anulada: boolean) => {
    if (!ventaId || ocupadoRef.current) return;
    for (let i = 0; i < 6 && enCursoRef.current; i++) await new Promise(r => setTimeout(r, 1000)); // espera a que termine otra sincronización
    const s = actualRef.current; // se lee después de esperar: la sincronización pudo cambiar el listado
    if (!s || s.estado === "REALIZADO" || enCursoRef.current) return;
    enCursoRef.current = true;
    try {
      let lista = (s.participantes || []).filter(p => String(p.ventaId) === ventaId);
      if (!lista.length && anulada) {
        const { data } = await api.get(`/ventas/${ventaId}`);
        lista = (s.participantes || []).filter(p => p.origen !== "MANUAL" && p.numeroPoliza === data?.numeroPoliza);
      }
      if (!lista.length) return;
      await Promise.all(lista.map(p => api.delete(`${API}/${s._id}/participantes/${p._id}`)));
      await leerSorteo(s._id);
      setNotice(`${lista.length === 1 ? "Se ha retirado 1 póliza" : `Se han retirado ${lista.length} pólizas`} del sorteo: su venta se ha ${anulada ? "anulado" : "eliminado"}.`);
      void cargarLista();
    } catch { /* se corregirá en la próxima sincronización */ }
    finally { enCursoRef.current = false; }
  }, [cargarLista, leerSorteo]);

  // 1) Al abrir un sorteo no realizado.
  useEffect(() => {
    if (view !== "detail" || !esAdmin) { sincronizadoId.current = ""; return; }
    if (actual && actual.estado !== "REALIZADO" && sincronizadoId.current !== actual._id) {
      sincronizadoId.current = actual._id; ultimaSync.current = Date.now(); void sincronizar(actual);
    }
  }, [view, actual, sincronizar, esAdmin]);

  // 2) Con el sorteo abierto: eventos de ventas por socket, al volver a la pestaña y cada minuto
  //    (las altas de ventas no emiten evento en ventasSocketHandlers, así que se detectan con ese repaso).
  useEffect(() => {
    if (view !== "detail" || !esAdmin) return;
    const socket: any = getSocket();
    let t: number | undefined;
    const lanzar = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const s = actualRef.current;
        if (!s || s.estado === "REALIZADO" || ocupadoRef.current || document.visibilityState !== "visible" || Date.now() - ultimaSync.current < 5000) return;
        ultimaSync.current = Date.now(); void sincronizar(s);
      }, 1500);
    };
    const onAnulada = (d: any) => { void alRetirarVenta(d?.ventaId, true); };
    const onEliminada = (d: any) => { void alRetirarVenta(d?.ventaId, false); };
    socket?.on?.("VENTA_ACTUALIZADA", lanzar);
    socket?.on?.("VENTA_REHABILITADA", lanzar);
    socket?.on?.("VENTA_CREADA", lanzar); // opcional: solo actúa si el backend emite este evento al crear una venta
    socket?.on?.("VENTA_ANULADA", onAnulada);
    socket?.on?.("VENTA_ELIMINADA", onEliminada);
    const onVis = () => { if (document.visibilityState === "visible") lanzar(); };
    document.addEventListener("visibilitychange", onVis);
    const repaso = window.setInterval(lanzar, 60000);
    return () => {
      window.clearTimeout(t); window.clearInterval(repaso);
      socket?.off?.("VENTA_ACTUALIZADA", lanzar); socket?.off?.("VENTA_REHABILITADA", lanzar); socket?.off?.("VENTA_CREADA", lanzar);
      socket?.off?.("VENTA_ANULADA", onAnulada); socket?.off?.("VENTA_ELIMINADA", onEliminada);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [view, sincronizar, alRetirarVenta, esAdmin]);

  const abrirSorteo = async (id: string) => {
    setBusy(true); setNotice("");
    try {
      const { data } = await api.get(`${API}/${id}`);
      const s = data?.sorteo || data;
      setActual(s); setView("detail"); setTab("participantes");
      setForm({
        nombre: s.nombre || "", descripcion: s.descripcion || "",
        fechaInicio: fechaInput(s.fechaInicio), fechaFin: fechaInput(s.fechaFin), imagenUrl: s.imagenUrl || "",
        criterioFecha: s.criterioFecha || "EFECTO",
        ramos: ramosParaEditar(s.ramos || []),
      });
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  };
  const abrirDesdeLista = (id: string) => { setQuery(""); setRamoFilter("TODOS"); setOrigenFilter("TODOS"); setPagina(0); void abrirSorteo(id); };

  const nuevoSorteo = () => { setActual(null); setForm(emptyForm()); setView("create"); setNotice(""); };

  const importarVentas = (id: string) => api.post(`${API}/${id}/importar`, {
    fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, criterioFecha: form.criterioFecha,
  });
  const resumenImport = (d: any) => `${d?.importadas ?? 0} pólizas añadidas, ${d?.duplicadas ?? 0} duplicadas y ${d?.excluidas ?? 0} excluidas`;

  const guardar = async () => {
    if (!form.nombre.trim() || !form.fechaInicio || !form.fechaFin) { setNotice("Completa el nombre y el intervalo de fechas."); return; }
    if (form.fechaInicio > form.fechaFin) { setNotice("La fecha inicial no puede ser posterior a la final."); return; }
    const ramosActivos = form.ramos.filter(r => r.participaciones > 0).map(r => ({ nombre: r.nombre, participaciones: r.participaciones, activo: true }));
    if (!ramosActivos.length) { setNotice("Indica las participaciones de al menos un ramo (más de 0)."); return; }
    setBusy(true); setNotice("");
    const payload = { ...form, nombre: form.nombre.trim(), ramos: ramosActivos };
    try {
      if (actual?._id) {
        await api.put(`${API}/${actual._id}`, payload);
        await abrirSorteo(actual._id);
        setNotice("Cambios guardados.");
        return;
      }
      const { data } = await api.post(API, payload);
      const created = data?.sorteo || data;
      await cargarLista();
      if (!created?._id) { setView("overview"); setNotice("Sorteo creado, pero el servidor no devolvió su identificador."); return; }
      // Importa automáticamente las ventas del CRM dentro del intervalo elegido.
      try {
        const { data: imp } = await importarVentas(created._id);
        await abrirSorteo(created._id);
        setNotice(`Sorteo creado e importado: ${resumenImport(imp)}.`);
      } catch (importError) {
        await abrirSorteo(created._id);
        setNotice(`El sorteo se creó, pero falló la importación automática: ${errorText(importError)}. Reinténtala con «Importar pólizas».`);
      }
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  };

  const importar = async () => {
    if (!actual?._id) { setNotice("Guarda primero el sorteo."); return; }
    setBusy(true); setNotice("");
    try {
      const { data } = await importarVentas(actual._id);
      await abrirSorteo(actual._id); setImportOpen(false);
      setNotice(`Importación terminada: ${resumenImport(data)}.`);
      await cargarLista();
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  };

  const agregarManual = async (numero: string = manualNumber) => {
    const num = numero.trim();
    if (!actual?._id || !num) return;
    setBusy(true); setNotice("");
    try {
      await api.post(`${API}/${actual._id}/participantes`, { numeroPoliza: num });
      guardarExcluidas(actual._id, leerExcluidas(actual._id).filter(n => n !== num));
      setManualNumber(""); setResultadosVentas(prev => prev && prev.filter(v => String(v.numeroPoliza).trim() !== num));
      await abrirSorteo(actual._id); setNotice("Póliza añadida al sorteo."); await cargarLista();
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  };

  /** Busca en TODAS las ventas (cualquier mes) para poder añadir manualmente una póliza que no entró por fechas. */
  const buscarEnVentas = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setBuscandoVentas(true); setNotice("");
    try {
      const { data } = await api.get(`/ventas/buscar?q=${encodeURIComponent(q)}`);
      const ya = new Set((actual?.participantes || []).map(p => String(p.numeroPoliza).trim()));
      const lista = (Array.isArray(data) ? data : []).filter((v: any) => v?.numeroPoliza && !ya.has(String(v.numeroPoliza).trim()));
      setResultadosVentas(lista.slice(0, 20));
    } catch (e) { setNotice(errorText(e)); }
    finally { setBuscandoVentas(false); }
  };
  useEffect(() => { setResultadosVentas(null); }, [query]);

  /** Recalcula (ramo + 1 por cada 1.000 € de prima) las pólizas cuyo número no se haya fijado a mano. */
  const recalcular = async () => {
    if (!actual?._id) return;
    if (!(await preguntar({ titulo: "Recalcular participaciones", texto: "Se recalcularán según el ramo y la prima (1 extra por cada 1.000 €). Las pólizas con participaciones cambiadas a mano no se tocan.", ok: "Recalcular" }))) return;
    setBusy(true); setNotice("");
    try {
      const { data } = await api.post(`${API}/${actual._id}/recalcular`, {});
      await abrirSorteo(actual._id); setNotice(`Participaciones recalculadas: ${Number(data?.actualizadas) || 0} pólizas actualizadas.`); await cargarLista();
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  };

  const normal = (t?: string) => String(t ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  /** Participaciones que le corresponden por su ramo según la configuración del sorteo (para detectar las personalizadas). */
  const participacionesDeRamo = (p: Participante) => (actual?.ramos || []).find(r => r.activo !== false && normal(r.nombre) === normal(p.ramo))?.participaciones;

  const esPersonalizada = (p: Participante) => {
    if (p.participacionesPersonalizadas === true) return true;
    const base = participacionesDeRamo(p);
    return p.participacionesPersonalizadas === undefined && base !== undefined && Number(p.participaciones) !== base + (Number(p.participacionesExtra) || 0);
  };

  /** Cambia las participaciones de una póliza concreta (PATCH /:id/participantes/:participanteId). */
  const cambiarParticipaciones = async (p: Participante) => {
    if (!actual?._id) return;
    const base = participacionesDeRamo(p);
    const v = await preguntar({
      titulo: "Participaciones de esta póliza",
      texto: `${p.tomador || "Participante"} · póliza ${p.numeroPoliza}${base ? `. Por su ramo (${p.ramo}) le corresponden ${base}${p.participacionesExtra ? ` + ${p.participacionesExtra} por prima` : ""}.` : ""}`,
      ok: "Guardar", campo: { etiqueta: "Participaciones (1 a 1000)", valor: String(p.participaciones), obligatorio: true },
    });
    if (typeof v !== "string") return;
    const n = Number(v.trim());
    if (!Number.isInteger(n) || n < 1 || n > 1000) { setNotice("Indica un número entero de participaciones entre 1 y 1000."); return; }
    if (n === Number(p.participaciones)) return;
    setBusy(true); setNotice("");
    try {
      await api.patch(`${API}/${actual._id}/participantes/${p._id}`, { participaciones: n });
      await abrirSorteo(actual._id); setNotice(`Participaciones de la póliza ${p.numeroPoliza}: ${n}.`); await cargarLista();
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  };

  const quitar = async (p: Participante) => {
    if (!actual?._id || !(await preguntar({ titulo: "Quitar póliza", texto: `¿Quitar la póliza ${p.numeroPoliza} del sorteo?`, ok: "Quitar", peligro: true }))) return;
    setBusy(true);
    try {
      await api.delete(`${API}/${actual._id}/participantes/${p._id}`);
      guardarExcluidas(actual._id, [...leerExcluidas(actual._id), p.numeroPoliza]);
      await abrirSorteo(actual._id); setNotice("Participante eliminado."); await cargarLista();
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  };

  /** La animación es solo visual: el ganador real lo decide y registra el servidor. */
  const realizar = async () => {
    if (!actual?._id) return;
    const lista = actual.participantes || [];
    if (!lista.length) { setNotice("No hay participantes para realizar el sorteo."); return; }
    if (!(await preguntar({ titulo: "Realizar el sorteo", texto: "El resultado quedará registrado y no podrás modificar los participantes.", ok: "Realizar sorteo" }))) return;
    const nombres = Array.from(new Set(lista.map(p => p.tomador || p.numeroPoliza)));
    setBusy(true); setNotice("");
    setDraw({ phase: "roll", name: nombres[0] });
    const ticker = window.setInterval(() => setDraw(d => d && d.phase === "roll" ? { ...d, name: nombres[Math.floor(Math.random() * nombres.length)] } : d), 90);
    try {
      await Promise.all([api.post(`${API}/${actual._id}/realizar`, {}), new Promise(r => setTimeout(r, ROLL_MS))]);
      window.clearInterval(ticker);
      await abrirSorteo(actual._id); setTab("resultado"); await cargarLista();
      setDraw(d => d && { ...d, phase: "done" });
    } catch (e) { window.clearInterval(ticker); setDraw(null); setNotice(errorText(e)); }
    finally { setBusy(false); }
  };

  /** Repite el sorteo (POST /:id/repetir): exige un motivo, excluye a los ganadores anteriores y conserva todo el historial. */
  const repetir = async () => {
    if (!actual?._id) return;
    const motivo = await preguntar({ titulo: "Repetir el sorteo", texto: "Se sorteará de nuevo sin contar a los ganadores anteriores. El resultado anterior se conserva en el historial.", ok: "Repetir sorteo", campo: { etiqueta: "Motivo", valor: "", placeholder: "Ej.: el ganador no es localizable", obligatorio: true } });
    if (typeof motivo !== "string") return;
    setBusy(true); setNotice("");
    try {
      await api.post(`${API}/${actual._id}/repetir`, { motivo: motivo.trim() });
      await abrirSorteo(actual._id); setTab("resultado"); await cargarLista();
      setNotice("Sorteo repetido: el nuevo ganador es el resultado vigente y el anterior queda en el historial.");
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  };

  /** Elimina cualquier sorteo, también uno ya realizado (pide una confirmación más clara). */
  const eliminar = async (s: Sorteo | null = actual) => {
    if (!s?._id) return;
    const aviso = s.estado === "REALIZADO"
      ? `«${s.nombre}» ya se realizó: se borrará también su resultado y no se podrá recuperar. ¿Eliminarlo definitivamente?`
      : `¿Eliminar definitivamente «${s.nombre}»?`;
    if (!(await preguntar({ titulo: "Eliminar sorteo", texto: aviso, ok: "Eliminar", peligro: true }))) return;
    setBusy(true); setNotice("");
    try {
      await api.delete(`${API}/${s._id}`);
      if (actual?._id === s._id) { setActual(null); setView("overview"); }
      await cargarLista(); setNotice("Sorteo eliminado.");
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  };

  /** Sorteo de prueba: se calcula aquí, con el mismo reparto de participaciones, y no envía nada al servidor. */
  const probar = () => {
    const lista = participantes.filter(p => Number(p.participaciones) > 0);
    if (!lista.length) { setNotice("No hay participantes para hacer una prueba."); return; }
    const nombres = Array.from(new Set(lista.map(p => p.tomador || p.numeroPoliza)));
    let r = aleatorio(sum(lista));
    const g = lista.find(p => (r -= Number(p.participaciones)) < 0) || lista[0];
    setNotice(""); setDraw({ phase: "roll", name: nombres[0], prueba: true });
    const ticker = window.setInterval(() => setDraw(d => d && d.phase === "roll" ? { ...d, name: nombres[Math.floor(Math.random() * nombres.length)] } : d), 90);
    window.setTimeout(() => { window.clearInterval(ticker); setDraw({ phase: "done", name: g.tomador || g.numeroPoliza, prueba: true, ganador: g }); }, ROLL_MS);
  };

  const cambiarImagen = async () => {
    const value = await preguntar({ titulo: "Imagen del sorteo", texto: "Pega la URL de una imagen de internet (déjalo vacío para quitarla).", ok: "Aceptar", campo: { etiqueta: "URL de la imagen", valor: form.imagenUrl || "", placeholder: "https://…" } });
    if (typeof value !== "string") return;
    const url = value.trim();
    if (url && !/^https?:\/\//i.test(url)) { setNotice("Introduce una URL que empiece por http:// o https://."); return; }
    updateForm("imagenUrl", url);
    setNotice(url ? "Imagen seleccionada. Guarda los cambios para conservarla." : "Imagen eliminada. Guarda los cambios para aplicar el cambio.");
  };

  const participantes = useMemo(() => actual?.participantes || [], [actual]);
  const exportar = () => {
    if (!actual) return;
    const rows: (string | number)[][] = [["Póliza", "Tomador", "Ramo", "Aseguradora", "Fecha efecto", "Participaciones"],
      ...participantes.map(p => [p.numeroPoliza, p.tomador, p.ramo, p.aseguradora || "", fechaInput(p.fechaEfecto), p.participaciones])];
    const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${actual.nombre}-participantes.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const filteredSorteos = useMemo(() => sorteos.filter(s =>
    (filter === "TODOS" || s.estado === filter) &&
    `${s.nombre} ${s.descripcion || ""}`.toLowerCase().includes(search.toLowerCase())
  ), [sorteos, filter, search]);

  const filteredParticipantes = useMemo(() => participantes.filter(p =>
    (ramoFilter === "TODOS" || p.ramo?.toLowerCase() === ramoFilter.toLowerCase()) &&
    (origenFilter === "TODOS" || (origenFilter === "MANUAL") === (p.origen === "MANUAL")) &&
    `${p.numeroPoliza} ${p.tomador} ${p.ramo}`.toLowerCase().includes(query.toLowerCase())
  ), [participantes, ramoFilter, origenFilter, query]);
  const paginas = Math.max(1, Math.ceil(filteredParticipantes.length / PAGE));
  const paginaOk = Math.min(pagina, paginas - 1);
  const visibles = filteredParticipantes.slice(paginaOk * PAGE, (paginaOk + 1) * PAGE);

  const global = useMemo(() => {
    const all = sorteos.flatMap(s => s.participantes || []);
    const porRamo = new Map<string, number>();
    all.forEach(p => { const k = p.ramo || "Sin ramo"; porRamo.set(k, (porRamo.get(k) || 0) + (Number(p.participaciones) || 0)); });
    return {
      por: (e: Sorteo["estado"]) => sorteos.filter(s => s.estado === e).length,
      polizas: all.length, participaciones: sum(all),
      ramos: [...porRamo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [sorteos]);

  // Donut: participaciones por ramo del sorteo abierto.
  const donut = useMemo(() => {
    const m = new Map<string, number>();
    participantes.forEach(p => { const k = p.ramo || "Sin ramo"; m.set(k, (m.get(k) || 0) + (Number(p.participaciones) || 0)); });
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    const C = 2 * Math.PI * 40;
    let off = 0;
    const items = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => {
      const len = total ? value / total * C : 0;
      const it = { name, value, len, off, color: ramoStyle(name).c };
      off += len; return it;
    });
    return { total, C, items };
  }, [participantes]);

  // Barras: pólizas por tramo de fechas (semanas; tramos más largos si el periodo supera 8 semanas).
  const tramos = useMemo(() => {
    if (!actual) return { size: 7, bins: [] as { label: string; n: number }[] };
    const ini = new Date(`${fechaInput(actual.fechaInicio)}T12:00:00`);
    const fin = new Date(`${fechaInput(actual.fechaFin)}T12:00:00`);
    if (isNaN(ini.getTime()) || isNaN(fin.getTime()) || fin < ini) return { size: 7, bins: [] };
    const dias = Math.round((fin.getTime() - ini.getTime()) / DAY) + 1;
    const size = Math.max(7, Math.ceil(dias / 8 / 7) * 7);
    const bins = Array.from({ length: Math.ceil(dias / size) }, (_, i) => ({
      label: new Date(ini.getTime() + i * size * DAY).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }), n: 0,
    }));
    participantes.forEach(p => {
      const raw = actual.criterioFecha === "REGISTRO" ? p.fechaRegistro : p.fechaEfecto;
      if (!raw) return;
      const i = Math.floor((new Date(`${fechaInput(raw)}T12:00:00`).getTime() - ini.getTime()) / DAY / size);
      if (i >= 0 && i < bins.length) bins[i].n++;
    });
    return { size, bins };
  }, [actual, participantes]);

  const totalParticipaciones = sum(participantes);
  const totalPersonas = new Set(participantes.map(p => p.tomador?.trim().toLowerCase()).filter(Boolean)).size;
  const ganador = actual?.ganadores?.[actual.ganadores.length - 1]; // el último es el resultado vigente (las repeticiones se añaden al final)
  const historial = actual?.historialResultados || [];
  const locked = actual?.estado === "REALIZADO";
  const puedeEditar = esAdmin && !locked; // los empleados solo ven: ningún botón de gestión
  const pctOf = (p: Participante) => totalParticipaciones ? (Number(p.participaciones) || 0) / totalParticipaciones * 100 : 0;
  const maxPct = Math.max(0.0001, ...participantes.map(pctOf));
  const maxBin = Math.max(1, ...tramos.bins.map(b => b.n));
  const maxRamo = Math.max(1, ...global.ramos.map(r => r[1]));

  const updateForm = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const updateRamo = (nombre: string, patch: Partial<Ramo>) => setForm(prev => ({ ...prev, ramos: prev.ramos.map(r => r.nombre === nombre ? { ...r, ...patch } : r) }));

  const fijarRamo = (nombre: string, n: number) => { const v = Math.min(100, Math.max(0, Math.floor(n) || 0)); updateRamo(nombre, { participaciones: v, activo: v > 0 }); };
  const añadirRamo = () => {
    const nombre = nuevoRamo.trim(); if (!nombre) return;
    const existe = form.ramos.find(r => r.nombre.toLowerCase() === nombre.toLowerCase());
    if (existe) { if (existe.participaciones < 1) fijarRamo(existe.nombre, 1); }
    else setForm(prev => ({ ...prev, ramos: [...prev.ramos, { nombre, participaciones: 1, activo: true }] }));
    setNuevoRamo("");
  };
  const ramosEditor = (bloqueado: boolean) => <>
    <div className="sr-ramos">{form.ramos.map(r =>
      <div className={`sr-ramo ${r.participaciones > 0 ? "on" : ""}`} key={r.nombre}>
        <label><input type="checkbox" checked={r.participaciones > 0} disabled={bloqueado} onChange={e => fijarRamo(r.nombre, e.target.checked ? 1 : 0)} />{r.nombre}</label>
        <div className="sr-ramo-num"><input type="number" min={0} max={100} aria-label={`Participaciones de ${r.nombre}`} value={r.participaciones} disabled={bloqueado}
          onChange={e => fijarRamo(r.nombre, Number(e.target.value))} /><span>part.</span></div>
      </div>)}</div>
    {!bloqueado && <div className="sr-row" style={{ marginTop: 12 }}>
      <input className="sr-field" style={{ maxWidth: 260 }} placeholder="Añadir otro ramo…" value={nuevoRamo} onChange={e => setNuevoRamo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") añadirRamo(); }} />
      <button type="button" className="sr-btn" onClick={añadirRamo}>Añadir ramo</button>
      <span className="sr-section-note">Con 0 participaciones el ramo no entra en el sorteo. Además, cada póliza recibe 1 participación extra por cada 1.000 € de prima.</span>
    </div>}
  </>;

  const estadoBars: [string, number, string][] = [
    ["Abiertos", global.por("ABIERTO"), "#0b7a5a"], ["Realizados", global.por("REALIZADO"), "#6a4fd0"], ["En configuración", global.por("CONFIGURACION"), "#9aa6b8"],
  ];
  const kpis: [string, string, string | number, string, string][] = [
    ["users", "Participantes", totalPersonas, "personas distintas", "#2f5bd3"],
    ["ticket", "Participaciones", totalParticipaciones, "boletos en el bombo", "#6a4fd0"],
    ["doc", "Pólizas incluidas", participantes.length, "importadas y manuales", "#0b7a5a"],
    ["trophy", "Ganador", locked ? (ganador?.tomador || "Registrado") : "Pendiente", locked ? `el ${fecha(actual?.fechaRealizacion)}` : "se decide al sortear", "#9a6406"],
  ];

  // Solo el administrador puede ver, crear, modificar y realizar sorteos (o simulacros). El backend debe exigirlo también.
  return <div className="sorteos-page">
    <style>{`
.sorteos-page{--ink:#1d2433;--muted:#5b6679;--line:#e1e5ee;--canvas:#f1f3f8;--primary:#2f5bd3;--primary-soft:#e6ecff;color:var(--ink);background:var(--canvas);min-height:100%;padding:26px 32px 44px;font-family:inherit;font-size:14px;font-variant-numeric:tabular-nums}
.sorteos-page *{box-sizing:border-box}
.sorteos-page :focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.sr-muted{color:var(--muted)}
.sr-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.sr-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px}
.sr-kicker{font-size:12px;color:var(--muted);font-weight:600}
.sr-title{font-size:28px;font-weight:800;letter-spacing:-.03em;margin:4px 0}
.sr-subtitle{color:var(--muted);font-size:13px;max-width:60ch}
.sr-btn{font:inherit;font-size:13px;font-weight:700;border:1px solid #d3d9e4;background:#fff;color:var(--ink);border-radius:9px;height:38px;padding:0 15px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .15s,border-color .15s}
.sr-btn:hover{background:#f7f8fc;border-color:#bfc8da}
.sr-btn.primary{background:var(--primary);border-color:var(--primary);color:#fff}
.sr-btn.primary:hover{background:#2548b3}
.sr-btn.danger{color:#b3263a}
.sr-btn:disabled{opacity:.5;cursor:not-allowed}
.sr-panel{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 2px 6px #14213d0d}
.sr-alert{padding:12px 15px;border-radius:10px;background:#fff8e6;border:1px solid #f1dca4;color:#7a5612;font-size:13px;margin:0 0 16px}
.sr-back{border:0;background:none;color:var(--muted);padding:0 0 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.sr-back:hover{color:var(--ink)}

/* Vista general */
.sr-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:22px}
.sr-stat{padding:16px 20px;display:flex;align-items:center;gap:14px}
.sr-ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;flex:none;color:var(--tone);background:color-mix(in srgb,var(--tone) 13%,#fff)}
.sr-stat-label{font-size:12.5px;color:var(--muted);margin-bottom:3px}
.sr-stat-value{font-size:26px;line-height:1.1;font-weight:800;letter-spacing:-.03em}
.sr-analytics{margin-bottom:22px}
.sr-section-title{font-size:15px;font-weight:700;margin:0}
.sr-section-note{font-size:12.5px;color:var(--muted);margin-top:4px}
.sr-analytics-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:12px}
.sr-chart-card{padding:20px 22px}
.sr-chart-title{font-size:14.5px;font-weight:700;margin:0 0 16px}
.sr-bars{display:grid;gap:13px}
.sr-bar-label{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);margin-bottom:6px}
.sr-bar-label strong{color:var(--ink)}
.sr-bar-track{height:7px;background:#edf1f6;border-radius:99px;overflow:hidden}
.sr-bar-fill{height:100%;border-radius:99px;background:var(--primary);transition:width .4s}
.sr-chart-empty{font-size:13px;color:var(--muted);padding:26px 0;text-align:center}

/* Tablas y filtros */
.sr-toolbar,.sr-tool{padding:16px 22px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sr-toolbar{justify-content:space-between;border-bottom:1px solid var(--line)}
.sr-search{position:relative;max-width:300px;flex:1;min-width:200px}
.sr-search:before{content:"⌕";position:absolute;left:12px;top:5px;color:#8a94a8;font-size:21px}
.sr-search input,.sr-field,.sr-select{width:100%;height:38px;border:1px solid #d3d9e4;background:#fff;border-radius:9px;padding:0 12px;font:inherit;font-size:13px;color:var(--ink);outline:none}
.sr-search input{padding-left:34px}
.sr-field:focus,.sr-select:focus,.sr-search input:focus{border-color:#8fa5ea;box-shadow:0 0 0 3px var(--primary-soft)}
.sr-field:disabled{background:#f6f8fb;color:var(--muted)}
.sr-select{width:auto;min-width:150px;font-weight:600}
.sr-grow{flex:1}
.sr-table-wrap{overflow:auto}
.sr-table{width:100%;border-collapse:collapse;min-width:760px}
.sr-table th{text-align:left;font-size:12px;font-weight:700;color:var(--muted);padding:10px 22px;background:#f6f8fb;border-top:1px solid var(--line);border-bottom:1px solid var(--line);white-space:nowrap}
.sr-table td{padding:12px 22px;border-bottom:1px solid #edf0f5;font-size:13px;vertical-align:middle}
.sr-table tbody tr:hover td{background:#f8f9fe}
.sr-table .r{text-align:right}
.sr-name{font-weight:700}
.sr-desc{font-size:12px;color:var(--muted);margin-top:3px;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sr-status{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:4px 11px;font-size:12px;font-weight:700;white-space:nowrap}
.sr-status:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.st-CONFIGURACION{color:#5b6779;background:#eef1f5}.st-ABIERTO{color:#0b6b50;background:#dff3ea}.st-REALIZADO{color:#5a3fc0;background:#efeafd}
.sr-open{border:0;background:none;color:var(--primary);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.sr-open:hover{text-decoration:underline}
.sr-empty{padding:52px 20px;text-align:center;color:var(--muted)}
.sr-empty-icon{width:54px;height:54px;margin:0 auto 14px;border-radius:16px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center}
.sr-empty strong{display:block;color:var(--ink);font-size:15px;margin-bottom:5px}
.sr-who{display:flex;align-items:center;gap:12px}.sr-who b{display:block}.sr-who small{color:var(--muted);font-size:12px}
.sr-av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:12.5px;flex:none}
.sr-rm{font-size:12px;font-weight:700;border-radius:99px;padding:4px 11px;white-space:nowrap}
.sr-pr{display:inline-flex;align-items:center;gap:8px;font-weight:600}
.sr-pr s{display:block;width:64px;height:6px;border-radius:3px;background:#e8ecf4;text-decoration:none}
.sr-pr s i{display:block;height:6px;border-radius:3px;background:var(--primary)}
.sr-org{font-size:12.5px;color:var(--muted)}
.sr-q{font:inherit;font-size:12.5px;font-weight:700;color:#b3263a;background:none;border:0;cursor:pointer}
.sr-q:disabled{opacity:.5;cursor:not-allowed}
.sr-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 22px;font-size:13px;color:var(--muted);flex-wrap:wrap}

/* Ficha del sorteo */
.sr-ban{padding:20px 24px;display:flex;align-items:center;gap:18px;margin-bottom:16px;flex-wrap:wrap}
.sr-tile{position:relative;overflow:hidden;width:68px;height:68px;flex:none;padding:0;border:0;border-radius:16px;background:var(--primary-soft);display:grid;place-items:center;cursor:pointer}
.sr-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.sr-tile-hint{position:absolute;inset:auto 0 0;padding:3px;background:#14213dcc;color:#fff;font-size:10.5px;font-weight:600;opacity:0;transition:opacity .15s}
.sr-tile:hover .sr-tile-hint,.sr-tile:focus-visible .sr-tile-hint{opacity:1}
.sr-ban-main{flex:1;min-width:240px}
.sr-detail-title{font-size:25px;font-weight:800;letter-spacing:-.03em;margin:0;overflow-wrap:anywhere}
.sr-sub{color:var(--muted);font-size:13px;margin-top:6px}
.sr-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:16px}
.sr-kpi{padding:18px 20px;display:flex;align-items:center;gap:14px;min-width:0}
.sr-kpi small{color:var(--muted);font-size:12.5px}
.sr-kpi b{display:block;font-size:26px;letter-spacing:-.03em;line-height:1.15}
.sr-kpi b.sm{font-size:17px;line-height:1.5;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sr-kpi em{font-style:normal;font-size:12px;color:var(--muted)}
.sr-g3{display:grid;grid-template-columns:1.2fr 1.2fr .9fr;gap:16px;margin-bottom:16px}
.sr-donut{display:flex;align-items:center;gap:22px}
.sr-leg{display:grid;gap:7px;font-size:12.5px;flex:1;min-width:0}
.sr-leg div{display:flex;align-items:center;gap:8px}.sr-leg i{width:9px;height:9px;border-radius:3px;flex:none}.sr-leg b{margin-left:auto}
.sr-cbars{display:flex;align-items:flex-end;gap:12px;height:130px}
.sr-cbars div{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;font-size:12px;color:var(--muted)}
.sr-cbars i{display:block;width:100%;border-radius:7px 7px 0 0;background:#9db3f0}.sr-cbars i.top{background:var(--primary)}
.sr-cta{background:var(--primary);border-color:var(--primary);color:#fff;padding:22px;display:flex;flex-direction:column;gap:10px}
.sr-cta h2{margin:0;font-size:18px;font-weight:800;letter-spacing:-.02em}
.sr-cta p{margin:0;font-size:13px;line-height:1.5;color:#e3e9ff}
.sr-cta-actions{margin-top:auto;display:grid;gap:8px}
.sr-cta .sr-btn{background:#fff;color:#1d3a99;border-color:#fff;justify-content:center}
.sr-cta .sr-btn:hover{background:#eef2ff}
.sr-cta .sr-btn.ghost{background:transparent;color:#fff;border-color:#ffffff80}
.sr-cta .sr-btn.ghost:hover{background:#ffffff1f}
.sr-tabs{display:flex;gap:24px;padding:0 22px;border-bottom:1px solid var(--line);overflow:auto}
.sr-tab{border:0;background:transparent;color:var(--muted);padding:15px 0 12px;font:inherit;font-weight:700;font-size:13.5px;white-space:nowrap;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.sr-tab:hover{color:var(--ink)}
.sr-tab.active{color:var(--primary);border-bottom-color:var(--primary)}
.sr-content{padding:22px}
.sr-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap}

/* Formularios */
.sr-grid,.sr-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.sr-full{grid-column:1/-1}
.sr-label{display:block;font-size:12px;font-weight:700;color:#41506b;margin-bottom:6px}
.sr-form-card{padding:22px;margin-bottom:16px}
.sr-form-title{font-size:15px;font-weight:700;margin:0 0 16px}
.sr-ramos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.sr-ramo{border:1px solid var(--line);border-radius:10px;padding:10px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fafbfd}
.sr-ramo.on{background:var(--primary-soft);border-color:#c5d1f7}
.sr-ramo label{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:650}
.sr-ramo-num{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.sr-ramo-num input{width:62px;height:32px;border:1px solid var(--line);border-radius:7px;text-align:center;font:inherit}
.sr-actions{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:18px;flex-wrap:wrap}
.sr-audit{margin-top:18px;border:1px solid var(--line);border-radius:12px;padding:18px}

/* Ganador */
.sr-win{display:flex;align-items:center;gap:18px;padding:20px 24px;border:1px solid var(--line);border-radius:14px;background:#fff;text-align:left;width:100%}
.sr-win-icon{width:52px;height:52px;border-radius:14px;background:#fdf0d8;display:grid;place-items:center;flex:none}
.sr-win-main{flex:1;min-width:0;display:grid;gap:4px;font-size:13px}
.sr-win-main strong{font-size:22px;letter-spacing:-.02em;overflow-wrap:anywhere}
.sr-win-date{display:grid;gap:4px;text-align:right;font-size:12.5px}.sr-win-date strong{font-size:15px}

/* Sorteo en curso */
.sr-draw{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:#14213d99;backdrop-filter:blur(4px)}
.sr-modal{width:min(560px,100%);background:#fff;border-radius:16px;padding:28px;display:grid;gap:18px;justify-items:stretch;text-align:center;box-shadow:0 24px 60px #14213d4d}
.sr-modal h2{margin:0;font-size:18px;font-weight:800}
.sr-modal p{margin:0;color:var(--muted);font-size:13px}
.sr-roller{padding:30px 18px;border-radius:12px;background:var(--primary-soft);color:#1d3a99;font-size:clamp(22px,4.5vw,32px);font-weight:800;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sr-modal .sr-btn{justify-content:center}

@media(max-width:1100px){.sr-g3{grid-template-columns:1fr 1fr}.sr-cta{grid-column:1/-1}}
@media(max-width:900px){.sr-kpis,.sr-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.sr-analytics-grid,.sr-g3{grid-template-columns:1fr}}
@media(max-width:650px){.sorteos-page{padding:18px 13px 36px}.sr-head{align-items:flex-start;flex-direction:column}.sr-head .sr-btn{width:100%;justify-content:center}.sr-kpis,.sr-stats{grid-template-columns:1fr}.sr-form-grid,.sr-grid,.sr-ramos{grid-template-columns:1fr}.sr-actions{align-items:stretch;flex-direction:column}.sr-actions .sr-btn{justify-content:center}.sr-content,.sr-tool,.sr-toolbar{padding:15px}.sr-donut{flex-direction:column;align-items:flex-start}.sr-win{flex-wrap:wrap}.sr-win-date{text-align:left}.sr-detail-title{font-size:21px}}
    `}</style>

    {notice && <div className="sr-alert" role="status">{notice}</div>}

    {view === "overview" && <>
      <header className="sr-head">
        <div><div className="sr-kicker">Gestión comercial</div><h1 className="sr-title">Sorteos</h1><div className="sr-subtitle">{esAdmin ? "Crea convocatorias, revisa quién participa y registra el resultado desde un único lugar." : "Consulta los sorteos, quién participa en ellos y su resultado."}</div></div>
        {esAdmin && <button className="sr-btn primary" onClick={nuevoSorteo}>＋ Crear sorteo</button>}
      </header>
      <section className="sr-analytics">
        <h2 className="sr-section-title">Rendimiento de los sorteos</h2><div className="sr-section-note">Calculado con los sorteos cargados en el CRM.</div>
        <div className="sr-analytics-grid">
          <div className="sr-panel sr-chart-card"><h3 className="sr-chart-title">Estado de las convocatorias</h3><div className="sr-bars">
            {estadoBars.map(([label, value, color]) => <div key={label}>
              <div className="sr-bar-label"><span>{label}</span><strong>{value}</strong></div>
              <div className="sr-bar-track"><div className="sr-bar-fill" style={{ width: `${sorteos.length ? value / sorteos.length * 100 : 0}%`, background: color }} /></div>
            </div>)}</div></div>
          <div className="sr-panel sr-chart-card"><h3 className="sr-chart-title">Participaciones por ramo</h3>
            {global.ramos.length ? <div className="sr-bars">{global.ramos.map(([name, value]) => <div key={name}>
              <div className="sr-bar-label"><span>{name}</span><strong>{value}</strong></div>
              <div className="sr-bar-track"><div className="sr-bar-fill" style={{ width: `${value / maxRamo * 100}%`, background: ramoStyle(name).c }} /></div>
            </div>)}</div> : <div className="sr-chart-empty">Aún no hay participaciones. Importa pólizas en un sorteo para ver el reparto.</div>}
          </div>
        </div>
      </section>
      <section className="sr-panel">
        <div className="sr-toolbar">
          <div className="sr-search"><input aria-label="Buscar sorteos" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar sorteos..." /></div>
          <select aria-label="Filtrar por estado" className="sr-select" value={filter} onChange={e => setFilter(e.target.value)}><option value="TODOS">Todos los estados</option><option value="CONFIGURACION">En configuración</option><option value="ABIERTO">Abiertos</option><option value="REALIZADO">Realizados</option></select>
        </div>
        {loading ? <div className="sr-empty">Cargando sorteos…</div> : filteredSorteos.length === 0 ? <div className="sr-empty"><div className="sr-empty-icon"><Icon n="gift" size={26} /></div><strong>{sorteos.length ? "Ningún sorteo coincide con la búsqueda" : "Todavía no hay sorteos"}</strong><span>{sorteos.length ? "Prueba con otro nombre o estado." : (esAdmin ? "Crea el primero para importar pólizas y sortear entre tus clientes." : "Cuando el administrador cree un sorteo, aparecerá aquí.")}</span>{!sorteos.length && esAdmin && <div style={{ marginTop: 16 }}><button className="sr-btn primary" onClick={nuevoSorteo}>＋ Crear primer sorteo</button></div>}</div> :
          <div className="sr-table-wrap"><table className="sr-table"><thead><tr><th>Sorteo</th><th>Periodo</th><th>Participantes</th><th>Participaciones</th><th>Estado</th><th /></tr></thead><tbody>{filteredSorteos.map(s =>
            <tr key={s._id}><td><div className="sr-name">{s.nombre}</div><div className="sr-desc">{s.descripcion || "Sin descripción"}</div></td><td>{fecha(s.fechaInicio)} – {fecha(s.fechaFin)}</td><td>{s.participantes?.length || 0}</td><td>{sum(s.participantes || [])}</td><td><span className={`sr-status st-${s.estado}`}>{estadoLabel[s.estado] || s.estado}</span></td><td style={{ textAlign: "right", whiteSpace: "nowrap" }}><button className="sr-open" onClick={() => abrirDesdeLista(s._id)}>Abrir</button>{esAdmin && <button className="sr-q" style={{ marginLeft: 16 }} disabled={busy} onClick={() => void eliminar(s)}>Eliminar</button>}</td></tr>)}</tbody></table></div>}
      </section>
    </>}

    {view === "create" && <>
      <button className="sr-back" onClick={() => setView("overview")}>← Volver a sorteos</button>
      <header className="sr-head"><div><div className="sr-kicker">Nueva convocatoria</div><h1 className="sr-title">Crear sorteo</h1><div className="sr-subtitle">Define el periodo y las reglas. Al guardar, importaremos las pólizas del periodo automáticamente.</div></div></header>
      <section className="sr-panel sr-form-card"><h2 className="sr-form-title">Información general</h2><div className="sr-form-grid">
        <div className="sr-full"><label className="sr-label">Nombre del sorteo *</label><input className="sr-field" value={form.nombre} onChange={e => updateForm("nombre", e.target.value)} placeholder="Ej. Sorteo de noviembre" /></div>
        <div className="sr-full"><label className="sr-label">Descripción <span className="sr-muted">(opcional)</span></label><input className="sr-field" value={form.descripcion} onChange={e => updateForm("descripcion", e.target.value)} placeholder="Añade una breve descripción" /></div>
        <div><label className="sr-label">Fecha desde *</label><input type="date" className="sr-field" value={form.fechaInicio} onChange={e => updateForm("fechaInicio", e.target.value)} /></div>
        <div><label className="sr-label">Fecha hasta *</label><input type="date" className="sr-field" value={form.fechaFin} onChange={e => updateForm("fechaFin", e.target.value)} /></div>
        <div className="sr-full"><label className="sr-label">Criterio para seleccionar pólizas</label><select className="sr-field" value={form.criterioFecha} onChange={e => updateForm("criterioFecha", e.target.value)}><option value="EFECTO">Fecha de efecto</option><option value="REGISTRO">Fecha de registro</option></select></div>
      </div></section>
      <section className="sr-panel sr-form-card"><h2 className="sr-form-title">Participaciones por ramo</h2><p className="sr-section-note" style={{ marginTop: -8, marginBottom: 14 }}>Activa los ramos que entran en el sorteo y define cuántas participaciones aporta cada póliza.</p>{ramosEditor(false)}</section>
      <div className="sr-actions"><button className="sr-btn" onClick={() => setView("overview")}>Cancelar</button><button className="sr-btn primary" disabled={busy} onClick={() => void guardar()}>{busy ? "Guardando…" : "Guardar y continuar"}</button></div>
    </>}

    {view === "detail" && actual && <div>
      <button className="sr-back" onClick={() => { setView("overview"); setNotice(""); }}>← Todos los sorteos</button>
      <div className="sr-panel sr-ban">
        <button type="button" className="sr-tile" disabled={!esAdmin} style={esAdmin ? undefined : { cursor: "default" }} onClick={cambiarImagen} aria-label={esAdmin ? "Cambiar imagen del sorteo" : "Imagen del sorteo"}>
          {form.imagenUrl ? <img src={form.imagenUrl} alt={`Imagen de ${actual.nombre}`} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : <Icon n="gift" size={34} color="#2f5bd3" />}
          {esAdmin && <span className="sr-tile-hint">Cambiar imagen</span>}
        </button>
        <div className="sr-ban-main">
          <div className="sr-row" style={{ gap: 12 }}><h1 className="sr-detail-title">{actual.nombre}</h1><span className={`sr-status st-${actual.estado}`}>{estadoLabel[actual.estado]}</span></div>
          <div className="sr-sub">Del {fecha(actual.fechaInicio)} al {fecha(actual.fechaFin)} · Pólizas por {actual.criterioFecha === "EFECTO" ? "fecha de efecto" : "fecha de registro"} · Creado el {fecha(actual.createdAt)}</div>
          {actual.descripcion && <div className="sr-sub" style={{ marginTop: 3 }}>{actual.descripcion}</div>}
          {puedeEditar && <div className="sr-sub" style={{ marginTop: 3 }}>Las pólizas nuevas del periodo se añaden solas, sin importarlas a mano.</div>}
        </div>
        <div className="sr-row" style={{ gap: 8 }}>
          {puedeEditar && <button className="sr-btn" onClick={() => setImportOpen(v => !v)}>Importar pólizas</button>}
          <button className="sr-btn" onClick={() => setTab("configuracion")}>Configuración</button>
        </div>
      </div>

      {importOpen && puedeEditar && <section className="sr-panel sr-form-card"><div className="sr-section-head"><div><h2 className="sr-section-title">Importar pólizas desde ventas</h2><div className="sr-section-note">Se añaden las pólizas activas que cumplan el criterio. Las duplicadas se omiten.</div></div><button className="sr-btn" onClick={() => setImportOpen(false)}>Cerrar</button></div>
        <div className="sr-form-grid"><div><label className="sr-label">Fecha desde</label><input type="date" className="sr-field" value={form.fechaInicio} onChange={e => updateForm("fechaInicio", e.target.value)} /></div><div><label className="sr-label">Fecha hasta</label><input type="date" className="sr-field" value={form.fechaFin} onChange={e => updateForm("fechaFin", e.target.value)} /></div>
          <div className="sr-full"><label className="sr-label">Criterio</label><select className="sr-field" value={form.criterioFecha} onChange={e => updateForm("criterioFecha", e.target.value)}><option value="EFECTO">Fecha de efecto</option><option value="REGISTRO">Fecha de registro</option></select></div></div>
        <div className="sr-actions"><span className="sr-muted" style={{ fontSize: 12 }}>Las fechas se aplican solo a esta importación.</span><button className="sr-btn primary" disabled={busy} onClick={() => void importar()}>{busy ? "Importando…" : "Iniciar importación"}</button></div></section>}

      <div className="sr-kpis">{kpis.map(([icon, label, value, nota, tone]) =>
        <div className="sr-panel sr-kpi" key={label}><span className="sr-ic" style={{ "--tone": tone } as CSSProperties}><Icon n={icon} size={22} /></span>
          <div style={{ minWidth: 0 }}><small>{label}</small><b className={typeof value === "string" ? "sm" : ""}>{value}</b><em>{nota}</em></div></div>)}
      </div>

      <div className="sr-g3">
        <div className="sr-panel sr-chart-card"><h2 className="sr-chart-title">Participaciones por ramo</h2>
          {donut.total ? <div className="sr-donut">
            <svg width="124" height="124" viewBox="0 0 100 100" fill="none" strokeWidth={14} style={{ flex: "none" }} role="img" aria-label="Reparto de participaciones por ramo">
              <circle cx="50" cy="50" r="40" stroke="#edf1f6" />
              <g transform="rotate(-90 50 50)">{donut.items.map(it => <circle key={it.name} cx="50" cy="50" r="40" stroke={it.color} strokeDasharray={`${it.len} ${donut.C}`} strokeDashoffset={-it.off} />)}</g>
              <text x="50" y="55" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1d2433" stroke="none">{donut.total}</text>
            </svg>
            <div className="sr-leg">{donut.items.map(it => <div key={it.name}><i style={{ background: it.color }} />{it.name}<b>{it.value}</b></div>)}</div>
          </div> : <div className="sr-chart-empty">Importa pólizas para ver el reparto por ramo.</div>}
        </div>
        <div className="sr-panel sr-chart-card"><h2 className="sr-chart-title">Pólizas por {tramos.size === 7 ? "semana" : "tramo"} de {actual.criterioFecha === "EFECTO" ? "efecto" : "registro"}</h2>
          {participantes.length && tramos.bins.length ? <div className="sr-cbars">{tramos.bins.map(b =>
            <div key={b.label}><span>{b.n}</span><i className={b.n === maxBin ? "top" : ""} style={{ height: b.n ? Math.max(4, Math.round(b.n / maxBin * 76)) : 2 }} />{b.label}</div>)}</div>
            : <div className="sr-chart-empty">Aún no hay pólizas en el periodo.</div>}
        </div>
        {locked
          ? <div className="sr-panel sr-cta"><h2>Sorteo realizado</h2><p>{ganador?.tomador ? `Ganador: ${ganador.tomador}. ` : ""}El resultado quedó registrado el {fecha(actual.fechaRealizacion)} con su huella de auditoría.</p><div className="sr-cta-actions"><button className="sr-btn" onClick={() => setTab("resultado")}>Ver resultado</button></div></div>
          : !esAdmin ? <div className="sr-panel sr-cta"><h2>Sorteo pendiente</h2><p>{participantes.length} pólizas y {totalParticipaciones} participaciones. El sorteo lo realiza el administrador.</p></div> : <div className="sr-panel sr-cta"><h2>{participantes.length ? "Todo listo para sortear" : "Aún no se puede sortear"}</h2>
            <p>{participantes.length ? `${participantes.length} pólizas y ${totalParticipaciones} participaciones. Al sortear se cierra el listado y el resultado queda guardado con su huella de auditoría.` : "Importa las pólizas del periodo o añade alguna manualmente para poder sortear."}</p>
            <div className="sr-cta-actions"><button className="sr-btn" disabled={busy || !participantes.length} onClick={() => void realizar()}>Realizar sorteo</button><button className="sr-btn ghost" disabled={busy || !participantes.length} onClick={probar}>Hacer sorteo de prueba</button></div></div>}
      </div>

      <section className="sr-panel">
        <div className="sr-tabs" role="tablist">{([["participantes", "Participantes"], ["resultado", "Resultado e historial"], ["configuracion", "Configuración"]] as [Tab, string][]).map(([k, label]) =>
          <button key={k} role="tab" aria-selected={tab === k} className={`sr-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{label}</button>)}</div>

        {tab === "participantes" && <>
          <div className="sr-tool">
            <div className="sr-search"><input aria-label="Buscar participante" value={query} onChange={e => { setQuery(e.target.value); setPagina(0); }} placeholder="Buscar tomador o póliza" /></div>
            <select aria-label="Filtrar por ramo" className="sr-select" value={ramoFilter} onChange={e => { setRamoFilter(e.target.value); setPagina(0); }}><option value="TODOS">Ramo: todos</option>{Array.from(new Set(participantes.map(p => p.ramo))).filter(Boolean).map(r => <option key={r} value={r}>{r}</option>)}</select>
            <select aria-label="Filtrar por origen" className="sr-select" value={origenFilter} onChange={e => { setOrigenFilter(e.target.value); setPagina(0); }}><option value="TODOS">Origen: todos</option><option value="IMPORTACION">Importación</option><option value="MANUAL">Manual</option></select>
            <span className="sr-grow" />
            {puedeEditar && <><input className="sr-field" style={{ width: 170 }} aria-label="Número de póliza" value={manualNumber} onChange={e => setManualNumber(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void agregarManual(); }} placeholder="Nº de póliza" /><button className="sr-btn" disabled={busy || !manualNumber.trim()} onClick={() => void agregarManual()}>Añadir póliza</button></>}
            {puedeEditar && <button className="sr-btn" disabled={busy || !participantes.length} onClick={() => void recalcular()}>Recalcular</button>}<button className="sr-btn" disabled={!participantes.length} onClick={exportar}>Exportar CSV</button>
          </div>
          {filteredParticipantes.length === 0 ? <div className="sr-empty"><div className="sr-empty-icon"><Icon n="users" size={26} /></div><strong>{participantes.length ? "Ningún participante coincide" : "Aún no hay participantes"}</strong><span>{participantes.length ? "Cambia los filtros de búsqueda." : "Importa las pólizas del periodo o añade una por su número."}</span></div> :
            <div className="sr-table-wrap"><table className="sr-table"><thead><tr><th>Tomador</th><th>Ramo</th><th>Fecha efecto</th><th className="r">Part.</th><th>Probabilidad</th><th>Origen</th>{puedeEditar && <th />}</tr></thead><tbody>{visibles.map(p => {
              const rs = ramoStyle(p.ramo); const pc = pctOf(p);
              return <tr key={p._id}>
                <td><div className="sr-who"><span className="sr-av" style={{ background: rs.bg, color: rs.fg }}>{iniciales(p.tomador)}</span><div><b>{p.tomador || "—"}</b><small>{p.numeroPoliza}</small></div></div></td>
                <td>{p.ramo ? <span className="sr-rm" style={{ background: rs.bg, color: rs.fg }}>{p.ramo}</span> : "—"}</td>
                <td>{fecha(p.fechaEfecto)}</td><td className="r"><b>{p.participaciones}</b>{Number(p.participacionesExtra) > 0 && <small title={`${Number(p.participaciones) - Number(p.participacionesExtra)} por ramo + ${p.participacionesExtra} por prima (${Math.round(Number(p.primaNeta) || 0)} €)`} style={{ display: "block", color: "#586174" }}>+{p.participacionesExtra} por prima</small>}{esPersonalizada(p) && <small title={`Por su ramo le corresponden ${participacionesDeRamo(p)}${p.participacionesExtra ? ` + ${p.participacionesExtra} por prima` : ""}`} style={{ display: "block", color: "#9a6406", fontWeight: 700 }}>personalizada</small>}{puedeEditar && <button className="sr-q" style={{ marginLeft: 6 }} disabled={busy} title="Cambiar participaciones de esta póliza" aria-label={`Cambiar participaciones de ${p.numeroPoliza}`} onClick={() => void cambiarParticipaciones(p)}>✎</button>}</td>
                <td><span className="sr-pr"><s><i style={{ width: `${Math.max(4, pc / maxPct * 100)}%` }} /></s>{pc.toFixed(1).replace(".", ",")} %</span></td>
                <td className="sr-org">{p.origen === "MANUAL" ? "Manual" : "Importación"}</td>
                {puedeEditar && <td className="r"><button className="sr-q" disabled={busy} onClick={() => void quitar(p)}>Quitar</button></td>}
              </tr>;
            })}</tbody></table></div>}
          {puedeEditar && query.trim().length >= 2 && <div className="sr-audit" style={{ margin: "14px 0" }}>
            <div className="sr-row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div><strong style={{ fontSize: 13 }}>¿No está la póliza que buscas?</strong><div className="sr-section-note">Busca en todas las ventas, de cualquier mes, y añádela manualmente al sorteo.</div></div>
              <button className="sr-btn" disabled={busy || buscandoVentas} onClick={() => void buscarEnVentas()}>{buscandoVentas ? "Buscando…" : `Buscar «${query.trim()}» en las ventas`}</button>
            </div>
            {resultadosVentas && (resultadosVentas.length === 0
              ? <div className="sr-section-note" style={{ marginTop: 10 }}>No hay ventas fuera del sorteo que coincidan con la búsqueda.</div>
              : <div style={{ marginTop: 10 }}>{resultadosVentas.map(v => {
                const anulada = !!v.anulada || v.estado === "ANULADA";
                return <div key={v._id || v.numeroPoliza} className="sr-row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid #e7eaf0" }}>
                  <div><b style={{ fontSize: 13 }}>{v.tomador || "—"}</b> <span style={{ fontSize: 12, color: "#586174" }}>· póliza {v.numeroPoliza} · {v.ramo || "—"} · {v.aseguradora || "—"} · efecto {fecha(v.fechaEfecto)}{anulada ? " · ANULADA" : ""}</span></div>
                  <button className="sr-btn primary" disabled={busy || anulada} onClick={() => void agregarManual(String(v.numeroPoliza))}>Añadir al sorteo</button>
                </div>;
              })}</div>)}
          </div>}
          <div className="sr-foot"><span>Mostrando {filteredParticipantes.length ? paginaOk * PAGE + 1 : 0}–{Math.min((paginaOk + 1) * PAGE, filteredParticipantes.length)} de {filteredParticipantes.length} pólizas</span>
            <span className="sr-row" style={{ gap: 8 }}><button className="sr-btn" disabled={paginaOk === 0} onClick={() => setPagina(paginaOk - 1)}>Anterior</button>Página {paginaOk + 1} de {paginas}<button className="sr-btn" disabled={paginaOk >= paginas - 1} onClick={() => setPagina(paginaOk + 1)}>Siguiente</button></span></div>
        </>}

        {tab === "resultado" && <div className="sr-content">
          <div className="sr-section-head"><div><h2 className="sr-section-title">Resultado e historial</h2><div className="sr-section-note">Resultado que ha registrado el sistema para esta convocatoria.</div></div></div>
          {locked && ganador ? <WinnerCard g={ganador} fechaSorteo={actual.fechaRealizacion} /> : <div className="sr-empty"><div className="sr-empty-icon"><Icon n="trophy" size={26} /></div><strong>{locked ? "Resultado no disponible" : "El sorteo aún no se ha realizado"}</strong><span>{locked ? "El servidor no ha devuelto información del ganador." : "Cuando lo realices, el ganador aparecerá aquí."}</span></div>}
          {locked && esAdmin && <div className="sr-actions" style={{ justifyContent: "flex-start", margin: "14px 0" }}><button className="sr-btn" disabled={busy} onClick={() => void repetir()}>{busy ? "Procesando…" : "Repetir sorteo"}</button></div>}
          {locked && historial.length > 0 && <div className="sr-audit" style={{ marginBottom: 14 }}>
            <h3 className="sr-form-title" style={{ marginBottom: 12 }}>Historial de resultados</h3>
            {[...historial].map((h, idx) => ({ h, idx })).reverse().map(({ h, idx }) => {
              const vigente = idx === historial.length - 1;
              return <div key={h._id || idx} className="sr-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", padding: "12px 14px", marginBottom: 8, borderRadius: 10,
                border: vigente ? "1px solid #86d3a3" : "1px solid #e1e5ee", borderLeft: vigente ? "5px solid #1c9c52" : "5px solid #c9ced8", background: vigente ? "#effaf3" : "#f7f8fb", opacity: vigente ? 1 : 0.75 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".04em", color: vigente ? "#1c6b32" : "#697386" }}>
                    {vigente ? (idx === 0 ? "GANADOR" : "NUEVO GANADOR") : "SUSTITUIDO"} · {h.tipo === "INICIAL" ? "Sorteo inicial" : `Repetición ${idx}`}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, textDecoration: vigente ? "none" : "line-through", color: vigente ? "#1d2433" : "#697386" }}>{h.ganador?.tomador || "—"}</div>
                  <div style={{ fontSize: 12, color: "#586174" }}>Póliza {h.ganador?.numeroPoliza || "—"}{h.ganador?.ramo ? ` · ${h.ganador.ramo}` : ""}</div>
                  {h.tipo !== "INICIAL" && <div style={{ fontSize: 12, color: "#586174", marginTop: 4 }}>Motivo de la repetición: {h.motivo || "—"}</div>}
                </div>
                <div style={{ fontSize: 12, color: "#586174", textAlign: "right" }}>{fecha(h.fecha)}{vigente && <div style={{ marginTop: 6 }}><span style={{ background: "#1c9c52", color: "#fff", borderRadius: 999, padding: "3px 10px", fontWeight: 800, fontSize: 11 }}>VIGENTE</span></div>}</div>
              </div>;
            })}
          </div>}
          {locked && actual.auditoria && <div className="sr-audit"><h3 className="sr-form-title" style={{ marginBottom: 12 }}>Trazabilidad del resultado</h3><div className="sr-grid">
            <div><div className="sr-stat-label">Método de selección</div><strong style={{ fontSize: 13 }}>{actual.auditoria.metodo || "—"}</strong></div>
            <div><div className="sr-stat-label">Participaciones consideradas</div><strong style={{ fontSize: 13 }}>{actual.auditoria.totalParticipaciones ?? "—"}</strong></div>
            <div className="sr-full"><div className="sr-stat-label">Huella SHA-256 del listado</div><code style={{ fontSize: 12, wordBreak: "break-all", color: "#586174" }}>{actual.auditoria.huellaSHA256 || "—"}</code></div></div></div>}
        </div>}

        {tab === "configuracion" && <div className="sr-content">
          <div className="sr-section-head"><div><h2 className="sr-section-title">Configuración del sorteo</h2><div className="sr-section-note">Edita los datos y las reglas de participación.</div></div></div>
          {!esAdmin ? <div className="sr-alert">La configuración es de solo lectura: solo el administrador puede modificarla.</div> : locked && <div className="sr-alert">Este sorteo ya se realizó. La configuración es de solo lectura.</div>}
          <div className="sr-form-grid"><div className="sr-full"><label className="sr-label">Nombre</label><input className="sr-field" value={form.nombre} disabled={!puedeEditar} onChange={e => updateForm("nombre", e.target.value)} /></div><div className="sr-full"><label className="sr-label">Descripción</label><input className="sr-field" value={form.descripcion} disabled={!puedeEditar} onChange={e => updateForm("descripcion", e.target.value)} /></div>
            <div><label className="sr-label">Fecha desde</label><input type="date" className="sr-field" value={form.fechaInicio} disabled={!puedeEditar} onChange={e => updateForm("fechaInicio", e.target.value)} /></div><div><label className="sr-label">Fecha hasta</label><input type="date" className="sr-field" value={form.fechaFin} disabled={!puedeEditar} onChange={e => updateForm("fechaFin", e.target.value)} /></div>
            <div className="sr-full"><label className="sr-label">Criterio de fecha</label><select className="sr-field" value={form.criterioFecha} disabled={!puedeEditar} onChange={e => updateForm("criterioFecha", e.target.value)}><option value="EFECTO">Fecha de efecto</option><option value="REGISTRO">Fecha de registro</option></select></div></div>
          <h3 className="sr-form-title" style={{ marginTop: 24 }}>Participaciones por ramo</h3>{ramosEditor(!puedeEditar)}
          {esAdmin && <div className="sr-actions"><button className="sr-btn danger" disabled={busy} onClick={() => void eliminar()}>Eliminar sorteo</button>{puedeEditar && <button className="sr-btn primary" disabled={busy} onClick={() => void guardar()}>{busy ? "Guardando…" : "Guardar cambios"}</button>}</div>}
        </div>}
      </section>
    </div>}

    {dialogo && <div className="sr-draw" role="dialog" aria-modal="true" aria-label={dialogo.titulo} onKeyDown={e => { if (e.key === "Escape") cerrarDialogo(dialogo.campo ? null : false); }}>
      <div className="sr-modal" style={{ textAlign: "left", width: "min(440px,100%)" }}>
        <h2>{dialogo.titulo}</h2>
        {dialogo.texto && <p>{dialogo.texto}</p>}
        {dialogo.campo && <div><label className="sr-label">{dialogo.campo.etiqueta}</label>
          <input className="sr-field" autoFocus value={dialogoValor} placeholder={dialogo.campo.placeholder} onChange={e => { setDialogoValor(e.target.value); setDialogoError(""); }} onKeyDown={e => { if (e.key === "Enter") aceptarDialogo(); }} />
          {dialogoError && <div style={{ color: "#b3263a", fontSize: 12, marginTop: 6 }}>{dialogoError}</div>}</div>}
        <div className="sr-row" style={{ justifyContent: "flex-end" }}>
          <button className="sr-btn" onClick={() => cerrarDialogo(dialogo.campo ? null : false)}>Cancelar</button>
          <button className={`sr-btn ${dialogo.peligro ? "danger" : "primary"}`} autoFocus={!dialogo.campo} onClick={aceptarDialogo}>{dialogo.ok}</button>
        </div>
      </div>
    </div>}

    {draw && <div className="sr-draw" role="dialog" aria-modal="true" aria-label="Realizando el sorteo">
      <div className="sr-modal">
        {draw.phase === "roll"
          ? <><h2>{draw.prueba ? "Sorteo de prueba" : "Realizando el sorteo"}</h2><p>Eligiendo entre {totalParticipaciones} participaciones…</p><div className="sr-roller" aria-live="off">{draw.name}</div></>
          : draw.prueba && draw.ganador
            ? <><h2>Resultado de la prueba</h2><p>Es un simulacro: no se ha guardado nada y el sorteo sigue abierto.</p><WinnerCard g={draw.ganador} prueba /><div className="sr-row" style={{ justifyContent: "center" }}><button className="sr-btn" onClick={probar}>Repetir prueba</button><button className="sr-btn primary" autoFocus onClick={() => setDraw(null)}>Cerrar</button></div></>
            : <><h2>Ya hay ganador</h2>{ganador ? <WinnerCard g={ganador} fechaSorteo={actual?.fechaRealizacion} /> : <p>El sorteo se ha registrado correctamente.</p>}<button className="sr-btn primary" autoFocus onClick={() => setDraw(null)}>Ver resultado</button></>}
      </div>
    </div>}
  </div>;
}
