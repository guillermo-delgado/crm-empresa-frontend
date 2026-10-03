import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Dispatch, SetStateAction } from "react";

import VentasGlobalSearch from "../../components/crm/VentasGlobalSearch";
import VentasTableSkeleton from "../../components/crm/skeletons/VentasTableSkeleton";

import VentasSearchSkeleton from "../../components/crm/skeletons/VentasSearchSkeleton";
import { registerVentasSocketHandlers } from "../../services/ventasSocketHandlers";
import api from "../../services/api";
import { useOutletContext } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Pencil, Ban, RotateCcw, Trash2, Eye, EyeOff, Search,
  BookOpen, Plus, FileSpreadsheet, FileText, Inbox, AlertTriangle, X,
  ArrowUp, ArrowDown, ArrowUpDown, SlidersHorizontal, ChevronUp, ChevronDown, MessageSquareText,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getSocket } from "../../services/socket";
// Formulario único de ventas (crear / editar). Ajusta la ruta si está en otra carpeta.
import NuevaVenta from "./NuevaVenta";
import BienvenidaV2 from "./BienvenidaV2";
import DashboardKpis from "../crm/DashboardKpis";

type VentaAPI = {
  _id: string;

  // Fecha de efecto / emisión
  fechaEfecto: string;

  // Fecha de registro de la venta
  createdAt?: string;

  numeroPoliza: string;
  tomador: string;
  aseguradora: string;
  ramo: string;
  primaNeta: number;
  formaPago?: string;
  observaciones?: string;

  createdBy?: {
    _id: string;
    nombre: string;
  };

  estadoRevision?: "pendiente" | "aceptada" | "rechazada" | null;

  anulada?: boolean;
};

type VentaEditando = {
  data: VentaAPI;
  original: VentaAPI;
  changedFields: string[];
  solicitudId?: string;
  fromSocket?: boolean;
};

// Acción abierta sobre una venta (un único modal a la vez).
type Accion =
  | { modo: "editar"; venta: VentaEditando }
  | { modo: "anular"; venta: any; solicitud?: any }
  | { modo: "rehabilitar"; venta: any; solicitud?: any }
  | { modo: "eliminar"; venta: VentaAPI }
  | { modo: "crear" };

type LayoutContext = {
  setRevisionCount: Dispatch<SetStateAction<number>>;
};

/* =========================
   ESTILOS COMPARTIDOS
========================= */
const CARD = "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]";
const FIELD =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 cursor-pointer";
const BTN_GHOST =
  "inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer";

const RAMO_STYLE: Record<string, { bg: string; fg: string }> = {
  autos: { bg: "#e6ecff", fg: "#2446a8" },
  hogar: { bg: "#def5f0", fg: "#0b6b5c" },
  decesos: { bg: "#ece8fb", fg: "#4b3aa6" },
  vida: { bg: "#fde7ef", fg: "#a3254f" },
  empresas: { bg: "#fdf0d8", fg: "#8a5a06" },
  salud: { bg: "#e1f5e6", fg: "#1c6b32" },
  rc: { bg: "#e8ecf2", fg: "#3b475c" },
};
const ramoStyle = (r?: string) =>
  RAMO_STYLE[String(r || "").trim().toLowerCase()] || { bg: "#eef1f5", fg: "#475467" };
const iniciales = (s = "") =>
  s.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "—";

type ColKey = "venta" | "efecto" | "poliza" | "tomador" | "aseguradora" | "ramo" | "prima" | "usuario";

const COL_LABELS: Record<ColKey, string> = {
  venta: "Venta",
  efecto: "Efecto",
  poliza: "Póliza",
  tomador: "Tomador",
  aseguradora: "Aseguradora",
  ramo: "Ramo",
  prima: "Prima",
  usuario: "Usuario",
};

const COL_DEFAULT_ORDER: ColKey[] = [
  "venta",
  "efecto",
  "poliza",
  "tomador",
  "aseguradora",
  "ramo",
  "prima",
  "usuario",
];

const isColKey = (x: unknown): x is ColKey => COL_DEFAULT_ORDER.includes(x as ColKey);

export default function LibroVentas() {
  const { setRevisionCount } = useOutletContext<LayoutContext>();

  /* =========================
     USUARIO ACTUAL
  ========================= */
  let currentUser: any = null;
  try {
    currentUser = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    currentUser = null;
  }

  const isAdmin = currentUser?.role === "admin";

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());

  // =========================
  // MODO DE CONSULTA DE FECHA
  // =========================

  // Solo el administrador puede cambiar el modo.
  // Los empleados mantienen el comportamiento actual.
  const [modoFecha, setModoFecha] = useState<"efecto" | "venta">("efecto");

  const [soloFuturas, setSoloFuturas] = useState(false);

  // BUSCADOR
  const [search, setSearch] = useState("");
  const searchActive = search.trim().length >= 2;

  const [ventasBusqueda, setVentasBusqueda] = useState<VentaAPI[] | null>(null);
  const [, setLoadingBusqueda] = useState(false);

  const [diaHasta, setDiaHasta] = useState<number | null>(null);

  const [hiddenCols, setHiddenCols] = useState<ColKey[]>([]);
  const [colOrder, setColOrder] = useState<ColKey[]>(COL_DEFAULT_ORDER);
  const [sort, setSort] = useState<{ key: ColKey; dir: "asc" | "desc" } | null>(null);
  const [showColMenu, setShowColMenu] = useState(false);
  const columnPrefsKey = `crm-libro-columnas-${currentUser?._id || currentUser?.id || currentUser?.email || currentUser?.role || "usuario"}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(columnPrefsKey);
      if (!saved) return;
      const parsed = JSON.parse(saved);

      const hidden: ColKey[] = Array.isArray(parsed.hiddenCols) ? parsed.hiddenCols.filter(isColKey) : [];
      // Migración de preferencias antiguas (solo póliza / tomador).
      if (parsed.showPoliza === false && !hidden.includes("poliza")) hidden.push("poliza");
      if (parsed.showTomador === false && !hidden.includes("tomador")) hidden.push("tomador");
      setHiddenCols(hidden);

      if (Array.isArray(parsed.colOrder)) {
        const ok: ColKey[] = Array.from(new Set<ColKey>(parsed.colOrder.filter(isColKey)));
        const missing = COL_DEFAULT_ORDER.filter((k) => !ok.includes(k));
        setColOrder([...ok, ...missing]);
      }

      if (parsed.sort && isColKey(parsed.sort.key) && (parsed.sort.dir === "asc" || parsed.sort.dir === "desc")) {
        setSort({ key: parsed.sort.key, dir: parsed.sort.dir });
      }
    } catch {
      // Preferencias locales corruptas: se ignoran.
    }
  }, [columnPrefsKey]);

  useEffect(() => {
    try {
      localStorage.setItem(columnPrefsKey, JSON.stringify({ hiddenCols, colOrder, sort }));
    } catch {
      // localStorage no disponible.
    }
  }, [columnPrefsKey, hiddenCols, colOrder, sort]);

  // Solo el admin ve la fecha de venta, ordena y reorganiza columnas.
  const columnasVisibles = useMemo(
    () =>
      (isAdmin ? colOrder : COL_DEFAULT_ORDER).filter(
        (k) => (isAdmin || k !== "venta") && !hiddenCols.includes(k)
      ),
    [isAdmin, colOrder, hiddenCols]
  );

  const toggleCol = (k: ColKey) =>
    setHiddenCols((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const moverCol = (k: ColKey, delta: number) =>
    setColOrder((prev) => {
      const i = prev.indexOf(k);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const restablecerCols = () => {
    setColOrder(COL_DEFAULT_ORDER);
    setHiddenCols([]);
    setSort(null);
  };

  const clickSort = (k: ColKey) =>
    setSort((prev) =>
      !prev || prev.key !== k ? { key: k, dir: "asc" } : prev.dir === "asc" ? { key: k, dir: "desc" } : null
    );

  // 📅 Límites de periodo (empleados)
  const hoy = new Date();
  const minPeriodo = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const maxPeriodo = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 1);

  const [showSolicitudesModal, setShowSolicitudesModal] = useState(false);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const solicitudesOrdenadas = useMemo(() => {
    return [...solicitudes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [solicitudes]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setVentasBusqueda(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setLoadingBusqueda(true);
        const res = await api.get(`/ventas/buscar?q=${encodeURIComponent(search)}`);
        setVentasBusqueda(res.data || []);
      } catch {
        setVentasBusqueda([]);
      } finally {
        setLoadingBusqueda(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  const [ventas, setVentas] = useState<VentaAPI[]>([]);
  const [ventasProduccionSemanal, setVentasProduccionSemanal] = useState<VentaAPI[]>([]);

  const [loading, setLoading] = useState(false);

  // Único estado para editar / eliminar / anular / rehabilitar.
  const [accion, setAccion] = useState<Accion | null>(null);
  const cerrarAccion = () => setAccion(null);

  const [aseguradora, setAseguradora] = useState("ALL");
  const [usuario, setUsuario] = useState("ALL");
  const [ramo, setRamo] = useState("ALL");
  const [kpis, setKpis] = useState<any>(null);
  const [semanaVentaIds, setSemanaVentaIds] = useState<string[] | null>(null);

  const fetchKPIs = async () => {
    try {
      const res = await api.get("/ventas/kpis", {
        params: {
          mes,
          anio,
          aseguradora,
          ramo,
          usuario,
          diaHasta,

          modoFecha: isAdmin ? modoFecha : "efecto",
        },
      });

      setKpis(res.data);
    } catch {
      setKpis(null);
    }
  };

  /* =========================
     SOLICITUDES PENDIENTES
  ========================= */

  const cargarSolicitudes = async () => {
    try {
      const res = await api.get("/solicitudes");
      setSolicitudes(res.data || []);
      // ❌ NUNCA setRevisionCount AQUÍ
    } catch {
      // nada
    }
  };

  const abrirSolicitudes = async () => {
    try {
      const res = await api.get("/solicitudes");
      setSolicitudes(res.data || []);

      setShowSolicitudesModal(true);
    } catch {
      alert("Error cargando solicitudes");
    }
  };

  // silencioso = true → refresco en segundo plano (sockets), sin parpadeo de skeleton.
  const fetchLibroVentas = async (silencioso = false) => {
    if (!silencioso) setLoading(true);

    try {
      const res = await api.get("/ventas/libro", {
        params: {
          month: mes,
          year: anio,
          diaHasta,

          // El empleado siempre usa fecha de efecto.
          // El administrador puede elegir.
          modoFecha: isAdmin ? modoFecha : "efecto",
        },
      });

      setVentas(Array.isArray(res.data.ventas) ? res.data.ventas : []);
    } catch (e) {
      console.error("Error cargando libro de ventas", e);
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  // Cargar ventas registradas del mes exclusivamente para Producción por semanas
  // y Producción comercial (Registro). No depende de modoFecha.
  const fetchVentasProduccionSemanal = async () => {
    try {
      const res = await api.get("/ventas/libro", {
        params: {
          month: mes,
          year: anio,
          diaHasta,
          modoFecha: "venta",
        },
      });

      setVentasProduccionSemanal(Array.isArray(res.data.ventas) ? res.data.ventas : []);
    } catch (e) {
      console.error("Error cargando ventas registradas para producción semanal", e);
      setVentasProduccionSemanal([]);
    }
  };

  // 1️⃣ Cargar ventas al cambiar periodo
  useEffect(() => {
    fetchLibroVentas();
    fetchVentasProduccionSemanal();
  }, [mes, anio, diaHasta, modoFecha]);

  useEffect(() => {
    setSemanaVentaIds(null);
  }, [mes, anio, modoFecha]);

  useEffect(() => {
    fetchKPIs();
  }, [mes, anio, aseguradora, ramo, usuario, diaHasta, modoFecha, ventas]);

  // 2️⃣ Cargar solicitudes pendientes al entrar (ADMIN)
  useEffect(() => {
    if (!isAdmin) return;
    cargarSolicitudes();
  }, [isAdmin]);

  // 3️⃣ Socket tiempo real
  // Refresco en segundo plano con los filtros ACTUALES (la ref evita closures viejos)
  // y con debounce, para agrupar varios eventos seguidos en una sola recarga.
  const refrescarRef = useRef<() => void>(() => {});
  const refrescoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  refrescarRef.current = () => {
    if (refrescoTimer.current) clearTimeout(refrescoTimer.current);

    refrescoTimer.current = setTimeout(() => {
      fetchLibroVentas(true);
      fetchVentasProduccionSemanal();

      if (search.trim().length >= 2) {
        api
          .get(`/ventas/buscar?q=${encodeURIComponent(search)}`)
          .then((res) => setVentasBusqueda(res.data || []))
          .catch(() => {});
      }
    }, 400);
  };

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let reintento: ReturnType<typeof setInterval> | undefined;

    const registrar = () => {
      const socket = getSocket();
      if (!socket) return false;

      cleanup = registerVentasSocketHandlers({
        socket,
        isAdmin,
        setVentas,
        setRevisionCount,
        cargarSolicitudes,
        refrescar: () => refrescarRef.current(),
      });

      return true;
    };

    // Si el socket aún no existe al montar la página, se reintenta hasta que esté.
    if (!registrar()) {
      reintento = setInterval(() => {
        if (registrar() && reintento) clearInterval(reintento);
      }, 500);
    }

    return () => {
      if (reintento) clearInterval(reintento);
      if (refrescoTimer.current) clearTimeout(refrescoTimer.current);
      cleanup?.();
    };
  }, [isAdmin]);

  // Abre la acción que corresponde a una solicitud pendiente (admin).
  const abrirSolicitud = async (s: any) => {
    setShowSolicitudesModal(false);

    try {
      const res = await api.get(`/ventas/${s.venta._id}`);
      const original = res.data;

      switch (s.tipo) {
        case "EDITAR_VENTA":
          setAccion({
            modo: "editar",
            venta: {
              data: { ...original, ...s.payload },
              original,
              changedFields: Object.keys(s.payload || {}),
              solicitudId: s._id,
              fromSocket: true,
            },
          });
          break;

        case "ELIMINAR_VENTA":
          setAccion({
            modo: "editar",
            venta: {
              data: original,
              original,
              changedFields: ["__DELETE__"],
              solicitudId: s._id,
              fromSocket: true,
            },
          });
          break;

        case "ANULAR_VENTA":
          setAccion({
            modo: "anular",
            venta: {
              ...original,
              solicitudId: s._id,
              payload: s.payload,
              solicitadoPor: s.solicitadoPor,
            },
            solicitud: s,
          });
          break;

        case "REHABILITAR_VENTA":
          setAccion({
            modo: "rehabilitar",
            venta: { ...original, solicitadoPor: s.solicitadoPor },
            solicitud: s,
          });
          break;
      }
    } catch {
      alert("Error abriendo la solicitud");
    }
  };

  const refrescarLibro = () => {
    fetchLibroVentas(true);
    fetchVentasProduccionSemanal();
  };

  /* =========================
     🔖 LABELS SOLICITUDES
  ========================= */
  const SOLICITUD_LABELS: Record<string, string> = {
    EDITAR_VENTA: "Editar venta",
    ANULAR_VENTA: "Anular venta",
    REHABILITAR_VENTA: "Rehabilitar venta",
    ELIMINAR_VENTA: "Eliminar venta",
  };

  const SOLICITUD_BADGES: Record<string, string> = {
    EDITAR_VENTA: "bg-blue-50 text-blue-700",
    ANULAR_VENTA: "bg-orange-50 text-orange-700",
    REHABILITAR_VENTA: "bg-emerald-50 text-emerald-700",
    ELIMINAR_VENTA: "bg-red-50 text-red-700",
  };

  const ventasBase = useMemo(() => {
    if (ventasBusqueda !== null) {
      return ventasBusqueda;
    }
    return ventas;
  }, [ventasBusqueda, ventas]);

  /* =========================
     FILTROS
  ========================= */
  const ventasFiltradas = useMemo(() => {
    // Si se selecciona una semana, la tabla debe mostrar EXACTAMENTE
    // las ventas registradas (createdAt) que forman esa semana.
    const fuente = semanaVentaIds !== null ? ventasProduccionSemanal : ventasBase;

    return fuente.filter((v) => {
      if (aseguradora !== "ALL" && v.aseguradora !== aseguradora) return false;
      if (usuario !== "ALL" && v.createdBy?._id !== usuario) return false;
      if (ramo !== "ALL" && v.ramo !== ramo) return false;

      if (semanaVentaIds !== null && !semanaVentaIds.includes(v._id)) {
        return false;
      }

      // El filtro de efectos futuros no debe recortar una semana seleccionada.
      if (semanaVentaIds === null && soloFuturas && modoFecha === "venta") {
        if (!v.fechaEfecto) return false;

        const fechaEfecto = new Date(v.fechaEfecto);
        const inicioPeriodo = new Date(anio, mes - 1, 1);

        if (fechaEfecto <= inicioPeriodo) return false;

        const mesEfecto = fechaEfecto.getFullYear() * 12 + fechaEfecto.getMonth();

        const mesSeleccionado = anio * 12 + (mes - 1);

        if (mesEfecto <= mesSeleccionado) return false;
      }

      return true;
    });
  }, [
    ventasBase,
    ventasProduccionSemanal,
    aseguradora,
    usuario,
    ramo,
    semanaVentaIds,
    soloFuturas,
    modoFecha,
    mes,
    anio,
  ]);

  // Producción por semanas usa siempre createdAt y respeta solo los filtros comerciales.
  const ventasProduccionSemanalFiltradas = useMemo(() => {
    return ventasProduccionSemanal.filter((v) => {
      if (aseguradora !== "ALL" && v.aseguradora !== aseguradora) return false;
      if (usuario !== "ALL" && v.createdBy?._id !== usuario) return false;
      if (ramo !== "ALL" && v.ramo !== ramo) return false;
      return true;
    });
  }, [ventasProduccionSemanal, aseguradora, usuario, ramo]);

  /* =========================
     KPIs
  ========================= */
  const produccionTotal = ventasFiltradas.reduce((acc, v) => acc + v.primaNeta, 0);

  const produccionPorRamo = useMemo(() => {
    return ventasFiltradas.reduce<Record<string, number>>((acc, v) => {
      acc[v.ramo] = (acc[v.ramo] || 0) + v.primaNeta;
      return acc;
    }, {});
  }, [ventasFiltradas]);

  const aseguradoras = Array.from(new Set(ventas.map((v) => v.aseguradora)));
  const usuarios = Array.from(
    new Map(
      ventas.filter((v) => v.createdBy?._id).map((v) => [v.createdBy!._id, v.createdBy!])
    ).values()
  );

  const ramos = Array.from(new Set(ventas.map((v) => v.ramo)));

  /* =========================
     ACCIONES DE FILA
  ========================= */
  const marcarRevisionLeida = async (v: VentaAPI) => {
    await api.patch(`/ventas/${v._id}/marcar-revision-leida`);
    setVentas((prev) => prev.map((item) => (item._id === v._id ? { ...item, estadoRevision: null } : item)));
    setRevisionCount((prev) => Math.max(prev - 1, 0));
  };

  const abrirEdicion = async (v: VentaAPI) => {
    const originalVenta = ventas.find((item) => item._id === v._id);
    if (!originalVenta) return;
    const original = JSON.parse(JSON.stringify(originalVenta));
    let ventaInicial: any = JSON.parse(JSON.stringify(original));
    let changedFields: string[] = [];
    let solicitudId: string | undefined;
    if (original.estadoRevision === "pendiente") {
      try {
        const res = await api.get(`/ventas/${original._id}/solicitud-pendiente`);
        const solicitud = res.data;
        if (solicitud?.payload && typeof solicitud.payload === "object") {
          ventaInicial = { ...ventaInicial, ...solicitud.payload };
          changedFields = Object.keys(solicitud.payload);
          solicitudId = solicitud._id;
        }
      } catch {
        // edición normal como fallback
      }
    }
    if (ventaInicial.fechaEfecto) ventaInicial.fechaEfecto = String(ventaInicial.fechaEfecto).slice(0, 10);
    setAccion({
      modo: "editar",
      venta: { data: ventaInicial, original, changedFields, solicitudId, fromSocket: false },
    });
  };

  const iniciarRehabilitacion = (v: VentaAPI) => {
    const original = ventas.find((item) => item._id === v._id);
    if (!original) return;
    // Admin desde la tabla: rehabilitación directa (solicitud "local").
    setAccion({
      modo: "rehabilitar",
      venta: original,
      solicitud: {
        _id: original._id,
        tipo: "REHABILITAR_VENTA",
        estado: "PENDIENTE",
        venta: { _id: original._id },
        local: true,
      },
    });
  };

  /* =========================
     EXPORT EXCEL
  ========================= */
  const exportExcel = () => {
    const resumenData: any[][] = [];

    resumenData.push(["CRM · Libro de ventas"]);
    resumenData.push(["Control mensual de producción"]);
    resumenData.push([]);
    resumenData.push(["Periodo", `${mesNombre(mes)} ${anio}`]);
    resumenData.push(["Producción total", `${produccionTotal.toFixed(2)} €`]);
    resumenData.push([]);
    resumenData.push(["Producción por ramo"]);
    resumenData.push(["Ramo", "Producción (€)"]);

    Object.entries(produccionPorRamo).forEach(([ramo, total]) => {
      resumenData.push([ramo, total.toFixed(2)]);
    });

    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    wsResumen["!cols"] = [{ wch: 30 }, { wch: 25 }];

    const ventasData = ventasFiltradas.map((v) => ({
      fechaEfecto: v.fechaEfecto ? new Date(v.fechaEfecto).toLocaleDateString("es-ES") : "-",
      fechaVenta: v.createdAt ? new Date(v.createdAt).toLocaleDateString("es-ES") : "-",
      Póliza: v.numeroPoliza,
      Tomador: v.tomador,
      Aseguradora: v.aseguradora,
      Ramo: v.ramo,
      "Prima (€)": v.primaNeta.toFixed(2),
      Usuario: v.createdBy?.nombre || "",
    }));

    const wsVentas = XLSX.utils.json_to_sheet(ventasData);
    wsVentas["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 28 },
      { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 22 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
    XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");

    XLSX.writeFile(wb, `libro-ventas-${mesNombre(mes)}-${anio}.xlsx`);
  };

  /* =========================
     EXPORT PDF
  ========================= */
  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.text("CRM · Libro de ventas", 14, y);

    y += 6;
    doc.setFontSize(10);
    doc.text("Control mensual de producción", 14, y);

    y += 10;

    doc.setFontSize(11);
    // doc.text(`${produccionTotal.toFixed(2)} €`, 18, y + 13);

    autoTable(doc, {
      startY: y + 20,
      head: [["Venta", "Efecto", "Póliza", "Tomador", "Aseguradora", "Ramo", "Prima", "Usuario"]],
      body: ventasFiltradas.map((v) => [
        v.createdAt ? new Date(v.createdAt).toLocaleDateString("es-ES") : "-",
        v.fechaEfecto ? new Date(v.fechaEfecto).toLocaleDateString("es-ES") : "-",
        v.numeroPoliza,
        v.tomador,
        v.aseguradora,
        v.ramo,
        `${v.primaNeta.toFixed(2)} €`,
        v.createdBy?.nombre || "",
      ]),
    });

    doc.save(`libro-ventas-${mesNombre(mes)}-${anio}.pdf`);
  };

  const ventasOrdenadas = useMemo(() => {
    const t = (d?: string) => (d ? new Date(d).getTime() : 0);
    const porDefecto = (a: VentaAPI, b: VentaAPI) =>
      t(b.createdAt || b.fechaEfecto) - t(a.createdAt || a.fechaEfecto);

    const lista = [...ventasFiltradas];
    if (!isAdmin || !sort) return lista.sort(porDefecto);

    const valor = (v: VentaAPI): string | number => {
      switch (sort.key) {
        case "venta":
          return t(v.createdAt);
        case "efecto":
          return t(v.fechaEfecto);
        case "poliza":
          return v.numeroPoliza || "";
        case "tomador":
          return v.tomador || "";
        case "aseguradora":
          return v.aseguradora || "";
        case "ramo":
          return v.ramo || "";
        case "prima":
          return Number(v.primaNeta || 0);
        case "usuario":
          return v.createdBy?.nombre || "";
      }
    };

    const dir = sort.dir === "asc" ? 1 : -1;
    return lista.sort((a, b) => {
      const x = valor(a);
      const y = valor(b);
      const c =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "es", { numeric: true, sensitivity: "base" });
      return c !== 0 ? c * dir : porDefecto(a, b);
    });
  }, [ventasFiltradas, isAdmin, sort]);

  const hayFiltros = Boolean(
    search || aseguradora !== "ALL" || ramo !== "ALL" || usuario !== "ALL" || diaHasta !== null
  );

  return (
    <div className="min-h-screen space-y-6 bg-[#f1f3f8] p-4 sm:p-8">
      {/* BIENVENIDA CRM V2 (una sola vez por empleado) */}
      <BienvenidaV2 />

      {/* AVISO ADMIN */}
      {isAdmin && solicitudes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-amber-900 shadow-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle size={18} />
          </span>
          <p className="flex-1 text-sm font-medium">
            Tienes solicitudes de empleados pendientes de revisión ({solicitudes.length})
          </p>
          <button
            type="button"
            onClick={abrirSolicitudes}
            className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 cursor-pointer"
          >
            Revisar ahora
          </button>
        </div>
      )}

      {/* CABECERA */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
            <BookOpen size={22} />
          </span>
          <div>
            <p className="text-xs font-semibold text-blue-700">Control comercial</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">CRM · Libro de ventas</h1>
            <p className="text-sm text-slate-500">Control mensual de producción</p>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 lg:items-end">
          {/* SELECTOR DE PERIODO */}
          <div className="flex justify-start lg:justify-end">
            <PeriodoSelector
              mes={mes}
              anio={anio}
              setMes={setMes}
              setAnio={setAnio}
              minPeriodo={minPeriodo}
              maxPeriodo={maxPeriodo}
            />
          </div>

          {/* ACCIONES */}
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              onClick={() => setAccion({ modo: "crear" })}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 cursor-pointer"
            >
              <Plus size={16} /> Nueva venta
            </button>

            {isAdmin && (
              <>
                <button onClick={exportExcel} className={BTN_GHOST}>
                  <FileSpreadsheet size={16} className="text-emerald-600" /> Exportar Excel
                </button>

                <button onClick={exportPDF} className={BTN_GHOST}>
                  <FileText size={16} className="text-red-500" /> Exportar PDF
                </button>

                <button onClick={abrirSolicitudes} className={`relative ${BTN_GHOST}`}>
                  <Inbox size={16} className="text-slate-500" /> Ver solicitudes pendientes
                  {solicitudes.length > 0 && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow">
                      {solicitudes.length}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* DASHBOARD KPIs */}
      <DashboardKpis
        ventas={ventasFiltradas}
        ventasProduccionSemanal={ventasProduccionSemanalFiltradas}
        kpis={kpis}
        isAdmin={isAdmin}
        modoFecha={isAdmin ? modoFecha : "efecto"}
        mes={mes}
        anio={anio}
        onSemanaClick={setSemanaVentaIds}
      />

      {/* 🔍 BUSCADOR + FILTROS (ADMIN) */}
      {loading ? (
        <VentasSearchSkeleton />
      ) : (
        <div className={`${CARD} space-y-4 p-4 sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Buscar y filtrar</h2>
              <p className="mt-0.5 text-xs text-slate-500">Localiza rápidamente cualquier operación del CRM.</p>
            </div>
            {hayFiltros && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setAseguradora("ALL");
                  setRamo("ALL");
                  setUsuario("ALL");
                  setDiaHasta(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
              >
                <X size={13} /> Limpiar filtros
              </button>
            )}
          </div>

          {/* 🔍 BÚSQUEDA GLOBAL (TODOS) */}
          <VentasGlobalSearch value={search} onChange={setSearch} />

          {searchActive && (
            <p className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
              <Search size={13} /> Búsqueda activa · Se ignoran mes, año y filtros
            </p>
          )}

          {/* 🎛 FILTROS + CRITERIO DE FECHA (SOLO ADMIN) */}
          {isAdmin && (
            <div
              className={`flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4 transition-opacity duration-200 lg:gap-4 ${
                searchActive ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {/* MES */}
              <FiltroMes mes={mes} setMes={setMes} />

              {/* AÑO */}
              <FiltroAnio anio={anio} setAnio={setAnio} />

              {/* FILTRO HASTA DÍA */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">A día:</label>

                <input
                  type="date"
                  onClick={(e: any) => e.target.showPicker?.()}
                  value={
                    diaHasta
                      ? `${anio}-${String(mes).padStart(2, "0")}-${String(diaHasta).padStart(2, "0")}`
                      : ""
                  }
                  min={`${anio}-${String(mes).padStart(2, "0")}-01`}
                  max={`${anio}-${String(mes).padStart(2, "0")}-${String(
                    new Date(anio, mes, 0).getDate()
                  ).padStart(2, "0")}`}
                  onChange={(e) => {
                    if (!e.target.value) {
                      setDiaHasta(null);
                      return;
                    }

                    const selectedDate = new Date(e.target.value);
                    setDiaHasta(selectedDate.getDate());
                  }}
                  className={FIELD}
                />
              </div>

              <Select label="Aseguradora" value={aseguradora} setValue={setAseguradora} options={aseguradoras} />

              <Select label="Ramo" value={ramo} setValue={setRamo} options={ramos} />

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Usuario</label>
                <select value={usuario} onChange={(e) => setUsuario(e.target.value)} className={FIELD}>
                  <option value="ALL">Todos</option>
                  {usuarios.map((u: any) => (
                    <option key={u._id} value={u._id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* 🔘 CRITERIO DEL PERIODO — alineado a la derecha de los filtros */}
              {!searchActive && (
                <div className="ml-auto flex h-10 items-center gap-1 rounded-xl bg-slate-100 p-1">
                  <span className="hidden px-2 text-[11px] font-semibold text-slate-400 xl:inline">Periodo</span>
                  <button
                    type="button"
                    onClick={() => setModoFecha("venta")}
                    title="Usar la fecha real de registro de la venta"
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      modoFecha === "venta"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Ventas registradas
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoFecha("efecto")}
                    title="Usar la fecha de efecto de la póliza"
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      modoFecha === "efecto"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Fecha de efecto
                  </button>

                  {modoFecha === "venta" && (
                    <button
                      type="button"
                      onClick={() => setSoloFuturas((v) => !v)}
                      className={`ml-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                        soloFuturas
                          ? "bg-amber-500 text-white shadow-sm"
                          : "text-slate-500 hover:bg-white hover:text-slate-800"
                      }`}
                      title="Mostrar solo ventas cuyo efecto es posterior al periodo seleccionado"
                    >
                      Solo efectos futuros
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TABLA */}
      {loading ? (
        <div className={`${CARD} overflow-hidden`}>
          <VentasTableSkeleton rows={7} />
        </div>
      ) : (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-slate-900">Ventas registradas</h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                  {ventasFiltradas.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {modoFecha === "venta"
                  ? "Ventas creadas durante el periodo seleccionado"
                  : "Ventas agrupadas por fecha de efecto"}
              </p>
            </div>

            <div className="relative flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <>
                  {sort && (
                    <button
                      type="button"
                      onClick={() => setSort(null)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 cursor-pointer"
                    >
                      <X size={13} /> Quitar orden
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowColMenu((v) => !v)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 cursor-pointer"
                  >
                    <SlidersHorizontal size={14} /> Columnas
                  </button>

                  {showColMenu && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowColMenu(false)} />
                      <div className="absolute right-0 top-11 z-40 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold text-slate-400">
                          Mostrar y ordenar columnas
                        </p>

                        {colOrder.map((k, i) => {
                          const oculta = hiddenCols.includes(k);
                          return (
                            <div key={k} className="flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                              <button
                                type="button"
                                onClick={() => toggleCol(k)}
                                title={oculta ? "Mostrar columna" : "Ocultar columna"}
                                className={`flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer ${
                                  oculta ? "text-slate-300 hover:text-slate-500" : "text-blue-600 hover:bg-blue-50"
                                }`}
                              >
                                {oculta ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>

                              <span className={`flex-1 text-sm ${oculta ? "text-slate-400" : "font-medium text-slate-700"}`}>
                                {COL_LABELS[k]}
                              </span>

                              <button
                                type="button"
                                disabled={i === 0}
                                onClick={() => moverCol(k, -1)}
                                title="Mover a la izquierda"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                              >
                                <ChevronUp size={15} />
                              </button>
                              <button
                                type="button"
                                disabled={i === colOrder.length - 1}
                                onClick={() => moverCol(k, 1)}
                                title="Mover a la derecha"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                              >
                                <ChevronDown size={15} />
                              </button>
                            </div>
                          );
                        })}

                        <div className="mt-1 border-t border-slate-100 pt-2">
                          <button
                            type="button"
                            onClick={restablecerCols}
                            className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
                          >
                            Restablecer columnas y orden
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                  <span className="px-2 text-[11px] font-semibold text-slate-400">Columnas</span>
                  {(["poliza", "tomador"] as ColKey[]).map((k) => {
                    const visible = !hiddenCols.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleCol(k)}
                        title={visible ? `Ocultar ${COL_LABELS[k].toLowerCase()}` : `Mostrar ${COL_LABELS[k].toLowerCase()}`}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                          visible ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {visible ? <Eye size={13} /> : <EyeOff size={13} />}
                        {COL_LABELS[k]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {ventasFiltradas.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                <Search size={22} />
              </div>
              <p className="text-sm font-semibold text-slate-800">No hay ventas para este criterio</p>
              <p className="mt-1 text-xs text-slate-500">Prueba otro periodo o elimina algún filtro.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-sm lg:min-w-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                    {columnasVisibles.map((k, i) => {
                      const activo = isAdmin && sort?.key === k;
                      return (
                        <th
                          key={k}
                          className={`whitespace-nowrap border-b border-slate-100 px-3 py-3.5 xl:px-4 ${
                            i === 0 ? "pl-4 xl:pl-6" : ""
                          } ${k === "prima" ? "text-right" : ""} ${k === "tomador" ? "w-full" : ""}`}
                        >
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={() => clickSort(k)}
                              title="Ordenar por esta columna"
                              className={`inline-flex items-center gap-1 font-semibold transition hover:text-slate-800 cursor-pointer ${
                                k === "prima" ? "flex-row-reverse" : ""
                              } ${activo ? "text-blue-700" : ""}`}
                            >
                              {COL_LABELS[k]}
                              {activo ? (
                                sort!.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={12} className="opacity-40" />
                              )}
                            </button>
                          ) : (
                            COL_LABELS[k]
                          )}
                        </th>
                      );
                    })}
                    <th className="whitespace-nowrap border-b border-slate-100 px-4 py-3.5 text-right xl:px-6">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ventasOrdenadas.map((v) => {
                    const anulada = Boolean((v as any).anulada || (v as any).estado === "ANULADA");
                    const pendienteRevision = v.estadoRevision === "pendiente";
                    const rs = ramoStyle(v.ramo);

                    const celdas: Record<ColKey, { cls: string; node: ReactNode }> = {
                      venta: {
                        cls: "whitespace-nowrap px-3 py-4 text-slate-700 xl:px-4",
                        node: (
                          <div className="font-semibold text-slate-800">
                            {v.createdAt ? new Date(v.createdAt).toLocaleDateString("es-ES") : "-"}
                          </div>
                        ),
                      },
                      efecto: {
                        cls: "whitespace-nowrap px-3 py-4 text-slate-600 xl:px-4",
                        node: v.fechaEfecto ? new Date(v.fechaEfecto).toLocaleDateString("es-ES") : "-",
                      },
                      poliza: {
                        cls: "whitespace-nowrap px-3 py-4 xl:px-4",
                        node: (
                          <div className="flex flex-col items-start gap-1">
                            <span className={`font-semibold ${anulada ? "text-slate-400 line-through" : "text-slate-800"}`}>
                              {v.numeroPoliza || "-"}
                            </span>
                            {anulada && (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                Anulada
                              </span>
                            )}
                          </div>
                        ),
                      },
                      tomador: {
                        cls: "w-full max-w-0 px-3 py-4 xl:px-4",
                        node: (
                          <div className="flex min-w-[150px] items-center gap-3">
                            <span
                              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold xl:flex"
                              style={{ background: rs.bg, color: rs.fg }}
                            >
                              {iniciales(v.tomador)}
                            </span>
                            <div
                              className={`truncate font-semibold ${anulada ? "text-slate-400" : "text-slate-800"}`}
                              title={v.tomador}
                            >
                              {v.tomador || "-"}
                            </div>
                            {v.observaciones?.trim() && (
                              <span
                                className="inline-flex shrink-0 items-center text-[#2f5bd3]"
                                title={v.observaciones.trim()}
                                aria-label="Tiene observaciones"
                              >
                                <MessageSquareText className="h-4 w-4" />
                              </span>
                            )}
                          </div>
                        ),
                      },
                      aseguradora: {
                        cls: "whitespace-nowrap px-3 py-4 text-slate-700 xl:px-4",
                        node: v.aseguradora || "-",
                      },
                      ramo: {
                        cls: "px-3 py-4 xl:px-4",
                        node: v.ramo ? (
                          <span
                            className="inline-block max-w-[150px] rounded-full px-2.5 py-1 text-xs font-bold leading-tight"
                            style={{ background: rs.bg, color: rs.fg }}
                          >
                            {v.ramo}
                          </span>
                        ) : (
                          "-"
                        ),
                      },
                      prima: {
                        cls: `whitespace-nowrap px-3 py-4 text-right font-bold tabular-nums xl:px-4 ${
                          anulada ? "text-slate-400 line-through" : "text-slate-900"
                        }`,
                        node: (
                          <>
                            {Number(v.primaNeta || 0).toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            €
                          </>
                        ),
                      },
                      usuario: {
                        cls: "whitespace-nowrap px-3 py-4 xl:px-4",
                        node: (
                          <span className="inline-flex max-w-[150px] items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3 text-xs font-medium text-slate-600">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-500">
                              {iniciales(v.createdBy?.nombre)}
                            </span>
                            <span className="truncate" title={v.createdBy?.nombre}>
                              {v.createdBy?.nombre || "-"}
                            </span>
                          </span>
                        ),
                      },
                    };

                    return (
                      <tr
                        key={v._id}
                        className={`group transition-colors hover:bg-blue-50/40 ${anulada ? "bg-slate-50/80" : "bg-white"}`}
                      >
                        {columnasVisibles.map((k, i) => (
                          <td key={k} className={`${celdas[k].cls} ${i === 0 ? "pl-4 xl:pl-6" : ""}`}>
                            {celdas[k].node}
                          </td>
                        ))}

                        <td className="whitespace-nowrap px-4 py-4 xl:px-6">
                          <div className="flex flex-col items-end gap-1.5">
                            {pendienteRevision && (
                              <button
                                type="button"
                                onClick={() => marcarRevisionLeida(v)}
                                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-100 cursor-pointer"
                                title="Marcar revisión como leída"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Revisión pendiente
                              </button>
                            )}

                            <div className="flex justify-end gap-1.5 opacity-80 transition group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => abrirEdicion(v)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                                title="Editar venta"
                                aria-label="Editar venta"
                              >
                                <Pencil size={15} />
                              </button>
                              {anulada ? (
                                <button
                                  type="button"
                                  onClick={() => iniciarRehabilitacion(v)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 cursor-pointer"
                                  title="Rehabilitar venta"
                                  aria-label="Rehabilitar venta"
                                >
                                  <RotateCcw size={15} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const original = ventas.find((item) => item._id === v._id);
                                    if (original) setAccion({ modo: "anular", venta: original });
                                  }}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 cursor-pointer"
                                  title="Anular venta"
                                  aria-label="Anular venta"
                                >
                                  <Ban size={15} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const original = ventas.find((item) => item._id === v._id);
                                  if (original) setAccion({ modo: "eliminar", venta: original });
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                                title={isAdmin ? "Eliminar venta" : "Solicitar eliminación"}
                                aria-label={isAdmin ? "Eliminar venta" : "Solicitar eliminación"}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* MODAL SOLICITUDES */}
      {isAdmin && showSolicitudesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Solicitudes pendientes</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {solicitudesOrdenadas.length} en espera de revisión
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSolicitudesModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* CONTENIDO */}
            <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
              {solicitudesOrdenadas.length === 0 && (
                <div className="py-10 text-center text-sm text-slate-500">No hay solicitudes pendientes.</div>
              )}
              {solicitudesOrdenadas.map((s) => (
                <div
                  key={s._id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/50"
                  onClick={() => abrirSolicitud(s)}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {iniciales(s.venta?.tomador)}
                  </span>
                  <div className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                    <div className="truncate">{s.venta?.tomador || "Sin tomador"}</div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      SOLICITUD_BADGES[s.tipo] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {SOLICITUD_LABELS[s.tipo] || "Solicitud"}
                  </span>
                </div>
              ))}
            </div>

            {/* FOOTER */}
            <div className="flex justify-end border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setShowSolicitudesModal(false)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALES DE ACCIONES SOBRE UNA VENTA (un único estado: accion) */}
      {accion?.modo === "editar" && (
        <NuevaVenta
          modal
          modo="editar"
          venta={accion.venta}
          onClose={cerrarAccion}
          onSaved={(patch) => {
            if (patch?._id) {
              setVentas((prev) =>
                prev.map((v) =>
                  v._id === patch._id
                    ? {
                        ...v,
                        estadoRevision:
                          patch.estadoRevision !== undefined ? patch.estadoRevision : v.estadoRevision,
                      }
                    : v
                )
              );
            }

            setAccion(null);
            refrescarLibro();
          }}
        />
      )}

      {accion?.modo === "eliminar" && (
        <NuevaVenta
          modal
          modo="eliminar"
          venta={accion.venta}
          onClose={cerrarAccion}
          onSaved={(patch) => {
            // Borrado real → fuera de la tabla al instante; si fue solicitud solo se refresca.
            if (patch?.eliminada) {
              const id = patch._id;
              setVentas((prev) => prev.filter((v) => v._id !== id));
            }
            refrescarLibro();
          }}
        />
      )}

      {accion?.modo === "anular" && (
        <NuevaVenta
          modal
          modo="anular"
          venta={accion.venta}
          solicitud={accion.solicitud}
          onClose={cerrarAccion}
          onSaved={() => {
            setAccion(null);
            refrescarLibro();
          }}
        />
      )}

      {accion?.modo === "rehabilitar" && (
        <NuevaVenta
          modal
          modo="rehabilitar"
          venta={accion.venta}
          solicitud={accion.solicitud}
          onClose={cerrarAccion}
          onSaved={() => {
            setAccion(null);
            refrescarLibro();
          }}
        />
      )}

      {accion?.modo === "crear" && (
        <NuevaVenta modal onClose={cerrarAccion} onSaved={() => refrescarLibro()} />
      )}
    </div>
  );
}

/* =========================
   AUX
========================= */
function Select({ label, value, setValue, options }: any) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <select value={value} onChange={(e) => setValue(e.target.value)} className={FIELD}>
        <option value="ALL">Todos</option>
        {options.map((o: string) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function FiltroMes({ mes, setMes }: any) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">Mes</label>
      <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={FIELD}>
        {meses.map((m, i) => (
          <option key={i} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}

function FiltroAnio({ anio, setAnio }: any) {
  const y = new Date().getFullYear();
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">Año</label>
      <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={FIELD}>
        {[y - 2, y - 1, y, y + 1].map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}

function PeriodoSelector({ mes, anio, setMes, setAnio, minPeriodo, maxPeriodo }: any) {
  const isAdmin = JSON.parse(localStorage.getItem("user") || "{}")?.role === "admin";

  const prevDate = new Date(anio, mes - 2, 1);
  const nextDate = new Date(anio, mes, 1);

  const prevDisabled = !isAdmin && minPeriodo && prevDate < minPeriodo;

  const nextDisabled = !isAdmin && maxPeriodo && nextDate > maxPeriodo;

  const arrow =
    "flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer";

  return (
    <div className="flex items-center gap-2">
      {/* PERIODO ANTERIOR */}
      <button
        type="button"
        disabled={prevDisabled}
        onClick={() => {
          setMes(prevDate.getMonth() + 1);
          setAnio(prevDate.getFullYear());
        }}
        className={arrow}
        aria-label="Periodo anterior"
      >
        <ChevronLeft size={20} strokeWidth={2} />
      </button>

      {/* MES Y AÑO */}
      <div className="flex h-10 min-w-[180px] select-none items-center justify-center rounded-xl border border-blue-100 bg-blue-50 px-4">
        <span className="whitespace-nowrap text-sm font-bold text-blue-800">
          {mesNombre(mes)} {anio}
        </span>
      </div>

      {/* PERIODO SIGUIENTE */}
      <button
        type="button"
        disabled={nextDisabled}
        onClick={() => {
          setMes(nextDate.getMonth() + 1);
          setAnio(nextDate.getFullYear());
        }}
        className={arrow}
        aria-label="Periodo siguiente"
      >
        <ChevronRight size={20} strokeWidth={2} />
      </button>
    </div>
  );
}

const meses = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function mesNombre(mes: number) {
  return meses[mes - 1];
} 