import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Flag,
  LayoutGrid,
  List,
  Pencil,
  Phone,
  Pin,
  Plus,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import api from "../../services/api";
import { getSocket } from "../../services/socket";
import {
  addDias,
  diaSemanaIdx,
  horaAMinutos,
  horaEspana,
  hoyISO,
} from "../../utils/fechasES";

/* ======================================================
   TIPOS
====================================================== */
type TipoNota = "LLAMADA" | "AVISO" | "GESTION" | "OTRO";
type Prioridad = "NORMAL" | "ALTA" | "URGENTE";
type ColorNota = "amarillo" | "azul" | "verde" | "rosa" | "lila";

type Persona = { _id: string; nombre?: string; numma?: string };

type Nota = {
  _id: string;
  tipo: TipoNota;
  tipoPersonalizado?: string;
  titulo: string;
  detalle?: string;
  telefono?: string;
  dia?: string;
  hora?: string;
  prioridad: Prioridad;
  color: ColorNota;
  estado: "PENDIENTE" | "HECHA";
  hechaEn?: string;
  notaLlamada?: string;
  x?: number;
  y?: number;
  avisoMinutos: number;
  asignadoA: Persona | string;
  creadoPor: Persona | string;
  impuesta: boolean;
  leidaEn?: string;
};

type Usuario = {
  _id: string;
  nombre?: string;
  numma?: string;
  email?: string;
  role?: string;
};

type Toast = { id: number; texto: string };

type Filtro = "hoy" | "vencidas" | "sinfecha" | string; // string = YYYY-MM-DD

/* ======================================================
   CONSTANTES VISUALES
====================================================== */
const TIPOS: { id: TipoNota; label: string; icon: typeof Phone }[] = [
  { id: "LLAMADA", label: "Llamada", icon: Phone },
  { id: "AVISO", label: "Aviso", icon: Zap },
  { id: "GESTION", label: "Gestión", icon: ClipboardList },
  { id: "OTRO", label: "Personalizado", icon: Tag },
];

const COLORES: Record<ColorNota, { clase: string; punto: string }> = {
  amarillo: { clase: "from-[#fff4b3] to-[#ffe98a]", punto: "bg-[#ffe98a]" },
  azul: { clase: "from-[#dce9ff] to-[#bcd3fb]", punto: "bg-[#bcd3fb]" },
  verde: { clase: "from-[#d9f6e2] to-[#b3e8c4]", punto: "bg-[#b3e8c4]" },
  rosa: { clase: "from-[#ffe3ef] to-[#fbc2d9]", punto: "bg-[#fbc2d9]" },
  lila: { clase: "from-[#ebe3ff] to-[#d3c6fb]", punto: "bg-[#d3c6fb]" },
};

const PRIORIDADES: { id: Prioridad; label: string }[] = [
  { id: "NORMAL", label: "Normal" },
  { id: "ALTA", label: "Alta" },
  { id: "URGENTE", label: "Urgente" },
];

const AVISOS: { min: number; label: string }[] = [
  { min: 0, label: "Sin aviso" },
  { min: 5, label: "5 min antes" },
  { min: 10, label: "10 min antes" },
  { min: 30, label: "30 min antes" },
  { min: 60, label: "1 h antes" },
];

const CLAVE_VISTA = "agenda_vista";

/* ======================================================
   UTILIDADES
====================================================== */
const idDe = (p: Persona | string | undefined): string =>
  !p ? "" : typeof p === "string" ? p : p._id;

const nombreDe = (p: Persona | string | undefined): string =>
  !p || typeof p === "string" ? "" : p.nombre || p.numma || "";

const iniciales = (texto: string): string => {
  const t = texto.trim();
  if (!t) return "?";
  const partes = t.split(/\s+/);
  return (partes[0][0] + (partes[1]?.[0] || "")).toUpperCase();
};

const aMinutos = (hora: string): number => horaAMinutos(hora);

const aHora = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const fechaCorta = (iso: string): string =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date(`${iso}T12:00:00`))
    .replace(".", "");

const etiquetaDia = (iso: string, hoy: string): string => {
  if (iso === hoy) return "Hoy";
  if (iso === addDias(hoy, 1)) return "Mañana";
  if (iso === addDias(hoy, -1)) return "Ayer";
  const f = fechaCorta(iso);
  return f.charAt(0).toUpperCase() + f.slice(1);
};

const NOMBRE_DIA = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

const leerVista = (): "postits" | "lista" => {
  try {
    return localStorage.getItem(CLAVE_VISTA) === "lista" ? "lista" : "postits";
  } catch {
    return "postits";
  }
};

const leerUsuario = (): any => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    return {};
  }
};

const ordenar = (a: Nota, b: Nota): number => {
  const da = a.dia || "9999-99-99";
  const db = b.dia || "9999-99-99";
  if (da !== db) return da < db ? -1 : 1;
  const ha = a.hora || "99:99";
  const hb = b.hora || "99:99";
  if (ha !== hb) return ha < hb ? -1 : 1;
  const peso = { URGENTE: 0, ALTA: 1, NORMAL: 2 } as const;
  return peso[a.prioridad] - peso[b.prioridad];
};

/* ======================================================
   PÁGINA
====================================================== */
export default function Agenda() {
  const user = useMemo(() => leerUsuario(), []);
  const miId: string = String(user?._id || user?.id || "");
  const isAdmin = user?.role === "admin";
  const miNombre: string = user?.nombre || user?.name || "";

  const [notas, setNotas] = useState<Nota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [vista, setVista] = useState<"postits" | "lista">(leerVista);
  const [filtro, setFiltro] = useState<Filtro>("hoy");
  const [persona, setPersona] = useState<string>(isAdmin ? "todos" : "yo"); // admin: todos | id de empleado
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [hoy, setHoy] = useState<string>(hoyISO());
  const [ahoraMin, setAhoraMin] = useState<number>(horaEspana().minutos);

  const [focoId, setFocoId] = useState<string | null>(null);
  const [focoEditar, setFocoEditar] = useState(false);
  const [campanaAbierta, setCampanaAbierta] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const avisadas = useRef<Set<string>>(new Set());

  const meter = useCallback((texto: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 9000);
  }, []);

  /* ---------- reloj (cada 30 s) ---------- */
  useEffect(() => {
    const t = setInterval(() => {
      setHoy(hoyISO());
      setAhoraMin(horaEspana().minutos);
    }, 30000);
    return () => clearInterval(t);
  }, []);

  /* ---------- cargar ---------- */
  const cargar = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (isAdmin) params.usuarioId = persona;
      const res = await api.get("/agenda", { params });
      setNotas(Array.isArray(res.data) ? res.data : []);
      setError("");
    } catch {
      setError("No se han podido cargar las notas.");
    } finally {
      setCargando(false);
    }
  }, [isAdmin, persona]);

  useEffect(() => {
    setCargando(true);
    cargar();
  }, [cargar]);

  /* ---------- usuarios (solo admin) ---------- */
  useEffect(() => {
    if (!isAdmin) return;
    api
      .get("/users/asignables")
      .then((res) => setUsuarios(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [isAdmin]);

  /* ---------- tiempo real ---------- */
  const perteneceVista = useCallback(
    (n: Nota) => {
      const para = idDe(n.asignadoA);
      if (!isAdmin) return para === miId;
      if (persona === "todos") return true;
      if (persona === "yo") return para === miId;
      return para === persona;
    },
    [isAdmin, miId, persona]
  );

  const upsert = useCallback(
    (n: Nota) => {
      setNotas((prev) => {
        const sin = prev.filter((x) => x._id !== n._id);
        return perteneceVista(n) ? [...sin, n] : sin;
      });
    },
    [perteneceVista]
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onAsignada = (n: Nota) => {
      upsert(n);
      if (idDe(n.asignadoA) === miId && idDe(n.creadoPor) !== miId) {
        meter(`${nombreDe(n.creadoPor) || "Admin"} te ha mandado: ${n.titulo}`);
      }
    };
    const onActualizada = (n: Nota) => upsert(n);
    const onEliminada = (n: { _id: string }) =>
      setNotas((prev) => prev.filter((x) => x._id !== n._id));

    socket.on("AGENDA_ASIGNADA", onAsignada);
    socket.on("AGENDA_ACTUALIZADA", onActualizada);
    socket.on("AGENDA_ELIMINADA", onEliminada);

    return () => {
      socket.off("AGENDA_ASIGNADA", onAsignada);
      socket.off("AGENDA_ACTUALIZADA", onActualizada);
      socket.off("AGENDA_ELIMINADA", onEliminada);
    };
  }, [upsert, meter, miId]);

  /* ---------- avisos de hora (mientras la página está abierta) ---------- */
  useEffect(() => {
    notas.forEach((n) => {
      if (
        n.estado !== "PENDIENTE" ||
        idDe(n.asignadoA) !== miId ||
        n.dia !== hoy ||
        !n.hora ||
        !n.avisoMinutos
      )
        return;

      const objetivo = aMinutos(n.hora);
      const clave = `${n._id}|${n.dia}|${n.hora}`;

      if (
        ahoraMin >= objetivo - n.avisoMinutos &&
        ahoraMin <= objetivo + 5 &&
        !avisadas.current.has(clave)
      ) {
        avisadas.current.add(clave);
        const quedan = objetivo - ahoraMin;
        const texto =
          quedan > 0
            ? `En ${quedan} min (${n.hora}): ${n.titulo}`
            : `Ahora (${n.hora}): ${n.titulo}`;
        meter(texto);
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Agenda", { body: texto });
          }
        } catch {
          /* sin notificación del navegador */
        }
      }
    });
  }, [notas, ahoraMin, hoy, miId, meter]);

  /* ---------- acciones ---------- */
  const cambiar = async (id: string, cuerpo: Record<string, unknown>) => {
    try {
      const res = await api.patch(`/agenda/${id}`, cuerpo);
      setNotas((prev) => prev.map((n) => (n._id === id ? res.data : n)));
      return res.data as Nota;
    } catch (e: any) {
      meter(e?.response?.data?.message || "No se ha podido guardar el cambio.");
      return null;
    }
  };

  const borrar = async (id: string) => {
    try {
      await api.delete(`/agenda/${id}`);
      setNotas((prev) => prev.filter((n) => n._id !== id));
      return true;
    } catch (e: any) {
      meter(e?.response?.data?.message || "No se ha podido eliminar.");
      return false;
    }
  };

  const cambiarVista = (v: "postits" | "lista") => {
    setVista(v);
    try {
      localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      /* sin almacenamiento */
    }
  };

  /* ---------- derivados ---------- */
  const pendientes = useMemo(
    () => notas.filter((n) => n.estado === "PENDIENTE").sort(ordenar),
    [notas]
  );

  const vencidas = useMemo(
    () => pendientes.filter((n) => n.dia && n.dia < hoy),
    [pendientes, hoy]
  );

  const sinFecha = useMemo(() => pendientes.filter((n) => !n.dia), [pendientes]);

  const diasTira = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDias(hoy, i)),
    [hoy]
  );

  const cuentaDia = (iso: string) => pendientes.filter((n) => n.dia === iso).length;

  const hechasRecientes = useMemo(
    () =>
      notas
        .filter((n) => n.estado === "HECHA")
        .sort((a, b) => (b.hechaEn || "").localeCompare(a.hechaEn || "")),
    [notas]
  );

  type Grupo = { clave: string; titulo: string; tono: string; notas: Nota[] };

  const grupos = useMemo<Grupo[]>(() => {
    const out: Grupo[] = [];
    const sep = (clave: string, titulo: string, tono: string, lista: Nota[]) => {
      if (lista.length) out.push({ clave, titulo, tono, notas: lista });
    };

    if (filtro === "hoy") {
      const impuestasHoy = pendientes.filter(
        (n) => n.impuesta && idDe(n.asignadoA) === miId && (!n.dia || n.dia <= hoy)
      );
      const idsImp = new Set(impuestasHoy.map((n) => n._id));
      sep("imp", "Impuestas por el admin", "text-rose-700", impuestasHoy);
      sep("venc", "Vencidas", "text-rose-700", vencidas.filter((n) => !idsImp.has(n._id)));
      sep(
        "hoy",
        "Hoy",
        "text-slate-500",
        pendientes.filter((n) => n.dia === hoy && !idsImp.has(n._id))
      );
      sep(
        "prox",
        "Próximos días",
        "text-slate-500",
        pendientes.filter((n) => n.dia && n.dia > hoy)
      );
      sep(
        "sin",
        "Sin fecha",
        "text-slate-500",
        sinFecha.filter((n) => !idsImp.has(n._id))
      );
    } else if (filtro === "vencidas") {
      sep("venc", "Vencidas", "text-rose-700", vencidas);
    } else if (filtro === "sinfecha") {
      sep("sin", "Sin fecha", "text-slate-500", sinFecha);
    } else {
      sep(
        filtro,
        etiquetaDia(filtro, hoy),
        "text-slate-500",
        pendientes.filter((n) => n.dia === filtro)
      );
    }

    if (hechasRecientes.length && (filtro === "hoy" || filtro === hoy)) {
      sep("hechas", "Hechas recientemente", "text-emerald-700", hechasRecientes);
    }
    return out;
  }, [filtro, pendientes, vencidas, sinFecha, hechasRecientes, hoy, miId]);

  const visibles = useMemo(() => grupos.flatMap((g) => g.notas), [grupos]);

  const nuevas = useMemo(
    () =>
      pendientes.filter(
        (n) => n.impuesta && idDe(n.asignadoA) === miId && !n.leidaEn
      ),
    [pendientes, miId]
  );

  const siguiente = useMemo(() => {
    const mias = pendientes.filter(
      (n) => idDe(n.asignadoA) === miId && n.dia === hoy && n.hora
    );
    return (
      mias.find((n) => aMinutos(n.hora as string) >= ahoraMin - 15) || null
    );
  }, [pendientes, miId, hoy, ahoraMin]);

  const paraHoy = pendientes.filter((n) => n.dia === hoy).length;
  const nImpuestas = pendientes.filter(
    (n) => n.impuesta && idDe(n.asignadoA) === miId
  ).length;

  const saludo = (() => {
    const h = Math.floor(ahoraMin / 60);
    return h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
  })();

  /* ---------- mover post-its ---------- */
  const [destinoHover, setDestinoHover] = useState<string | null>(null);

  // Soltado sobre un día de la tira: cambia de día y vuelve a su sitio automático
  const moverADestino = async (id: string, destino: string) => {
    if (destino === "sinfecha") await cambiar(id, { dia: null, x: null, y: null });
    else if (destino !== "vencidas") await cambiar(id, { dia: destino, x: null, y: null });
  };

  // Soltado en el tablón: se guarda dónde lo ha dejado
  const moverPosicion = async (id: string, x: number, y: number) => {
    await cambiar(id, { x, y });
  };

  const abrirFoco = (n: Nota, editar = false) => {
    setFocoId(n._id);
    setFocoEditar(editar);
    if (idDe(n.asignadoA) === miId && !n.leidaEn && n.impuesta) {
      cambiar(n._id, { leida: true });
    }
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      meter("Teléfono copiado");
    } catch {
      meter("No se ha podido copiar");
    }
  };

  const empleados = useMemo(
    () =>
      usuarios.filter(
        (u) => u._id !== miId && (!u.role || u.role === "empleado")
      ),
    [usuarios, miId]
  );

  /* Crear desde la barra: se crea con lo mínimo y se abre para completarla */
  const crearRapida = async (
    tipo: TipoNota,
    titulo: string,
    tipoPersonalizado: string
  ) => {
    try {
      const res = await api.post("/agenda", {
        tipo,
        tipoPersonalizado: tipo === "OTRO" ? tipoPersonalizado : undefined,
        titulo,
        dia: /^\d{4}-/.test(filtro) ? filtro : hoy,
        asignadoA:
          isAdmin && persona !== "todos" ? [persona] : undefined,
      });
      const creada: Nota | undefined = Array.isArray(res.data) ? res.data[0] : undefined;
      if (creada) {
        upsert(creada);
        abrirFoco(creada, true);
      }
      return true;
    } catch (e: any) {
      meter(e?.response?.data?.message || "No se ha podido crear la nota.");
      return false;
    }
  };

  const notaFoco = notas.find((n) => n._id === focoId) || null;

  /* ======================================================
     RENDER
  ====================================================== */
  return (
    <div className="mx-auto w-full max-w-[1400px] pb-44 pt-5 md:pt-7">
      {/* AVISOS EMERGENTES */}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-[#cfd9fb] bg-white p-4 shadow-lg"
          >
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#2f5bd3]" />
            <p className="flex-1 text-sm font-medium text-slate-700">{t.texto}</p>
            <button
              type="button"
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* CABECERA */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
            {saludo}
            {miNombre ? `, ${miNombre.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {paraHoy} para hoy · {vencidas.length} vencidas
            {nImpuestas > 0 ? ` · ${nImpuestas} impuestas por el admin` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-full border border-slate-200 bg-white p-1">
            <BotonVista
              activo={vista === "postits"}
              onClick={() => cambiarVista("postits")}
              icono={<LayoutGrid size={15} />}
              texto="Post-its"
            />
            <BotonVista
              activo={vista === "lista"}
              onClick={() => cambiarVista("lista")}
              icono={<List size={15} />}
              texto="Lista"
            />
          </div>

          {/* CAMPANA */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCampanaAbierta((v) => !v)}
              className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
              aria-label="Avisos"
            >
              <Bell size={19} />
              {nuevas.length > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {nuevas.length}
                </span>
              )}
            </button>

            {campanaAbierta && (
              <div className="absolute right-0 top-14 z-50 w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="font-bold text-slate-900">Avisos</p>
                  <button
                    type="button"
                    onClick={() => setCampanaAbierta(false)}
                    className="text-slate-400 hover:text-slate-700"
                    aria-label="Cerrar"
                  >
                    <X size={16} />
                  </button>
                </div>

                {nuevas.length === 0 ? (
                  <p className="border-t border-slate-100 px-4 py-5 text-sm text-slate-500">
                    No tienes avisos nuevos.
                  </p>
                ) : (
                  nuevas.map((n) => (
                    <button
                      key={n._id}
                      type="button"
                      onClick={() => {
                        setCampanaAbierta(false);
                        abrirFoco(n);
                      }}
                      className="flex w-full cursor-pointer items-start gap-3 border-t border-slate-100 bg-[#f3f6ff] px-4 py-3 text-left hover:bg-[#e9efff]"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
                        !
                      </span>
                      <span className="text-sm text-slate-700">
                        <b>{nombreDe(n.creadoPor) || "Admin"}</b> te ha mandado «{n.titulo}»
                      </span>
                    </button>
                  ))
                )}

                {"Notification" in window && Notification.permission === "default" && (
                  <button
                    type="button"
                    onClick={() => Notification.requestPermission()}
                    className="w-full cursor-pointer border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-[#2f5bd3] hover:bg-slate-50"
                  >
                    Activar avisos del navegador
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADMIN: EMPLEADOS */}
      {isAdmin && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Empleado
          </span>
          {empleados.map((u) => (
            <ChipPersona
              key={u._id}
              activo={persona === u._id}
              onClick={() => setPersona(persona === u._id ? "todos" : u._id)}
            >
              {u.numma || u.nombre || u.email}
            </ChipPersona>
          ))}
          {persona !== "todos" && (
            <button
              type="button"
              onClick={() => setPersona("todos")}
              className="cursor-pointer rounded-full px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Quitar filtro ✕
            </button>
          )}
        </div>
      )}

      {/* TIRA DE DÍAS */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Pildora
          activo={filtro === "hoy"}
          onClick={() => setFiltro("hoy")}
          sup="TODO"
          grande="Hoy"
          n={pendientes.filter((n) => !n.dia || n.dia <= hoy).length}
          destino={hoy}
          resaltar={destinoHover === hoy}
        />
        {vencidas.length > 0 && (
          <Pildora
            activo={filtro === "vencidas"}
            onClick={() => setFiltro("vencidas")}
            sup="ATRASADAS"
            grande="Vencidas"
            n={vencidas.length}
            rojo
          />
        )}
        {diasTira.map((iso, i) => (
          <Pildora
            key={iso}
            activo={filtro === iso}
            onClick={() => setFiltro(iso)}
            sup={i === 0 ? "HOY" : NOMBRE_DIA[diaSemanaIdx(iso)]}
            grande={String(Number(iso.slice(8)))}
            n={cuentaDia(iso)}
            destino={iso}
            resaltar={destinoHover === iso}
          />
        ))}
        <Pildora
          activo={filtro === "sinfecha"}
          onClick={() => setFiltro("sinfecha")}
          sup="LIBRES"
          grande="Sin fecha"
          n={sinFecha.length}
          destino="sinfecha"
          resaltar={destinoHover === "sinfecha"}
        />
      </div>

      {/* SIGUIENTE */}
      {siguiente && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => abrirFoco(siguiente)}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              {siguiente.tipo === "LLAMADA" ? <Phone size={22} /> : <Bell size={22} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-rose-600">
                Siguiente ·{" "}
                {(() => {
                  const q = aMinutos(siguiente.hora as string) - ahoraMin;
                  return q > 0 ? `en ${q} min` : q === 0 ? "ahora" : `hace ${-q} min`;
                })()}
              </span>
              <span className="block truncate text-lg font-bold text-slate-900">
                {siguiente.titulo}
              </span>
              {siguiente.detalle && (
                <span className="block truncate text-sm text-slate-500">
                  {siguiente.detalle}
                </span>
              )}
            </span>
          </button>

          <div className="flex items-center gap-2">
            {siguiente.telefono && (
              <button
                type="button"
                onClick={() => copiar(siguiente.telefono as string)}
                className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                <Copy size={15} />
                Copiar {siguiente.telefono}
              </button>
            )}
            <button
              type="button"
              onClick={() => cambiar(siguiente._id, { estado: "HECHA" })}
              className="flex cursor-pointer items-center gap-2 rounded-full bg-[#2f5bd3] px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_20px_-10px_#2f5bd3] hover:bg-[#2851c0]"
            >
              <Check size={16} />
              Hecha
            </button>
          </div>
        </div>
      )}

      {/* CONTENIDO */}
      {error && (
        <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="py-16 text-center text-sm text-slate-400">Cargando…</p>
      ) : grupos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 py-16 text-center">
          <p className="text-lg font-bold text-slate-700">Todo al día</p>
          <p className="mt-1 text-sm text-slate-500">
            Escribe abajo para apuntar una llamada, un aviso o una gestión.
          </p>
        </div>
      ) : vista === "postits" ? (
        <Tablon
          notas={visibles.filter((n) => n.estado === "PENDIENTE")}
          hoy={hoy}
          ahoraMin={ahoraMin}
          miId={miId}
          isAdmin={isAdmin}
          onAbrir={(n) => abrirFoco(n)}
          onMarcar={(n) =>
            cambiar(n._id, {
              estado: n.estado === "HECHA" ? "PENDIENTE" : "HECHA",
            })
          }
          onMover={moverPosicion}
          onSoltarEn={moverADestino}
          onHover={setDestinoHover}
        />
      ) : (
        grupos.map((g) => (
          <section key={g.clave} className="mb-6">
            <h2 className={`mb-2 px-1 text-xs font-extrabold uppercase tracking-wider ${g.tono}`}>
              {g.titulo} · {g.notas.length}
            </h2>

            {(
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                {g.notas.map((n) => (
                  <FilaLista
                    key={n._id}
                    nota={n}
                    hoy={hoy}
                    ahoraMin={ahoraMin}
                    miId={miId}
                    isAdmin={isAdmin}
                    onAbrir={() => abrirFoco(n)}
                    onMarcar={() =>
                      cambiar(n._id, {
                        estado: n.estado === "HECHA" ? "PENDIENTE" : "HECHA",
                      })
                    }
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {/* BARRA DE NOTA RÁPIDA */}
      <Compositor onCrear={crearRapida} />

      {/* FOCO */}
      {notaFoco && (
        <Foco
          key={notaFoco._id}
          nota={notaFoco}
          hoy={hoy}
          miId={miId}
          isAdmin={isAdmin}
          empleados={empleados}
          empezarEditando={focoEditar}
          indice={visibles.findIndex((n) => n._id === notaFoco._id)}
          total={visibles.length}
          onCerrar={() => setFocoId(null)}
          onIr={(delta) => {
            const i = visibles.findIndex((n) => n._id === notaFoco._id);
            const destino = visibles[i + delta];
            if (destino) abrirFoco(destino);
          }}
          onCambiar={(cuerpo) => cambiar(notaFoco._id, cuerpo)}
          onBorrar={async () => {
            if (await borrar(notaFoco._id)) setFocoId(null);
          }}
          onCopiar={copiar}
          onSiguienteTrasHecha={() => {
            const i = visibles.findIndex((n) => n._id === notaFoco._id);
            const resto = visibles.filter(
              (n, k) => k !== i && n.estado === "PENDIENTE"
            );
            const despues = resto.find(
              (n) => visibles.indexOf(n) > i
            );
            const destino = despues || resto[0];
            if (destino) abrirFoco(destino);
            else setFocoId(null);
          }}
        />
      )}
    </div>
  );
}

/* ======================================================
   PIEZAS PEQUEÑAS
====================================================== */
function BotonVista({
  activo,
  onClick,
  icono,
  texto,
}: {
  activo: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
        activo
          ? "bg-[#2f5bd3] text-white shadow-[0_8px_16px_-8px_#2f5bd3]"
          : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {icono}
      {texto}
    </button>
  );
}

function ChipPersona({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
        activo
          ? "bg-[#e3eafb] text-[#2f5bd3]"
          : "border border-slate-200 bg-white text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function Pildora({
  activo,
  onClick,
  sup,
  grande,
  n,
  rojo,
  destino,
  resaltar,
}: {
  activo: boolean;
  onClick: () => void;
  sup: string;
  grande: string;
  n: number;
  rojo?: boolean;
  destino?: string;
  resaltar?: boolean;
}) {
  return (
    <button
      type="button"
      data-destino={destino}
      onClick={onClick}
      className={`flex min-w-[104px] flex-1 cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-left transition-all ${
        activo
          ? "bg-gradient-to-br from-[#4a76e8] to-[#2f5bd3] text-white shadow-[0_16px_26px_-14px_#2f5bd3]"
          : resaltar
          ? "border-2 border-[#2f5bd3] bg-[#e3eafb] scale-105"
          : "border border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span>
        <span
          className={`block text-[11px] font-extrabold tracking-wider ${
            activo ? "text-[#cfd9fb]" : "text-slate-400"
          }`}
        >
          {sup}
        </span>
        <span className="block text-lg font-extrabold leading-tight">{grande}</span>
      </span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
          activo
            ? "bg-white/25 text-white"
            : rojo
            ? "bg-rose-50 text-rose-700"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {n}
      </span>
    </button>
  );
}

function IconoTipo({ tipo, size = 14 }: { tipo: TipoNota; size?: number }) {
  if (tipo === "LLAMADA") return <Phone size={size} />;
  if (tipo === "AVISO") return <Zap size={size} />;
  if (tipo === "OTRO") return <Tag size={size} />;
  return <ClipboardList size={size} />;
}

const NOMBRE_TIPO: Record<TipoNota, string> = {
  LLAMADA: "Llamada",
  AVISO: "Aviso",
  GESTION: "Gestión",
  OTRO: "Otro",
};

const nombreTipo = (n: { tipo: TipoNota; tipoPersonalizado?: string }): string =>
  n.tipo === "OTRO" ? n.tipoPersonalizado || "Otro" : NOMBRE_TIPO[n.tipo];

function ChipFecha({
  nota,
  hoy,
  ahoraMin,
}: {
  nota: Nota;
  hoy: string;
  ahoraMin: number;
}) {
  if (nota.estado === "HECHA") {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-extrabold text-emerald-700">
        Hecha ✓
      </span>
    );
  }
  if (!nota.dia) {
    return (
      <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11.5px] font-extrabold text-slate-600">
        Sin fecha
      </span>
    );
  }
  const vencida =
    nota.dia < hoy ||
    (nota.dia === hoy && nota.hora && aMinutos(nota.hora) < ahoraMin);
  const texto =
    nota.dia === hoy
      ? nota.hora || "Hoy"
      : `${etiquetaDia(nota.dia, hoy)}${nota.hora ? ` · ${nota.hora}` : ""}`;
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold ${
        vencida ? "bg-white text-rose-700" : "bg-white/70 text-slate-600"
      }`}
    >
      {nota.dia < hoy ? "Vencida · " : ""}
      {texto}
    </span>
  );
}

function ChipPrioridad({ p }: { p: Prioridad }) {
  if (p === "NORMAL") return null;
  return (
    <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-extrabold text-rose-700">
      <span className="h-2 w-2 rounded-full bg-rose-500" />
      {p === "URGENTE" ? "Urgente" : "Alta"}
    </span>
  );
}

function etiquetaOrigen(n: Nota, miId: string, isAdmin: boolean): string | null {
  if (!n.impuesta) return null;
  if (idDe(n.asignadoA) === miId) return `Impuesta · ${nombreDe(n.creadoPor) || "Admin"}`;
  if (isAdmin) return `Mandada a ${nombreDe(n.asignadoA)}`;
  return null;
}

function PostIt({
  nota,
  hoy,
  ahoraMin,
  miId,
  isAdmin,
  onAbrir,
  onMarcar,
}: {
  nota: Nota;
  hoy: string;
  ahoraMin: number;
  miId: string;
  isAdmin: boolean;
  onAbrir: () => void;
  onMarcar: () => void;
}) {
  const impuestaAMi = nota.impuesta && idDe(nota.asignadoA) === miId;
  const color = impuestaAMi ? "rosa" : nota.color;
  const origen = etiquetaOrigen(nota, miId, isAdmin);
  const hecha = nota.estado === "HECHA";
  const ajena = idDe(nota.asignadoA) !== miId;

  return (
    <div
      onClick={onAbrir}
      className={`group relative flex cursor-pointer select-none flex-col rounded-[20px] rounded-br-[34px] bg-gradient-to-br p-4 shadow-[0_20px_26px_-18px_rgba(29,36,51,0.55)] transition-transform hover:-translate-y-0.5 ${COLORES[color].clase} ${
        hecha ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-900/60">
        <span className="flex items-center gap-1.5">
          {impuestaAMi ? <Pin size={12} /> : <IconoTipo tipo={nota.tipo} size={12} />}
          {origen || nombreTipo(nota)}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMarcar();
          }}
          aria-label={hecha ? "Marcar como pendiente" : "Marcar como hecha"}
          className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-2 transition-colors ${
            hecha
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-900/35 bg-white/40 hover:bg-white"
          }`}
        >
          {hecha && <Check size={12} strokeWidth={3} />}
        </button>
      </div>

      <h3
        className={`mt-2.5 text-[16.5px] font-extrabold leading-snug tracking-tight text-slate-900 ${
          hecha ? "line-through" : ""
        }`}
      >
        {nota.titulo}
      </h3>

      {nota.detalle && (
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-slate-700">
          {nota.detalle}
        </p>
      )}

      {nota.tipo === "LLAMADA" && nota.telefono && (
        <p className="mt-1.5 text-[13px] font-bold tracking-wide text-slate-800">
          {nota.telefono}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ChipPrioridad p={nota.prioridad} />
          <ChipFecha nota={nota} hoy={hoy} ahoraMin={ahoraMin} />
        </div>
        {ajena && (
          <span
            title={nombreDe(nota.asignadoA)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#2f5bd3] text-[10.5px] font-bold text-white"
          >
            {iniciales(nombreDe(nota.asignadoA))}
          </span>
        )}
      </div>
    </div>
  );
}

function FilaLista({
  nota,
  hoy,
  ahoraMin,
  miId,
  isAdmin,
  onAbrir,
  onMarcar,
}: {
  nota: Nota;
  hoy: string;
  ahoraMin: number;
  miId: string;
  isAdmin: boolean;
  onAbrir: () => void;
  onMarcar: () => void;
}) {
  const impuestaAMi = nota.impuesta && idDe(nota.asignadoA) === miId;
  const hecha = nota.estado === "HECHA";
  const origen = etiquetaOrigen(nota, miId, isAdmin);

  return (
    <div
      onClick={onAbrir}
      className={`flex cursor-pointer items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0 hover:bg-slate-50 ${
        impuestaAMi ? "shadow-[inset_5px_0_0_#e5484d]" : ""
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMarcar();
        }}
        aria-label={hecha ? "Marcar como pendiente" : "Marcar como hecha"}
        className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 ${
          hecha ? "border-[#2f5bd3] bg-[#2f5bd3] text-white" : "border-slate-300"
        }`}
      >
        {hecha && <Check size={12} strokeWidth={3} />}
      </button>

      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3eafb] text-[#2f5bd3]">
        <IconoTipo tipo={nota.tipo} size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[14.5px] font-bold text-slate-900 ${
            hecha ? "text-slate-400 line-through" : ""
          }`}
        >
          {nota.titulo}
        </p>
        <p className="truncate text-xs text-slate-500">
          {[origen, nota.telefono, nombreDe(nota.asignadoA) && isAdmin && idDe(nota.asignadoA) !== miId ? nombreDe(nota.asignadoA) : null, nota.detalle]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <ChipPrioridad p={nota.prioridad} />
        <ChipFecha nota={nota} hoy={hoy} ahoraMin={ahoraMin} />
      </div>
    </div>
  );
}

/* ======================================================
   TABLÓN: post-its que se colocan donde se quiera
   - Se arrastran con el ratón y se quedan donde se sueltan.
   - Soltados sobre un día de la tira, cambian de día.
   - En pantallas estrechas se muestran ordenados (sin arrastrar).
====================================================== */
const NW = 250; // ancho del post-it
const NH = 215; // alto estimado (reparto inicial)
const GAP = 20;

function Tablon({
  notas,
  hoy,
  ahoraMin,
  miId,
  isAdmin,
  onAbrir,
  onMarcar,
  onMover,
  onSoltarEn,
  onHover,
}: {
  notas: Nota[];
  hoy: string;
  ahoraMin: number;
  miId: string;
  isAdmin: boolean;
  onAbrir: (n: Nota) => void;
  onMarcar: (n: Nota) => void;
  onMover: (id: string, x: number, y: number) => Promise<void>;
  onSoltarEn: (id: string, destino: string) => Promise<void>;
  onHover: (destino: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [local, setLocal] = useState<Record<string, { x: number; y: number }>>({});
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [zs, setZs] = useState<Record<string, number>>({});
  const zTop = useRef(1);
  const drag = useRef<{
    id: string;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    lx: number;
    ly: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setAncho(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const libre = ancho >= 700;
  const cols = Math.max(1, Math.floor((ancho - GAP) / (NW + GAP)));

  const tienePos = (n: Nota) => typeof n.x === "number" && typeof n.y === "number";
  const sinPos = notas.filter((n) => !tienePos(n));

  const posDe = (n: Nota): { x: number; y: number } => {
    if (local[n._id]) return local[n._id];
    if (tienePos(n)) {
      return {
        x: Math.min((n.x as number) * ancho, Math.max(0, ancho - NW)),
        y: n.y as number,
      };
    }
    const i = sinPos.indexOf(n);
    return {
      x: GAP + (i % cols) * (NW + GAP),
      y: GAP + Math.floor(i / cols) * (NH + GAP),
    };
  };

  const alto = Math.max(
    560,
    ...notas.map((n) => posDe(n).y + NH + GAP)
  );

  const destinoBajo = (cx: number, cy: number): string | null => {
    for (const el of document.elementsFromPoint(cx, cy)) {
      const d = (el as HTMLElement).closest?.("[data-destino]") as HTMLElement | null;
      if (d) return d.dataset.destino || null;
    }
    return null;
  };

  const bajar = (e: React.PointerEvent<HTMLDivElement>, n: Nota) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = posDe(n);
    drag.current = {
      id: n._id,
      sx: e.clientX,
      sy: e.clientY,
      ox: p.x,
      oy: p.y,
      lx: p.x,
      ly: p.y,
      moved: false,
    };
    zTop.current += 1;
    const z = zTop.current;
    setZs((prev) => ({ ...prev, [n._id]: z }));
  };

  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    setArrastrando(d.id);
    d.lx = Math.max(0, Math.min(Math.max(0, ancho - NW), d.ox + dx));
    d.ly = Math.max(0, d.oy + dy);
    const pos = { x: d.lx, y: d.ly };
    setLocal((prev) => ({ ...prev, [d.id]: pos }));
    onHover(destinoBajo(e.clientX, e.clientY));
  };

  const limpiarLocal = (id: string) =>
    setLocal((prev) => {
      const { [id]: _quitado, ...resto } = prev;
      return resto;
    });

  const soltar = async (e: React.PointerEvent<HTMLDivElement>, n: Nota) => {
    const d = drag.current;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ya liberado */
    }
    onHover(null);
    setArrastrando(null);
    if (!d) return;

    if (!d.moved) {
      onAbrir(n);
      return;
    }

    const destino = destinoBajo(e.clientX, e.clientY);
    if (destino) {
      limpiarLocal(d.id);
      await onSoltarEn(d.id, destino);
    } else {
      await onMover(d.id, ancho > 0 ? d.lx / ancho : 0, d.ly);
      limpiarLocal(d.id);
    }
  };

  const cancelar = () => {
    const d = drag.current;
    drag.current = null;
    onHover(null);
    setArrastrando(null);
    if (d) limpiarLocal(d.id);
  };

  return (
    <div>
      {libre && (
        <p className="mb-2 px-1 text-xs text-slate-500">
          Arrastra los post-its y colócalos donde quieras. Suéltalos sobre un día de arriba para
          cambiarlos de día.
        </p>
      )}

      <div
        ref={ref}
        className={
          libre
            ? "relative overflow-hidden rounded-[28px] border border-slate-200 bg-white/70"
            : "grid grid-cols-1 gap-4 sm:grid-cols-2"
        }
        style={
          libre
            ? {
                height: alto,
                backgroundImage: "radial-gradient(#d3d9e8 1.2px, transparent 1.2px)",
                backgroundSize: "22px 22px",
              }
            : undefined
        }
      >
        {libre
          ? notas.map((n) => {
              const p = posDe(n);
              const activo = arrastrando === n._id;
              return (
                <div
                  key={n._id}
                  onPointerDown={(e) => bajar(e, n)}
                  onPointerMove={mover}
                  onPointerUp={(e) => soltar(e, n)}
                  onPointerCancel={cancelar}
                  style={{
                    position: "absolute",
                    left: p.x,
                    top: p.y,
                    width: NW,
                    zIndex: activo ? 9999 : zs[n._id] || 1,
                    touchAction: "none",
                  }}
                  className={`select-none ${
                    activo
                      ? "rotate-2 scale-105 cursor-grabbing"
                      : "cursor-grab transition-transform"
                  }`}
                >
                  <PostIt
                    nota={n}
                    hoy={hoy}
                    ahoraMin={ahoraMin}
                    miId={miId}
                    isAdmin={isAdmin}
                    onAbrir={() => undefined}
                    onMarcar={() => onMarcar(n)}
                  />
                </div>
              );
            })
          : notas.map((n) => (
              <PostIt
                key={n._id}
                nota={n}
                hoy={hoy}
                ahoraMin={ahoraMin}
                miId={miId}
                isAdmin={isAdmin}
                onAbrir={() => onAbrir(n)}
                onMarcar={() => onMarcar(n)}
              />
            ))}
      </div>
    </div>
  );
}

/* ======================================================
   BARRA DE NOTA RÁPIDA
   Eliges el tipo, escribes el título y Enter: se crea la nota
   y se abre para terminar de rellenarla.
====================================================== */
function Compositor({
  onCrear,
}: {
  onCrear: (
    tipo: TipoNota,
    titulo: string,
    tipoPersonalizado: string
  ) => Promise<boolean>;
}) {
  const [tipo, setTipo] = useState<TipoNota>("LLAMADA");
  const [tipoP, setTipoP] = useState("");
  const [titulo, setTitulo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    const t = titulo.trim();
    if (!t || guardando) return;
    setGuardando(true);
    const ok = await onCrear(tipo, t, tipoP.trim());
    if (ok) setTitulo("");
    setGuardando(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-[1000px] md:bottom-6">
      <div className="flex items-center gap-2 rounded-full bg-[#1d2433] p-2 pl-5 text-white shadow-[0_30px_50px_-20px_rgba(29,36,51,0.7)]">
        <Plus size={18} className="shrink-0 text-slate-400" />

        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") crear();
          }}
          placeholder={
            tipo === "LLAMADA"
              ? "¿A quién hay que llamar? Escribe y pulsa Enter"
              : tipo === "AVISO"
              ? "¿Qué no se te puede olvidar? Escribe y pulsa Enter"
              : tipo === "GESTION"
              ? "¿Qué gestión hay que hacer? Escribe y pulsa Enter"
              : "Escribe y pulsa Enter"
          }
          className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-slate-400"
        />

        <div className="hidden items-center gap-1 sm:flex">
          {tipo === "OTRO" && (
            <input
              value={tipoP}
              onChange={(e) => setTipoP(e.target.value)}
              maxLength={30}
              placeholder="Nombre del tipo"
              className="mr-1 w-36 rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-semibold outline-none placeholder:text-slate-400"
            />
          )}
          {TIPOS.map((t) => {
            const Icono = t.icon;
            const activo = tipo === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipo(t.id)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                  activo
                    ? "bg-white text-[#1d2433]"
                    : "bg-white/10 text-slate-300 hover:bg-white/20"
                }`}
              >
                <Icono size={13} />
                {t.label}
                {activo && <Check size={12} strokeWidth={3} />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={crear}
          disabled={guardando}
          className="cursor-pointer rounded-full bg-[#4a76e8] px-5 py-2 text-[13.5px] font-bold text-white hover:bg-[#3f69d6] disabled:opacity-60"
        >
          Crear
        </button>
      </div>

      {/* tipo en móvil (el admin puede usarlo desde el móvil) */}
      <div className="mt-2 flex flex-wrap justify-center gap-1 sm:hidden">
        {tipo === "OTRO" && (
          <input
            value={tipoP}
            onChange={(e) => setTipoP(e.target.value)}
            maxLength={30}
            placeholder="Nombre del tipo"
            className="w-36 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold outline-none"
          />
        )}
        {TIPOS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTipo(t.id)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold ${
              tipo === t.id ? "bg-[#1d2433] text-white" : "bg-white text-slate-600"
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
        {etiqueta}
      </span>
      {children}
    </label>
  );
}

/* ======================================================
   FOCO (la nota en grande)
====================================================== */
function Foco({
  nota,
  hoy,
  miId,
  isAdmin,
  empleados,
  empezarEditando,
  indice,
  total,
  onCerrar,
  onIr,
  onCambiar,
  onBorrar,
  onCopiar,
  onSiguienteTrasHecha,
}: {
  nota: Nota;
  hoy: string;
  miId: string;
  isAdmin: boolean;
  empleados: Usuario[];
  empezarEditando: boolean;
  indice: number;
  total: number;
  onCerrar: () => void;
  onIr: (delta: number) => void;
  onCambiar: (cuerpo: Record<string, unknown>) => Promise<Nota | null>;
  onBorrar: () => void;
  onCopiar: (t: string) => void;
  onSiguienteTrasHecha: () => void;
}) {
  const [editando, setEditando] = useState(empezarEditando);
  const [notaLlamada, setNotaLlamada] = useState(nota.notaLlamada || "");

  const [eTitulo, setETitulo] = useState(nota.titulo);
  const [eDetalle, setEDetalle] = useState(nota.detalle || "");
  const [eTel, setETel] = useState(nota.telefono || "");
  const [eDia, setEDia] = useState(nota.dia || "");
  const [eHora, setEHora] = useState(nota.hora || "");
  const [ePrio, setEPrio] = useState<Prioridad>(nota.prioridad);
  const [eTipo, setETipo] = useState<TipoNota>(nota.tipo);
  const [eTipoP, setETipoP] = useState(nota.tipoPersonalizado || "");
  const [eColor, setEColor] = useState<ColorNota>(nota.color);
  const [eAviso, setEAviso] = useState<number>(nota.avisoMinutos ?? 10);
  const [ePara, setEPara] = useState<string>(idDe(nota.asignadoA));

  const impuestaAMi = nota.impuesta && idDe(nota.asignadoA) === miId;
  const puedeEditarTodo = isAdmin || !impuestaAMi;
  const puedeBorrar = isAdmin || (idDe(nota.asignadoA) === miId && !nota.impuesta);
  const hecha = nota.estado === "HECHA";
  const color = impuestaAMi ? "rosa" : nota.color;
  const origen = etiquetaOrigen(nota, miId, isAdmin);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const escribiendo =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if (e.key === "Escape") onCerrar();
      if (!escribiendo && e.key === "ArrowRight") onIr(1);
      if (!escribiendo && e.key === "ArrowLeft") onIr(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar, onIr]);

  const guardarNotaLlamada = () => {
    if (notaLlamada.trim() !== (nota.notaLlamada || "")) {
      onCambiar({ notaLlamada });
    }
  };

  const marcarHecha = async () => {
    const res = await onCambiar({
      estado: hecha ? "PENDIENTE" : "HECHA",
      notaLlamada,
    });
    if (res && !hecha) onSiguienteTrasHecha();
  };

  const posponer = () => {
    const { minutos } = horaEspana();
    const total = minutos + 15;
    if (total >= 1440) {
      onCambiar({ dia: addDias(hoy, 1), hora: aHora(total - 1440) });
    } else {
      onCambiar({ dia: hoy, hora: aHora(total) });
    }
  };

  const guardarEdicion = async () => {
    const res = await onCambiar({
      titulo: eTitulo,
      detalle: eDetalle,
      telefono: eTel,
      tipo: eTipo,
      tipoPersonalizado: eTipo === "OTRO" ? eTipoP : undefined,
      dia: eDia || null,
      hora: eDia && eHora ? eHora : null,
      prioridad: ePrio,
      color: eColor,
      avisoMinutos: eDia && eHora ? eAviso : 0,
      ...(isAdmin && ePara && ePara !== idDe(nota.asignadoA)
        ? { asignadoA: ePara }
        : {}),
    });
    if (res) setEditando(false);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 md:p-6">
      <div
        className="absolute inset-0 bg-[#1d2433]/50 backdrop-blur-sm"
        onClick={onCerrar}
      />

      <div
        className={`relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-y-auto rounded-[34px] rounded-br-[64px] bg-gradient-to-br p-6 shadow-[0_60px_80px_-30px_rgba(0,0,0,0.6)] md:p-10 ${COLORES[color].clase}`}
      >
        {/* CABECERA */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wider text-slate-900/65">
            {impuestaAMi ? <Pin size={14} /> : <IconoTipo tipo={nota.tipo} size={14} />}
            {origen || nombreTipo(nota)}
            {nota.dia && (
              <> · {etiquetaDia(nota.dia, hoy)}
              {nota.hora ? ` ${nota.hora}` : ""}</>
            )}
          </span>

          <div className="flex items-center gap-2">
            <ChipPrioridad p={nota.prioridad} />
            {puedeEditarTodo && (
              <button
                type="button"
                onClick={() => setEditando((v) => !v)}
                aria-label="Editar"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/60 text-slate-700 hover:bg-white"
              >
                <Pencil size={16} />
              </button>
            )}
            {puedeBorrar && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("¿Eliminar esta nota?")) onBorrar();
                }}
                aria-label="Eliminar"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/60 text-rose-600 hover:bg-white"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/60 text-slate-700 hover:bg-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {editando ? (
          <div className="mt-5 space-y-5 rounded-3xl bg-white/85 p-5 md:p-6">
            <p className="text-sm font-semibold text-slate-600">
              Completa el post-it y pulsa <b>Guardar</b>.
            </p>

            <Campo etiqueta="Tipo">
              <div className="flex flex-wrap gap-2">
                {TIPOS.map((t) => {
                  const Icono = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setETipo(t.id)}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-bold ${
                        eTipo === t.id
                          ? "border-[#2f5bd3] bg-[#eef3ff] text-[#2f5bd3]"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      <Icono size={14} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {eTipo === "OTRO" && (
                <input
                  value={eTipoP}
                  onChange={(e) => setETipoP(e.target.value)}
                  maxLength={30}
                  placeholder="Escribe el nombre del tipo (ej. Reunión, Cobro…)"
                  className="mt-2 w-full max-w-sm rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                />
              )}
            </Campo>

            <Campo etiqueta="Qué hay que hacer">
              <input
                value={eTitulo}
                onChange={(e) => setETitulo(e.target.value)}
                className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-bold"
              />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              {eTipo === "LLAMADA" && (
                <Campo etiqueta="Teléfono">
                  <input
                    value={eTel}
                    onChange={(e) => setETel(e.target.value)}
                    placeholder="6XX XXX XXX"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm"
                  />
                </Campo>
              )}
              <Campo etiqueta="Detalle (opcional)">
                <input
                  value={eDetalle}
                  onChange={(e) => setEDetalle(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm"
                />
              </Campo>
            </div>

            <Campo etiqueta="Para cuándo">
              <div className="mb-2 flex flex-wrap gap-2">
                {[
                  { l: "Hoy", v: hoy },
                  { l: "Mañana", v: addDias(hoy, 1) },
                  { l: "Sin fecha", v: "" },
                ].map((o) => (
                  <button
                    key={o.l}
                    type="button"
                    onClick={() => setEDia(o.v)}
                    className={`cursor-pointer rounded-full border-2 px-4 py-2 text-sm font-bold ${
                      eDia === o.v
                        ? "border-[#2f5bd3] bg-[#eef3ff] text-[#2f5bd3]"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
                <input
                  type="date"
                  value={eDia}
                  onChange={(e) => setEDia(e.target.value)}
                  className="rounded-full border-2 border-slate-200 bg-white px-4 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={eHora}
                  disabled={!eDia}
                  onChange={(e) => setEHora(e.target.value)}
                  className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-40"
                />
                <select
                  value={eAviso}
                  disabled={!eDia || !eHora}
                  onChange={(e) => setEAviso(Number(e.target.value))}
                  className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-40"
                >
                  {AVISOS.map((a) => (
                    <option key={a.min} value={a.min}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">
                  Sin hora = solo aparece ese día
                </span>
              </div>
            </Campo>

            <div className="flex flex-wrap gap-6">
              <Campo etiqueta="Importancia">
                <div className="flex gap-2">
                  {PRIORIDADES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEPrio(p.id)}
                      className={`cursor-pointer rounded-full border-2 px-4 py-2 text-sm font-bold ${
                        ePrio === p.id
                          ? p.id === "NORMAL"
                            ? "border-[#2f5bd3] bg-[#eef3ff] text-[#2f5bd3]"
                            : "border-rose-500 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Campo>

              <Campo etiqueta="Color">
                <div className="flex gap-2">
                  {(Object.keys(COLORES) as ColorNota[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEColor(c)}
                      aria-label={c}
                      className={`h-9 w-9 cursor-pointer rounded-full ${COLORES[c].punto} ${
                        eColor === c ? "ring-2 ring-slate-900 ring-offset-2" : ""
                      }`}
                    />
                  ))}
                </div>
              </Campo>
            </div>

            {isAdmin && (
              <Campo etiqueta="Para quién">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEPara(idDe(nota.creadoPor))}
                    className={`cursor-pointer rounded-full border-2 px-4 py-2 text-sm font-bold ${
                      ePara === idDe(nota.creadoPor)
                        ? "border-[#2f5bd3] bg-[#eef3ff] text-[#2f5bd3]"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    Para mí
                  </button>
                  {empleados.map((u) => (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => setEPara(u._id)}
                      className={`cursor-pointer rounded-full border-2 px-4 py-2 text-sm font-bold ${
                        ePara === u._id
                          ? "border-[#2f5bd3] bg-[#eef3ff] text-[#2f5bd3]"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {u.numma || u.nombre || u.email}
                    </button>
                  ))}
                </div>
              </Campo>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={guardarEdicion}
                className="cursor-pointer rounded-full bg-[#2f5bd3] px-7 py-3 text-sm font-bold text-white shadow-[0_12px_20px_-10px_#2f5bd3] hover:bg-[#2851c0]"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="cursor-pointer rounded-full bg-slate-100 px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2
              className={`mt-6 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-5xl ${
                hecha ? "line-through opacity-60" : ""
              }`}
            >
              {nota.titulo}
            </h2>

            {nota.detalle && (
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-700 md:text-lg">
                {nota.detalle}
              </p>
            )}

            {nota.telefono && (
              <div className="mt-6 flex w-fit items-center gap-3 rounded-2xl bg-white/70 px-5 py-3">
                <span className="text-2xl font-extrabold tracking-wide text-slate-900">
                  {nota.telefono}
                </span>
                <button
                  type="button"
                  onClick={() => onCopiar(nota.telefono as string)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  <Copy size={14} />
                  Copiar
                </button>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm font-semibold text-slate-700">
              {nota.avisoMinutos > 0 && nota.hora && (
                <span>🔔 Aviso {nota.avisoMinutos} min antes</span>
              )}
              <span>
                <Flag size={13} className="mr-1 inline" />
                {nombreDe(nota.asignadoA) || "Yo"}
              </span>
            </div>

            <textarea
              value={notaLlamada}
              onChange={(e) => setNotaLlamada(e.target.value)}
              onBlur={guardarNotaLlamada}
              rows={2}
              placeholder={
                nota.tipo === "LLAMADA"
                  ? "✏️ Anota cómo ha ido la llamada…"
                  : "✏️ Añadir una nota…"
              }
              className="mt-5 w-full max-w-xl resize-none rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:bg-white"
            />
          </>
        )}

        {/* ACCIONES (no se muestran mientras se crea o edita) */}
        {!editando && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={marcarHecha}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-[#2f5bd3] px-7 py-3.5 text-base font-bold text-white shadow-[0_12px_20px_-10px_#2f5bd3] hover:bg-[#2851c0]"
          >
            <Check size={18} />
            {hecha ? "Reabrir" : "Hecha"}
          </button>

          {!hecha && (
            <>
              <button
                type="button"
                onClick={posponer}
                className="cursor-pointer rounded-full bg-white/80 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-white"
              >
                Posponer 15 min
              </button>
              <button
                type="button"
                onClick={() =>
                  onCambiar({ dia: addDias(hoy, 1), hora: nota.hora || undefined })
                }
                className="cursor-pointer rounded-full bg-white/80 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-white"
              >
                Pasar a mañana
              </button>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs font-bold text-slate-600 sm:block">
              {indice >= 0 ? `${indice + 1} / ${total}` : ""}
            </span>
            <button
              type="button"
              onClick={() => onIr(-1)}
              disabled={indice <= 0}
              aria-label="Anterior"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/80 text-slate-700 hover:bg-white disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => onIr(1)}
              disabled={indice < 0 || indice >= total - 1}
              aria-label="Siguiente"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/80 text-slate-700 hover:bg-white disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}