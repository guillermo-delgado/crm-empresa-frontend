import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import api from "../../../services/api";
import BolsaHoras from "./BolsaHoras";
import {
  AlertCircle,
  Ban,
  Briefcase,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  FileText,
  Hourglass,
  ListChecks,
  Loader2,
  Plane,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  addDias,
  claveFecha,
  diaSemanaIdx,
  diasDelMes as diasDelMesES,
  esFinDeSemana,
  etiquetaMes,
  formatFechaES,
  hoyISO,
  horaAMinutos,
  huecosIniciales,
  mesActualISO,
  minutosAHoras,
  nombreDia,
  parseISO,
  sumarMes,
} from "../../../utils/fechasES";

/* =========================
   TIPOS
========================= */
type Empleado = {
  _id: string;
  nombre: string;
  apellidos?: string;
};

type Estado = "VACACIONES" | "DIA_LIBRE" | "BAJA" | "FESTIVO";
type Turno = "MANANA" | "TARDE" | "MANANA_TARDE";

type Fichaje = {
  tipo: "ENTRADA" | "SALIDA";
  hora: string; // "HH:mm"
  motivo?: string; // motivo de pausa (en la SALIDA que la inicia)
};

type DiaCalendario = {
  fecha: string;
  estado: Estado | null;
  minutosTrabajados: number;
  turno?: Turno | null;

  horaEntradaManana?: string | null;
  horaSalidaManana?: string | null;
  horaEntradaTarde?: string | null;
  horaSalidaTarde?: string | null;

  fichajes: Fichaje[];
};

type RespuestaHorario = {
  dias: DiaCalendario[];
  horasTrabajadas: number;
  balanceMinutos: number;
  minutosAplicadosMes: number;
  minutosTeoricosMes: number;
  horasContratadasSemana: number;
  maxDiasVacaciones: number;
  diasVacacionesUsados: number;
};

/** Un tramo trabajado: de una ENTRADA a su SALIDA. */
type Tramo = {
  id: number;
  entrada: string;
  salida: string;
  /** Motivo de la pausa que sigue a este tramo (se guarda en su SALIDA) */
  motivo: string;
};

type Aviso = { tipo: "ok" | "error"; texto: string };

const SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

const ETIQUETA_ESTADO: Record<Estado, string> = {
  VACACIONES: "Vacaciones",
  DIA_LIBRE: "Día libre",
  FESTIVO: "Festivo",
  BAJA: "Baja",
};

const ETIQUETA_TURNO: Record<Turno, string> = {
  MANANA: "Mañana",
  TARDE: "Tarde",
  MANANA_TARDE: "Mañana / Tarde",
};

const MOTIVOS_PAUSA = [
  "Médico",
  "Gestión personal",
  "Recado",
  "Descanso",
  "Reunión externa",
];

/* =========================
   HELPERS (puros)
========================= */
const diaVacio = (fecha: string): DiaCalendario => ({
  fecha,
  estado: null,
  minutosTrabajados: 0,
  turno: null,
  fichajes: [],
});

const mensajeError = (e: any, defecto: string) =>
  e?.response?.data?.message ?? defecto;

/** "+1h 05min" / "-25min" / "0min" */
const formatearBalance = (minutos: number) => {
  if (!minutos) return "0min";
  const signo = minutos > 0 ? "+" : "-";
  const abs = Math.abs(Math.round(minutos));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0
    ? `${signo}${h}h ${String(m).padStart(2, "0")}min`
    : `${signo}${m}min`;
};

const minutosEntreHoras = (entrada: string, salida: string) =>
  horaAMinutos(salida) - horaAMinutos(entrada);

const horaOk = (h: string) => /^\d{1,2}:\d{2}$/.test(h) && h !== "00:00";

let contadorTramos = 1;
const nuevoTramo = (entrada = "", salida = "", motivo = ""): Tramo => ({
  id: contadorTramos++,
  entrada,
  salida,
  motivo,
});

/** Convierte los fichajes sueltos del día en tramos entrada→salida. */
const fichajesATramos = (fichajes: Fichaje[]): Tramo[] => {
  const lista = fichajes
    .map((f, i) => ({ ...f, i }))
    .filter((f) => f.hora && f.hora !== "00:00")
    .sort(
      (a, b) => horaAMinutos(a.hora) - horaAMinutos(b.hora) || a.i - b.i
    );

  const tramos: Tramo[] = [];
  let actual: Tramo | null = null;

  for (const f of lista) {
    if (f.tipo === "ENTRADA") {
      if (actual) tramos.push(actual);
      actual = nuevoTramo(f.hora, "", "");
    } else if (actual) {
      actual.salida = f.hora;
      actual.motivo = f.motivo ?? "";
      tramos.push(actual);
      actual = null;
    } else {
      // Salida sin entrada: se conserva para no perder datos
      tramos.push(nuevoTramo("", f.hora, f.motivo ?? ""));
    }
  }
  if (actual) tramos.push(actual);

  return tramos;
};

/** Orden por hora de entrada (los incompletos al final). */
const ordenarTramos = (tramos: Tramo[]) =>
  [...tramos].sort((a, b) => {
    const ka = a.entrada || a.salida || "99:99";
    const kb = b.entrada || b.salida || "99:99";
    return horaAMinutos(ka) - horaAMinutos(kb);
  });

/** Devuelve un texto de error o null si los tramos son correctos. */
const validarTramos = (tramos: Tramo[]): string | null => {
  for (const t of tramos) {
    if (t.entrada && !horaOk(t.entrada))
      return "Hay una hora de entrada inválida (no se admite 00:00).";
    if (t.salida && !horaOk(t.salida))
      return "Hay una hora de salida inválida (no se admite 00:00).";
    if (t.entrada && t.salida && minutosEntreHoras(t.entrada, t.salida) <= 0)
      return `La salida (${t.salida}) debe ser posterior a la entrada (${t.entrada}).`;
  }

  const completos = ordenarTramos(tramos).filter((t) => t.entrada && t.salida);
  for (let i = 1; i < completos.length; i++) {
    if (
      horaAMinutos(completos[i].entrada) <= horaAMinutos(completos[i - 1].salida)
    ) {
      return `Los tramos ${completos[i - 1].entrada}-${completos[i - 1].salida} y ${completos[i].entrada}-${completos[i].salida} se solapan o se tocan.`;
    }
  }
  return null;
};

const resumenTramos = (tramos: Tramo[]) => {
  const completos = ordenarTramos(tramos).filter(
    (t) => horaOk(t.entrada) && horaOk(t.salida)
  );
  let trabajado = 0;
  let pausas = 0;
  completos.forEach((t, i) => {
    const m = minutosEntreHoras(t.entrada, t.salida);
    if (m > 0) trabajado += m;
    if (i > 0) {
      const gap = horaAMinutos(t.entrada) - horaAMinutos(completos[i - 1].salida);
      // Solo cuenta como pausa si la salida anterior tiene motivo; un hueco
      // sin motivo es simplemente el descanso entre dos turnos.
      if (gap > 0 && completos[i - 1].motivo.trim()) pausas += gap;
    }
  });
  return { trabajado, pausas };
};

/* =========================
   COMPONENTE
========================= */
export default function HorarioCRM() {
  /* ---------- estado principal ---------- */
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoId, setEmpleadoId] = useState<string>("ALL");
  const [mes, setMes] = useState<string>(() => mesActualISO());

  const [dias, setDias] = useState<DiaCalendario[]>([]);
  const [horasTrabajadas, setHorasTrabajadas] = useState<number>(0);
  const [balanceMinutos, setBalanceMinutos] = useState<number>(0);
  const [aplicadosMes, setAplicadosMes] = useState<number>(0);
  const [teoricosMes, setTeoricosMes] = useState<number>(0);
  const [horasContratadasSemana, setHorasContratadasSemana] =
    useState<number>(40);
  const [maxDiasVacaciones, setMaxDiasVacaciones] = useState<number>(30);
  const [vacacionesUsadas, setVacacionesUsadas] = useState<number>(0);

  const [mostrarConfig, setMostrarConfig] = useState<boolean>(false);
  const [mostrarBolsa, setMostrarBolsa] = useState<boolean>(false);
  const [mostrarContrato, setMostrarContrato] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  /* ---------- modales de un día ---------- */
  const [modoModal, setModoModal] = useState<"ACCIONES" | "JORNADAS" | null>(
    null
  );
  const [diaActivo, setDiaActivo] = useState<DiaCalendario | null>(null);
  const [horasManana, setHorasManana] = useState({ entrada: "", salida: "" });
  const [horasTarde, setHorasTarde] = useState({ entrada: "", salida: "" });

  /* ---------- fichajes (tramos + pausas) ---------- */
  const [tramos, setTramos] = useState<Tramo[]>([]);
  const [errorTramos, setErrorTramos] = useState<string | null>(null);
  const [pausaForm, setPausaForm] = useState({
    desde: "",
    hasta: "",
    motivo: "",
  });
  const [guardandoFichajes, setGuardandoFichajes] = useState(false);

  /* ---------- selección en masa ---------- */
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [ultimoClick, setUltimoClick] = useState<string | null>(null);
  const [bulkTurno, setBulkTurno] = useState<Turno | "">("");
  const [bulkManana, setBulkManana] = useState({ entrada: "", salida: "" });
  const [bulkTarde, setBulkTarde] = useState({ entrada: "", salida: "" });
  const [guardandoMasivo, setGuardandoMasivo] = useState(false);

  const peticion = useRef(0);
  const hoy = hoyISO();

  const { y: year, m: mes1 } = parseISO(`${mes}-01`);

  /* ---------- avisos ---------- */
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4500);
    return () => clearTimeout(t);
  }, [aviso]);

  /* ---------- cerrar modal con Escape ---------- */
  useEffect(() => {
    if (!modoModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modoModal]);

  const cerrarModal = () => {
    setModoModal(null);
    setDiaActivo(null);
    setErrorTramos(null);
  };

  /* ---------- precargar horas del modal Acciones ---------- */
  useEffect(() => {
    if (modoModal !== "ACCIONES" || !diaActivo) return;
    setHorasManana({
      entrada: diaActivo.horaEntradaManana ?? "",
      salida: diaActivo.horaSalidaManana ?? "",
    });
    setHorasTarde({
      entrada: diaActivo.horaEntradaTarde ?? "",
      salida: diaActivo.horaSalidaTarde ?? "",
    });
    // solo al abrir (o cambiar de día), no al pulsar un turno
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoModal, diaActivo?.fecha]);

  /* ---------- precargar tramos del modal Fichajes ---------- */
  useEffect(() => {
    if (modoModal !== "JORNADAS" || !diaActivo) return;
    setTramos(fichajesATramos(diaActivo.fichajes ?? []));
    setErrorTramos(null);
    setPausaForm({ desde: "", hasta: "", motivo: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoModal, diaActivo?.fecha]);

  /* =========================
     GUARDAR CONFIGURACIÓN
  ========================= */
  const guardarConfiguracion = async () => {
    if (empleadoId === "ALL") return;

    try {
      await api.put(`/users/${empleadoId}/config`, {
        horasContratadasSemana,
        maxDiasVacaciones,
      });
      setMostrarConfig(false);
      setAviso({ tipo: "ok", texto: "Configuración guardada" });
      cargarHorario();
    } catch (e) {
      setAviso({
        tipo: "error",
        texto: mensajeError(e, "No se pudo guardar la configuración"),
      });
    }
  };

  /* =========================
     CARGAR EMPLEADOS
  ========================= */
  useEffect(() => {
    api
      .get("/crm/horario/empleados")
      .then((res) => setEmpleados(res.data))
      .catch((err) => {
        console.error("ERROR USERS", err.response?.status);
        setEmpleados([]);
      });
  }, []);

  /* =========================
     CARGAR CONFIGURACIÓN EMPLEADO
  ========================= */
  useEffect(() => {
    if (empleadoId === "ALL") {
      setHorasContratadasSemana(40);
      setMaxDiasVacaciones(30);
      return;
    }

    api
      .get(`/users/${empleadoId}`)
      .then((res) => {
        setHorasContratadasSemana(res.data.horasContratadasSemana ?? 40);
        setMaxDiasVacaciones(res.data.maxDiasVacaciones ?? 30);
      })
      .catch(() => {
        setHorasContratadasSemana(40);
        setMaxDiasVacaciones(30);
      });
  }, [empleadoId]);

  /* =========================
     CARGAR HORARIO
  ========================= */
  const normalizarDias = (lista: DiaCalendario[]) =>
    (lista ?? []).map((d) => ({
      ...d,
      minutosTrabajados: d.minutosTrabajados ?? 0,
      fichajes: d.fichajes ?? [],
    }));

  const cargarHorario = async () => {
    const id = ++peticion.current;
    setLoading(true);

    try {
      if (empleadoId === "ALL") {
        const res = await api.get("/crm/horario/calendario-general", {
          params: { mes },
        });
        if (id !== peticion.current) return;

        setDias(normalizarDias(res.data.dias));
        setHorasTrabajadas(res.data.horasTrabajadas ?? 0);
        setBalanceMinutos(res.data.balanceMinutos ?? 0);
        setAplicadosMes(0);
        setTeoricosMes(0);
        setVacacionesUsadas(0);
        return;
      }

      const res = await api.get<RespuestaHorario>("/crm/horario", {
        params: { mes, empleadoId },
      });
      if (id !== peticion.current) return;

      setDias(normalizarDias(res.data.dias));
      setHorasTrabajadas(res.data.horasTrabajadas ?? 0);
      setHorasContratadasSemana(res.data.horasContratadasSemana ?? 40);
      setMaxDiasVacaciones(res.data.maxDiasVacaciones ?? 30);
      setVacacionesUsadas(res.data.diasVacacionesUsados ?? 0);
      setBalanceMinutos(res.data.balanceMinutos ?? 0);
      setAplicadosMes(res.data.minutosAplicadosMes ?? 0);
      setTeoricosMes(res.data.minutosTeoricosMes ?? 0);
    } catch (e) {
      if (id !== peticion.current) return;
      setDias([]);
      setHorasTrabajadas(0);
      setBalanceMinutos(0);
      setAplicadosMes(0);
      setTeoricosMes(0);
      setAviso({
        tipo: "error",
        texto: mensajeError(e, "No se pudo cargar el horario"),
      });
    } finally {
      if (id === peticion.current) setLoading(false);
    }
  };

  useEffect(() => {
    cargarHorario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, empleadoId]);

  /* =========================
     ACCIONES SOBRE UN DÍA
  ========================= */
  const empleadoPayload = empleadoId === "ALL" ? null : empleadoId;

  const marcarDia = async (estado: Estado | null, turno?: Turno) => {
    if (!diaActivo) return;

    // Botones de estado → guardan directamente
    if (estado) {
      try {
        await api.post("/crm/horario/dia", {
          fecha: diaActivo.fecha,
          empleadoId: empleadoPayload,
          estado,
          turno: null,
          horasManana: null,
          horasTarde: null,
        });
        cerrarModal();
        cargarHorario();
      } catch (e) {
        setAviso({
          tipo: "error",
          texto: mensajeError(e, "No se pudo marcar el día"),
        });
      }
      return;
    }

    // Botones de turno → solo selección (se guarda con "Guardar horario")
    setDiaActivo({
      ...diaActivo,
      estado: null,
      turno: turno ?? null,
      horaEntradaManana: null,
      horaSalidaManana: null,
      horaEntradaTarde: null,
      horaSalidaTarde: null,
    });
  };

  const guardarHorario = async () => {
    if (!diaActivo) return;

    if (!diaActivo.turno && !diaActivo.estado) {
      setAviso({ tipo: "error", texto: "Elige primero un turno" });
      return;
    }

    try {
      await api.post("/crm/horario/dia", {
        fecha: diaActivo.fecha,
        empleadoId: empleadoPayload,
        estado: diaActivo.estado ?? null,
        turno: diaActivo.estado ? null : diaActivo.turno,
        horasManana: diaActivo.estado
          ? null
          : diaActivo.turno === "MANANA" || diaActivo.turno === "MANANA_TARDE"
          ? horasManana
          : null,
        horasTarde: diaActivo.estado
          ? null
          : diaActivo.turno === "TARDE" || diaActivo.turno === "MANANA_TARDE"
          ? horasTarde
          : null,
      });

      cerrarModal();
      await cargarHorario();
    } catch (e) {
      setAviso({
        tipo: "error",
        texto: mensajeError(e, "No se pudo guardar el horario"),
      });
    }
  };

  const eliminarMarca = async () => {
    if (!diaActivo) return;

    try {
      await api.delete("/crm/horario/dia", {
        data: { fecha: diaActivo.fecha, empleadoId: empleadoPayload },
      });
      cerrarModal();
      cargarHorario();
    } catch (e) {
      setAviso({
        tipo: "error",
        texto: mensajeError(e, "No se pudo eliminar la marca"),
      });
    }
  };

  /* =========================
     FICHAJES: tramos y pausas
  ========================= */
  const cambiarTramo = (id: number, cambios: Partial<Tramo>) => {
    setTramos((prev) => prev.map((t) => (t.id === id ? { ...t, ...cambios } : t)));
    setErrorTramos(null);
  };

  const quitarTramo = (id: number) => {
    setTramos((prev) => prev.filter((t) => t.id !== id));
    setErrorTramos(null);
  };

  const anadirTramo = () => {
    setTramos((prev) => [...prev, nuevoTramo()]);
    setErrorTramos(null);
  };

  /** Une un tramo con el siguiente (elimina la pausa que hay entre ambos). */
  const quitarPausa = (id: number) => {
    setTramos((prev) => {
      const lista = ordenarTramos(prev);
      const i = lista.findIndex((t) => t.id === id);
      if (i < 0 || i >= lista.length - 1) return prev;
      const a = lista[i];
      const b = lista[i + 1];
      const unido: Tramo = {
        ...a,
        salida: b.salida,
        motivo: b.motivo,
      };
      return [...lista.slice(0, i), unido, ...lista.slice(i + 2)];
    });
    setErrorTramos(null);
  };

  /** Inserta una pausa dentro de un tramo trabajado (lo parte en dos). */
  const anadirPausa = () => {
    const { desde, hasta, motivo } = pausaForm;

    if (!horaOk(desde) || !horaOk(hasta)) {
      setErrorTramos("Indica la hora de inicio y de fin de la pausa.");
      return;
    }
    if (horaAMinutos(hasta) <= horaAMinutos(desde)) {
      setErrorTramos("El fin de la pausa debe ser posterior al inicio.");
      return;
    }

    const lista = ordenarTramos(tramos);
    const idx = lista.findIndex(
      (t) =>
        horaOk(t.entrada) &&
        horaAMinutos(t.entrada) < horaAMinutos(desde) &&
        (t.salida === "" || horaAMinutos(t.salida) > horaAMinutos(hasta))
    );

    if (idx < 0) {
      setErrorTramos(
        "La pausa debe quedar dentro de un tramo trabajado (entre una entrada y su salida)."
      );
      return;
    }

    const t = lista[idx];
    // Sin motivo se guarda como "Pausa": así se distingue de un hueco entre turnos
    const antes: Tramo = nuevoTramo(t.entrada, desde, motivo.trim() || "Pausa");
    const despues: Tramo = nuevoTramo(hasta, t.salida, t.motivo);

    setTramos([...lista.slice(0, idx), antes, despues, ...lista.slice(idx + 1)]);
    setPausaForm({ desde: "", hasta: "", motivo: "" });
    setErrorTramos(null);
  };

  const guardarFichajes = async () => {
    if (!diaActivo || empleadoId === "ALL") return;

    const error = validarTramos(tramos);
    if (error) {
      setErrorTramos(error);
      return;
    }

    const lista = ordenarTramos(tramos);
    const nuevos: Fichaje[] = [];
    for (const t of lista) {
      if (t.entrada) nuevos.push({ tipo: "ENTRADA", hora: t.entrada });
      if (t.salida) {
        nuevos.push({
          tipo: "SALIDA",
          hora: t.salida,
          ...(t.motivo.trim() ? { motivo: t.motivo.trim() } : {}),
        });
      }
    }

    if (
      nuevos.length === 0 &&
      (diaActivo.fichajes?.length ?? 0) > 0 &&
      !window.confirm("¿Dejar este día sin ningún fichaje?")
    ) {
      return;
    }

    setGuardandoFichajes(true);
    try {
      await api.post("/crm/fichajes", {
        empleadoId,
        fecha: diaActivo.fecha,
        fichajes: nuevos,
      });

      await cargarHorario();
      cerrarModal();
      setAviso({ tipo: "ok", texto: "Fichajes guardados" });
    } catch (e) {
      setErrorTramos(mensajeError(e, "No se pudieron guardar los fichajes"));
    } finally {
      setGuardandoFichajes(false);
    }
  };

  /* =========================
     SELECCIÓN EN MASA
  ========================= */
  const fechasDelMes = useMemo(
    () => diasDelMesES(year, mes1).map((n) => claveFecha(year, mes1, n)),
    [year, mes1]
  );

  const alternarModoSeleccion = () => {
    setModoSeleccion((v) => !v);
    setSeleccion(new Set());
    setUltimoClick(null);
    setBulkTurno("");
  };

  const clickDiaSeleccion = (fecha: string, conShift: boolean) => {
    setSeleccion((prev) => {
      const n = new Set(prev);

      if (conShift && ultimoClick) {
        const [a, b] = ultimoClick <= fecha ? [ultimoClick, fecha] : [fecha, ultimoClick];
        for (let d = a; d <= b; d = addDias(d, 1)) n.add(d);
      } else if (n.has(fecha)) {
        n.delete(fecha);
      } else {
        n.add(fecha);
      }
      return n;
    });
    setUltimoClick(fecha);
  };

  const seleccionarFiltro = (filtro: (fecha: string) => boolean) => {
    setSeleccion((prev) => {
      const n = new Set(prev);
      fechasDelMes.filter(filtro).forEach((f) => n.add(f));
      return n;
    });
  };

  /** Pulsar una letra de la cabecera marca/desmarca ese día de la semana. */
  const alternarDiaSemana = (idxLunes: number) => {
    const delDia = fechasDelMes.filter(
      (f) => (diaSemanaIdx(f) + 6) % 7 === idxLunes
    );
    setSeleccion((prev) => {
      const n = new Set(prev);
      const todos = delDia.every((f) => n.has(f));
      delDia.forEach((f) => (todos ? n.delete(f) : n.add(f)));
      return n;
    });
  };

  const textoDestino =
    empleadoId === "ALL"
      ? "todos los empleados (calendario general)"
      : empleados.find((e) => e._id === empleadoId)?.nombre ?? "el empleado";

  /** Días de vacaciones que aún se pueden aplicar este año (solo empleado). */
  const vacacionesRestantes =
    empleadoId === "ALL" ? Infinity : Math.max(0, maxDiasVacaciones - vacacionesUsadas);

  const aplicarMasivo = async (
    payload: Record<string, unknown>,
    descripcion: string,
    pedirConfirmacion: boolean
  ) => {
    if (seleccion.size === 0) return;

    const fechas = [...seleccion].sort();

    if (fechas.length > 62) {
      setAviso({ tipo: "error", texto: "Máximo 62 días por operación" });
      return;
    }

    // Vacaciones: no dejar pasar del máximo (el backend lo vuelve a comprobar)
    if (payload.estado === "VACACIONES" && empleadoId !== "ALL") {
      const nuevas = fechas.filter(
        (f) =>
          f.startsWith(`${year}-`) && mapaDias.get(f)?.estado !== "VACACIONES"
      ).length;
      if (nuevas > vacacionesRestantes) {
        setAviso({
          tipo: "error",
          texto:
            vacacionesRestantes === 0
              ? `Ya tiene aplicados los ${maxDiasVacaciones} días de vacaciones de ${year}`
              : `Solo quedan ${vacacionesRestantes} días de vacaciones en ${year}`,
        });
        return;
      }
    }

    if (
      pedirConfirmacion &&
      !window.confirm(
        `${descripcion} ${
          fechas.length === 1
            ? "el día seleccionado"
            : `los ${fechas.length} días seleccionados`
        } (${textoDestino})?`
      )
    ) {
      return;
    }

    setGuardandoMasivo(true);
    try {
      await api.post("/crm/horario/dias-masivo", {
        ...payload,
        fechas,
        empleadoId: empleadoPayload,
      });

      setSeleccion(new Set());
      setUltimoClick(null);
      await cargarHorario();
      setAviso({
        tipo: "ok",
        texto: `Aplicado a ${fechas.length} ${fechas.length === 1 ? "día" : "días"}`,
      });
    } catch (e) {
      setAviso({
        tipo: "error",
        texto: mensajeError(e, "No se pudo aplicar a los días seleccionados"),
      });
    } finally {
      setGuardandoMasivo(false);
    }
  };

  const aplicarTurnoMasivo = () => {
    if (!bulkTurno) {
      setAviso({ tipo: "error", texto: "Elige primero un turno" });
      return;
    }

    const tramoIncompleto = (t: { entrada: string; salida: string }) =>
      (t.entrada === "") !== (t.salida === "");
    const usaManana = bulkTurno === "MANANA" || bulkTurno === "MANANA_TARDE";
    const usaTarde = bulkTurno === "TARDE" || bulkTurno === "MANANA_TARDE";

    if (
      (usaManana && tramoIncompleto(bulkManana)) ||
      (usaTarde && tramoIncompleto(bulkTarde))
    ) {
      setAviso({
        tipo: "error",
        texto: "Completa entrada y salida, o deja ambas vacías",
      });
      return;
    }

    aplicarMasivo(
      {
        accion: "MARCAR",
        turno: bulkTurno,
        horasManana: usaManana ? bulkManana : null,
        horasTarde: usaTarde ? bulkTarde : null,
      },
      `¿Asignar el turno ${ETIQUETA_TURNO[bulkTurno]} a`,
      true
    );
  };

  /* =========================
     HELPERS DE CALENDARIO
  ========================= */
  const mapaDias = useMemo(() => {
    const m = new Map<string, DiaCalendario>();
    dias.forEach((d) => m.set(d.fecha.slice(0, 10), d));
    return m;
  }, [dias]);

  const offset = huecosIniciales(year, mes1);

  /** Objetivo diario: horas manuales > turno > reparto semanal. */
  const calcularObjetivoDia = (dia: DiaCalendario) => {
    const { horaEntradaManana: em, horaSalidaManana: sm } = dia;
    const { horaEntradaTarde: et, horaSalidaTarde: st } = dia;

    if (em && sm && et && st) {
      return minutosEntreHoras(em, sm) + minutosEntreHoras(et, st);
    }
    if (em && sm) return minutosEntreHoras(em, sm);
    if (et && st) return minutosEntreHoras(et, st);

    if (dia.turno === "MANANA") return 240;
    if (dia.turno === "TARDE") return 240;
    if (dia.turno === "MANANA_TARDE") return 480;

    return Math.round((horasContratadasSemana * 60) / 5);
  };

  const calcularBalanceDia = (dia: DiaCalendario) => {
    if (!dia.turno) return null;
    if (!dia.minutosTrabajados) return null;
    return dia.minutosTrabajados - calcularObjetivoDia(dia);
  };

  const claseDia = (fecha: string, dia?: DiaCalendario) => {
    const finde = esFinDeSemana(fecha);
    if (dia?.estado === "VACACIONES") return "bg-blue-50 border-blue-300";
    if (dia?.estado === "BAJA") return "bg-red-50 border-red-300";
    if (dia?.estado === "FESTIVO") return "bg-purple-50 border-purple-300";
    if (dia?.estado === "DIA_LIBRE" && !finde)
      return "bg-orange-50 border-orange-300";
    if (finde) return "bg-slate-100/70 border-slate-200";
    return "bg-white border-slate-200";
  };

  const abrirDia = (fecha: string, modo: "ACCIONES" | "JORNADAS") => {
    setDiaActivo(mapaDias.get(fecha) ?? diaVacio(fecha));
    setModoModal(modo);
  };

  const cambiarMes = (delta: number) => setMes((m) => sumarMes(m, delta));

  const resumen = resumenTramos(tramos);
  const nSeleccion = seleccion.size;

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="space-y-6 pb-28">
      {/* TÍTULO */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[1.65rem] font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <span className="grid place-items-center h-11 w-11 rounded-2xl bg-[#2f5bd3] text-white shadow-[0_10px_22px_-10px_rgba(47,91,211,0.7)]">
            <CalendarDays size={21} />
          </span>
          Gestión de empleados
        </h1>

        {loading && (
          <span className="text-sm text-slate-500 animate-pulse">
            Cargando datos…
          </span>
        )}
      </div>

      {/* AVISO */}
      {aviso && (
        <div
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm font-medium border ${
            aviso.tipo === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {aviso.texto}
        </div>
      )}

      {/* SELECTORES */}
      <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-white border border-slate-200/70 shadow-[0_14px_34px_-24px_rgba(29,36,51,0.3)] p-3">
        {/* Empleado */}
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#f1f3f8] pl-2 pr-1 py-1">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d5ddf0] text-xs font-bold text-[#2f5bd3]"
          >
            {empleadoId === "ALL" ? (
              <Users size={16} />
            ) : (
              (() => {
                const emp = empleados.find((e) => e._id === empleadoId);
                const ini = `${emp?.nombre?.[0] ?? ""}${emp?.apellidos?.[0] ?? ""}`;
                return ini.toUpperCase() || "·";
              })()
            )}
          </span>
          <select
            value={empleadoId}
            onChange={(e) => {
              setEmpleadoId(e.target.value);
              setMostrarConfig(false);
              setSeleccion(new Set());
              setUltimoClick(null);
            }}
            className="bg-transparent rounded-xl px-2 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2f5bd3]/30 cursor-pointer"
          >
            <option value="ALL">Todos los empleados</option>
            {empleados.map((e) => (
              <option key={e._id} value={e._id}>
                {e.nombre} {e.apellidos ?? ""}
              </option>
            ))}
          </select>
        </div>

        {/* Mes */}
        <div className="flex items-center gap-1.5 rounded-2xl bg-[#f1f3f8] p-1">
          <button
            onClick={() => cambiarMes(-1)}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-600 shadow-sm hover:text-[#2f5bd3] active:scale-95 transition cursor-pointer"
            title="Mes anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <input
            type="month"
            value={mes}
            onChange={(e) => e.target.value && setMes(e.target.value)}
            className="bg-transparent rounded-xl px-2 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2f5bd3]/30"
          />

          <button
            onClick={() => cambiarMes(1)}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-600 shadow-sm hover:text-[#2f5bd3] active:scale-95 transition cursor-pointer"
            title="Mes siguiente"
          >
            <ChevronRight size={18} />
          </button>

          <button
            onClick={() => setMes(mesActualISO())}
            disabled={mes === mesActualISO()}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-[#2f5bd3] hover:bg-white transition cursor-pointer disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Hoy
          </button>
        </div>

        {/* Acciones */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {empleadoId !== "ALL" && (
            <button
              onClick={() => setMostrarBolsa((v) => !v)}
              aria-expanded={mostrarBolsa}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border transition cursor-pointer ${
                mostrarBolsa
                  ? "bg-[#2f5bd3] text-white border-[#2f5bd3] shadow-[0_10px_22px_-12px_rgba(47,91,211,0.8)]"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Hourglass size={16} />
              Bolsa de horas
            </button>
          )}

          {empleadoId !== "ALL" && (
            <button
              onClick={() => setMostrarContrato((v) => !v)}
              aria-expanded={mostrarContrato}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border transition cursor-pointer ${
                mostrarContrato
                  ? "bg-[#2f5bd3] text-white border-[#2f5bd3] shadow-[0_10px_22px_-12px_rgba(47,91,211,0.8)]"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <FileText size={16} />
              Control de contrato
            </button>
          )}

          <button
            onClick={alternarModoSeleccion}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border transition cursor-pointer ${
              modoSeleccion
                ? "bg-[#2f5bd3] text-white border-[#2f5bd3] shadow-[0_10px_22px_-12px_rgba(47,91,211,0.8)]"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <ListChecks size={16} />
            {modoSeleccion ? "Salir de selección" : "Selección múltiple"}
          </button>

          {empleadoId !== "ALL" && (
            <button
              onClick={() => setMostrarConfig((v) => !v)}
              className={`rounded-full px-4 py-2 text-sm font-semibold border transition cursor-pointer ${
                mostrarConfig
                  ? "bg-[#e3eafb] text-[#2f5bd3] border-[#c9d6f6]"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Editar empleado
            </button>
          )}
        </div>
      </div>

      {/* RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Resumen
          icono={<Briefcase size={20} />}
          estilo="bg-[#e3eafb] text-[#2f5bd3]"
          titulo="Horas contratadas / semana"
          valor={empleadoId === "ALL" ? "-" : `${horasContratadasSemana} h`}
        />
        <Resumen
          icono={<Clock size={20} />}
          estilo="bg-emerald-50 text-emerald-600"
          titulo="Horas trabajadas"
          valor={empleadoId === "ALL" ? "-" : minutosAHoras(horasTrabajadas)}
          detalle={
            empleadoId === "ALL"
              ? undefined
              : `${formatearBalance(balanceMinutos)} sobre las ${minutosAHoras(teoricosMes)} del mes`
          }
          tono={
            empleadoId === "ALL" || balanceMinutos === 0
              ? "normal"
              : balanceMinutos < 0
              ? "malo"
              : "bueno"
          }
        />
        <Resumen
          icono={<Plane size={20} />}
          estilo="bg-sky-50 text-sky-600"
          titulo="Máx. vacaciones"
          valor={empleadoId === "ALL" ? "-" : `${maxDiasVacaciones} días`}
          tono={
            empleadoId !== "ALL" && vacacionesUsadas > maxDiasVacaciones
              ? "malo"
              : empleadoId !== "ALL" &&
                maxDiasVacaciones > 0 &&
                vacacionesUsadas === maxDiasVacaciones
              ? "bueno"
              : "normal"
          }
          detalle={
            empleadoId === "ALL"
              ? undefined
              : vacacionesUsadas > maxDiasVacaciones
              ? `Se pasa ${vacacionesUsadas - maxDiasVacaciones} días (${vacacionesUsadas} aplicados en ${year})`
              : vacacionesUsadas === maxDiasVacaciones
              ? `Todos aplicados en ${year}`
              : `Faltan ${maxDiasVacaciones - vacacionesUsadas} por aplicar (${vacacionesUsadas} en ${year})`
          }
        />
        <Resumen
          icono={<ListChecks size={20} />}
          estilo="bg-violet-50 text-violet-600"
          titulo="Jornadas aplicadas (mes)"
          valor={empleadoId === "ALL" ? "-" : minutosAHoras(aplicadosMes)}
          detalle={
            empleadoId === "ALL"
              ? undefined
              : aplicadosMes === teoricosMes
              ? `Cuadra con las ${minutosAHoras(teoricosMes)} del mes`
              : aplicadosMes < teoricosMes
              ? `Faltan ${minutosAHoras(teoricosMes - aplicadosMes)} por aplicar (mes: ${minutosAHoras(teoricosMes)})`
              : `Te pasas ${minutosAHoras(aplicadosMes - teoricosMes)}: extras previstas (mes: ${minutosAHoras(teoricosMes)})`
          }
          tono={
            empleadoId === "ALL" || aplicadosMes === teoricosMes
              ? "normal"
              : aplicadosMes < teoricosMes
              ? "malo"
              : "bueno"
          }
        />
      </div>

      {/* BOLSA DE HORAS (se despliega con el botón de la barra superior) */}
      {empleadoId !== "ALL" && mostrarBolsa && (
        <BolsaHoras empleadoId={empleadoId} mes={mes} />
      )}

      {/* AYUDA SELECCIÓN */}
      {modoSeleccion && (
        <div className="rounded-3xl bg-[#2f5bd3]/5 border border-[#2f5bd3]/20 p-4 space-y-3">
          <div className="text-sm text-slate-600">
            Pulsa los días para marcarlos. Con <b>Mayús + clic</b> seleccionas un
            rango, y pulsando la <b>letra del día de la semana</b> marcas toda la
            columna.
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip onClick={() => seleccionarFiltro((f) => !esFinDeSemana(f))}>
              Laborables (L-V)
            </Chip>
            <Chip onClick={() => seleccionarFiltro((f) => esFinDeSemana(f))}>
              Fines de semana
            </Chip>
            <Chip onClick={() => seleccionarFiltro((f) => f >= hoy)}>
              Desde hoy
            </Chip>
            <Chip onClick={() => seleccionarFiltro(() => true)}>Todo el mes</Chip>
            <Chip
              onClick={() => {
                setSeleccion(new Set());
                setUltimoClick(null);
              }}
              suave
            >
              Limpiar selección
            </Chip>
          </div>
        </div>
      )}

      {/* CONTROL DE CONTRATO (oculta el calendario mientras está abierto) */}
      {empleadoId !== "ALL" && mostrarContrato && (
        <ControlContrato
          empleadoId={empleadoId}
          mes={mes}
          horasContratadasSemana={horasContratadasSemana}
        />
      )}

      {/* CALENDARIO */}
      {!(empleadoId !== "ALL" && mostrarContrato) && (
      <div className="bg-white rounded-3xl border border-slate-200/70 shadow-[0_14px_34px_-24px_rgba(29,36,51,0.3)] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xl font-bold capitalize tracking-tight text-slate-900">
            {etiquetaMes(year, mes1)}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
            {[
              ["bg-blue-300", "Vacaciones"],
              ["bg-red-300", "Baja"],
              ["bg-purple-300", "Festivo"],
              ["bg-orange-300", "Libre"],
              ["bg-slate-300", "Fin de semana"],
            ].map(([punto, texto]) => (
              <span key={texto} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${punto}`} />
                {texto}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2.5 text-center text-sm">
          {SEMANA.map((d, i) =>
            modoSeleccion ? (
              <button
                key={d}
                onClick={() => alternarDiaSemana(i)}
                className="font-semibold text-[#2f5bd3] rounded-lg py-1 hover:bg-[#2f5bd3]/10 cursor-pointer"
                title="Marcar toda la columna"
              >
                {d}
              </button>
            ) : (
              <div
                key={d}
                className="py-1 text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                {d}
              </div>
            )
          )}

          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {fechasDelMes.map((fecha) => {
            const n = parseISO(fecha).d;
            const dia = mapaDias.get(fecha);
            const marcado = seleccion.has(fecha);
            const esHoy = fecha === hoy;

            return (
              <div key={fecha} className="relative group">
                <button
                  onClick={(e) =>
                    modoSeleccion
                      ? clickDiaSeleccion(fecha, e.shiftKey)
                      : abrirDia(fecha, "ACCIONES")
                  }
                  className={`
                    h-full min-h-[7.75rem] w-full cursor-pointer rounded-2xl border
                    flex flex-col items-stretch gap-2 text-left
                    px-2.5 py-2 font-semibold transition
                    hover:shadow-[0_10px_22px_-14px_rgba(29,36,51,0.45)] hover:-translate-y-px
                    ${claseDia(fecha, dia)}
                    ${esHoy ? "ring-2 ring-[#2f5bd3]/60" : ""}
                    ${marcado ? "ring-2 ring-offset-1 ring-[#2f5bd3] bg-[#2f5bd3]/10" : ""}
                  `}
                >
                  {/* CABECERA: día · balance */}
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-sm leading-none ${
                        esHoy ? "bg-[#2f5bd3] text-white" : "text-slate-800"
                      }`}
                    >
                      {n}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {empleadoId !== "ALL" &&
                        dia &&
                        dia.turno &&
                        (() => {
                          const balance = calcularBalanceDia(dia);
                          if (balance === null) return null;
                          return (
                            <span
                              className={`rounded-full px-2 py-[2px] text-[11px] font-semibold leading-none ${
                                balance === 0
                                  ? "bg-emerald-50 text-emerald-700"
                                  : balance < 0
                                  ? "bg-red-50 text-red-600"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {balance === 0 ? "OK" : formatearBalance(balance)}
                            </span>
                          );
                        })()}

                      {modoSeleccion && (
                        <span
                          className={`grid place-items-center h-4 w-4 rounded-full border ${
                            marcado
                              ? "bg-[#2f5bd3] border-[#2f5bd3] text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {marcado && <Check size={10} strokeWidth={3} />}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CUERPO: horas trabajadas · horario del turno */}
                  <div className="flex flex-col gap-1">
                    {empleadoId !== "ALL" && dia && dia.minutosTrabajados > 0 && (
                      <div className="text-[15px] font-bold leading-none text-slate-900">
                        {Math.floor(dia.minutosTrabajados / 60)}h{" "}
                        {String(dia.minutosTrabajados % 60).padStart(2, "0")}m
                      </div>
                    )}

                    {dia?.turno === "MANANA" &&
                      dia.horaEntradaManana &&
                      dia.horaSalidaManana && (
                        <div className="text-[11px] font-medium leading-tight text-slate-500 tabular-nums">
                          {dia.horaEntradaManana} – {dia.horaSalidaManana}
                        </div>
                      )}

                    {dia?.turno === "TARDE" &&
                      dia.horaEntradaTarde &&
                      dia.horaSalidaTarde && (
                        <div className="text-[11px] font-medium leading-tight text-slate-500 tabular-nums">
                          {dia.horaEntradaTarde} – {dia.horaSalidaTarde}
                        </div>
                      )}

                    {dia?.turno === "MANANA_TARDE" &&
                      (dia.horaEntradaManana || dia.horaEntradaTarde) && (
                        <>
                          <div className="text-[11px] font-medium leading-tight text-slate-500 tabular-nums">
                            {dia.horaEntradaManana} – {dia.horaSalidaManana}
                          </div>
                          <div className="text-[11px] font-medium leading-tight text-slate-500 tabular-nums">
                            {dia.horaEntradaTarde} – {dia.horaSalidaTarde}
                          </div>
                        </>
                      )}

                    {/* turno sin horas definidas: solo el nombre */}
                    {dia?.turno &&
                      !(dia.horaEntradaManana || dia.horaEntradaTarde) && (
                        <div className="text-[11px] font-medium leading-tight text-slate-500">
                          {ETIQUETA_TURNO[dia.turno]}
                        </div>
                      )}
                  </div>
                </button>

                {/* HOVER ACCIONES (no en selección múltiple) */}
                {empleadoId !== "ALL" && !modoSeleccion && (
                  <div
                    className="
                      absolute inset-0 bg-slate-900/55
                      opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
                      transition flex items-center justify-center
                      rounded-2xl overflow-hidden z-10 pointer-events-none
                      group-hover:pointer-events-auto group-focus-within:pointer-events-auto
                    "
                  >
                    <div className="flex flex-col gap-1 w-full px-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirDia(fecha, "JORNADAS");
                        }}
                        className="text-[11px] py-1 rounded-lg bg-white hover:bg-slate-100 cursor-pointer w-full"
                      >
                        Fichajes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirDia(fecha, "ACCIONES");
                        }}
                        className="text-[11px] py-1 rounded-lg bg-white hover:bg-slate-100 cursor-pointer w-full"
                      >
                        Acciones
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* CONFIGURACIÓN EMPLEADO */}
      {mostrarConfig && empleadoId !== "ALL" && (
        <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-lg">Configuración del empleado</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-slate-500">
                Horas contratadas / semana
              </label>
              <input
                type="number"
                value={horasContratadasSemana}
                onChange={(e) =>
                  setHorasContratadasSemana(Number(e.target.value) || 0)
                }
                className="w-full border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm text-slate-500">
                Máx. días de vacaciones
              </label>
              <input
                type="number"
                value={maxDiasVacaciones}
                onChange={(e) =>
                  setMaxDiasVacaciones(Number(e.target.value) || 0)
                }
                className="w-full border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setMostrarConfig(false)}
              className="text-sm text-slate-500 px-3 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={guardarConfiguracion}
              className="bg-[#2f5bd3] hover:bg-[#2650bd] text-white rounded-xl px-5 py-2 text-sm font-medium cursor-pointer"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      )}

      {/* PANEL SELECCIÓN MÚLTIPLE */}
      {modoSeleccion && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(960px,calc(100%-2rem))] bg-white rounded-3xl border border-slate-200 shadow-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800">
              {nSeleccion === 0
                ? "Ningún día seleccionado"
                : `${nSeleccion} ${nSeleccion === 1 ? "día seleccionado" : "días seleccionados"}`}
              <span className="font-normal text-slate-500">
                {" "}
                · para {textoDestino}
              </span>
            </div>
            {nSeleccion > 0 && (
              <button
                onClick={() => {
                  setSeleccion(new Set());
                  setUltimoClick(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          <fieldset
            disabled={nSeleccion === 0 || guardandoMasivo}
            className="space-y-3 disabled:opacity-50"
          >
            {/* TURNO */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-400 w-14">
                Turno
              </span>
              {(["MANANA", "TARDE", "MANANA_TARDE"] as Turno[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setBulkTurno(t)}
                  className={`rounded-xl px-3 py-1.5 text-sm border transition cursor-pointer ${
                    bulkTurno === t
                      ? "bg-[#2f5bd3] text-white border-[#2f5bd3]"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {ETIQUETA_TURNO[t]}
                </button>
              ))}
            </div>

            {(bulkTurno === "MANANA" || bulkTurno === "MANANA_TARDE") && (
              <HorasInputs
                titulo="Mañana"
                valor={bulkManana}
                onChange={setBulkManana}
              />
            )}
            {(bulkTurno === "TARDE" || bulkTurno === "MANANA_TARDE") && (
              <HorasInputs
                titulo="Tarde"
                valor={bulkTarde}
                onChange={setBulkTarde}
              />
            )}

            {bulkTurno && (
              <button
                onClick={aplicarTurnoMasivo}
                className="bg-[#2f5bd3] hover:bg-[#2650bd] text-white rounded-xl px-5 py-2 text-sm font-medium cursor-pointer"
              >
                Aplicar horario a {nSeleccion}{" "}
                {nSeleccion === 1 ? "día" : "días"}
              </button>
            )}

            {/* ESTADO */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-400 w-14">
                Estado
              </span>
              {(["VACACIONES", "DIA_LIBRE", "FESTIVO", "BAJA"] as Estado[]).map(
                (est) => (
                  <button
                    key={est}
                    disabled={est === "VACACIONES" && vacacionesRestantes === 0}
                    title={
                      est === "VACACIONES" && vacacionesRestantes === 0
                        ? "Ya tiene todos los días de vacaciones aplicados"
                        : undefined
                    }
                    onClick={() =>
                      aplicarMasivo(
                        { accion: "MARCAR", estado: est },
                        `¿Marcar como ${ETIQUETA_ESTADO[est].toLowerCase()}`,
                        true
                      )
                    }
                    className="rounded-xl px-3 py-1.5 text-sm border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {ETIQUETA_ESTADO[est]}
                  </button>
                )
              )}
              <button
                onClick={() =>
                  aplicarMasivo(
                    { accion: "ELIMINAR" },
                    "¿Quitar turno y estado de",
                    true
                  )
                }
                className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border border-red-300 text-red-600 bg-white hover:bg-red-50 transition cursor-pointer"
              >
                <Trash2 size={14} />
                Quitar marcas
              </button>
            </div>
          </fieldset>
        </div>
      )}

      {/* MODAL ACCIONES */}
      {diaActivo && modoModal === "ACCIONES" && (
        <Modal onClose={cerrarModal} ancho="w-[420px]">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {formatFechaES(diaActivo.fecha)}
              </h2>
              <div className="text-sm text-slate-500 capitalize">
                {nombreDia(diaActivo.fecha)}
              </div>
            </div>
            <button
              onClick={cerrarModal}
              className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {empleadoId === "ALL" && (
            <div className="text-sm rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
              Calendario general: la marca se aplicará a todos los empleados.
            </div>
          )}

          <div className="text-sm text-slate-500">
            Asignar turno y estado del día
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["MANANA", "TARDE", "MANANA_TARDE"] as Turno[]).map((t) => (
              <button
                key={t}
                onClick={() => marcarDia(diaActivo.estado ?? null, t)}
                className={`border rounded-xl px-2 py-2 text-sm font-medium active:scale-[0.97] transition cursor-pointer ${
                  diaActivo.turno === t
                    ? "bg-[#2f5bd3] text-white border-[#2f5bd3]"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                {ETIQUETA_TURNO[t]}
              </button>
            ))}
          </div>

          {(diaActivo.turno === "MANANA" ||
            diaActivo.turno === "MANANA_TARDE") && (
            <HorasInputs
              titulo="Mañana"
              valor={horasManana}
              onChange={setHorasManana}
            />
          )}

          {(diaActivo.turno === "TARDE" ||
            diaActivo.turno === "MANANA_TARDE") && (
            <HorasInputs
              titulo="Tarde"
              valor={horasTarde}
              onChange={setHorasTarde}
            />
          )}

          <button
            onClick={guardarHorario}
            className="w-full bg-[#2f5bd3] hover:bg-[#2650bd] text-white rounded-xl px-4 py-3 text-sm font-medium transition cursor-pointer"
          >
            Guardar horario
          </button>

          <div className="text-xs uppercase tracking-wide text-slate-400">
            Estado del día
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Accion
              icon={<Plane size={18} />}
              label="Vacaciones"
              disabled={
                vacacionesRestantes === 0 && diaActivo.estado !== "VACACIONES"
              }
              onClick={() => marcarDia("VACACIONES")}
            />
            <Accion
              icon={<Briefcase size={18} />}
              label="Día libre"
              onClick={() => marcarDia("DIA_LIBRE")}
            />
            <Accion
              icon={<CalendarDays size={18} />}
              label="D. Festivo"
              onClick={() => marcarDia("FESTIVO")}
            />
            <Accion
              icon={<Ban size={18} />}
              label="Baja"
              onClick={() => marcarDia("BAJA")}
            />
            <Accion
              icon={<Trash2 size={18} />}
              label="Eliminar"
              danger
              onClick={eliminarMarca}
            />
            {empleadoId !== "ALL" && (
              <Accion
                icon={<Clock size={18} />}
                label="Fichajes"
                onClick={() => setModoModal("JORNADAS")}
              />
            )}
          </div>
        </Modal>
      )}

      {/* MODAL FICHAJES */}
      {diaActivo && modoModal === "JORNADAS" && (
        <Modal onClose={cerrarModal} ancho="w-[560px]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Fichajes · {formatFechaES(diaActivo.fecha)}
              </h2>
              <div className="text-sm text-slate-500 capitalize">
                {nombreDia(diaActivo.fecha)}
              </div>
            </div>
            <button
              onClick={cerrarModal}
              className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* TOTALES */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
              <div className="text-xs text-emerald-700">Trabajado</div>
              <div className="text-lg font-semibold text-emerald-800">
                {minutosAHoras(resumen.trabajado)}
              </div>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
              <div className="text-xs text-amber-700">En pausa</div>
              <div className="text-lg font-semibold text-amber-800">
                {minutosAHoras(resumen.pausas)}
              </div>
            </div>
          </div>

          {/* LISTA DE TRAMOS Y PAUSAS */}
          <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
            {tramos.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-4">
                Este día no tiene fichajes. Añade un tramo.
              </div>
            )}

            {ordenarTramos(tramos).map((t, i, lista) => {
              const siguiente = lista[i + 1];
              const hayPausa =
                !!siguiente &&
                horaOk(t.salida) &&
                horaOk(siguiente.entrada) &&
                horaAMinutos(siguiente.entrada) > horaAMinutos(t.salida);
              const duracion =
                horaOk(t.entrada) && horaOk(t.salida)
                  ? minutosEntreHoras(t.entrada, t.salida)
                  : null;
              // Pausa real = la salida tiene motivo; si no, es el hueco entre turnos
              const esPausa = t.motivo.trim() !== "";

              return (
                <div key={t.id} className="space-y-2">
                  <div className="border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 w-14">
                      Tramo {i + 1}
                    </span>
                    <input
                      type="time"
                      value={t.entrada}
                      onChange={(e) =>
                        cambiarTramo(t.id, { entrada: e.target.value })
                      }
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                      aria-label="Entrada"
                    />
                    <span className="text-slate-400">→</span>
                    <input
                      type="time"
                      value={t.salida}
                      onChange={(e) =>
                        cambiarTramo(t.id, { salida: e.target.value })
                      }
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                      aria-label="Salida"
                    />
                    <span className="text-xs text-slate-500 ml-auto">
                      {duracion !== null && duracion > 0
                        ? minutosAHoras(duracion)
                        : !t.entrada && t.salida
                        ? "Salida sin entrada"
                        : t.entrada && !t.salida
                        ? "Sin salida"
                        : ""}
                    </span>
                    <button
                      onClick={() => quitarTramo(t.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                      title="Quitar tramo"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {hayPausa && (
                    <div
                      className={`ml-6 flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 ${
                        esPausa
                          ? "bg-amber-50 border-amber-200"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      {esPausa ? (
                        <Coffee size={14} className="text-amber-700" />
                      ) : (
                        <Clock size={14} className="text-slate-500" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          esPausa ? "text-amber-800" : "text-slate-600"
                        }`}
                      >
                        {esPausa ? "Pausa" : "Entre tramos"} {t.salida} →{" "}
                        {siguiente.entrada} (
                        {minutosAHoras(
                          horaAMinutos(siguiente.entrada) -
                            horaAMinutos(t.salida)
                        )}
                        )
                      </span>
                      <input
                        type="text"
                        list="motivos-pausa"
                        maxLength={80}
                        value={t.motivo}
                        onChange={(e) =>
                          cambiarTramo(t.id, { motivo: e.target.value })
                        }
                        placeholder={
                          esPausa ? "Motivo" : "Motivo (solo si fue una pausa)"
                        }
                        className={`flex-1 min-w-[120px] bg-white rounded-lg border px-2 py-1 text-sm ${
                          esPausa ? "border-amber-200" : "border-slate-200"
                        }`}
                      />
                      {esPausa && (
                        <button
                          onClick={() => quitarPausa(t.id)}
                          className="text-xs text-amber-800 underline cursor-pointer"
                        >
                          Quitar pausa
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={anadirTramo}
            className="flex items-center gap-2 text-sm text-[#2f5bd3] font-medium cursor-pointer"
          >
            <Plus size={16} />
            Añadir tramo
          </button>

          {/* AÑADIR PAUSA */}
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <Coffee size={15} />
              Añadir pausa (sale del puesto y vuelve)
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={pausaForm.desde}
                onChange={(e) =>
                  setPausaForm({ ...pausaForm, desde: e.target.value })
                }
                className="border border-amber-200 bg-white rounded-lg px-2 py-1.5 text-sm"
                aria-label="Inicio de la pausa"
              />
              <span className="text-slate-400">→</span>
              <input
                type="time"
                value={pausaForm.hasta}
                onChange={(e) =>
                  setPausaForm({ ...pausaForm, hasta: e.target.value })
                }
                className="border border-amber-200 bg-white rounded-lg px-2 py-1.5 text-sm"
                aria-label="Fin de la pausa"
              />
              <input
                type="text"
                list="motivos-pausa"
                maxLength={80}
                value={pausaForm.motivo}
                onChange={(e) =>
                  setPausaForm({ ...pausaForm, motivo: e.target.value })
                }
                placeholder="Motivo (opcional)"
                className="flex-1 min-w-[140px] border border-amber-200 bg-white rounded-lg px-2 py-1.5 text-sm"
              />
              <button
                onClick={anadirPausa}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 text-sm font-medium cursor-pointer"
              >
                Añadir
              </button>
            </div>
            <div className="text-xs text-amber-800/80">
              La pausa se descuenta del tiempo trabajado y debe quedar dentro de
              un tramo.
            </div>
          </div>

          <datalist id="motivos-pausa">
            {MOTIVOS_PAUSA.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>

          {errorTramos && (
            <div
              role="alert"
              className="text-sm rounded-xl bg-red-50 border border-red-200 text-red-700 px-3 py-2"
            >
              {errorTramos}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={guardarFichajes}
              disabled={guardandoFichajes}
              className="flex-1 bg-[#2f5bd3] hover:bg-[#2650bd] disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-medium cursor-pointer"
            >
              {guardandoFichajes ? "Guardando…" : "Guardar fichajes"}
            </button>
            <button
              onClick={cerrarModal}
              className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm hover:bg-slate-50 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* =========================
   COMPONENTES
========================= */
function Resumen({
  titulo,
  valor,
  tono = "normal",
  detalle,
  icono,
  estilo = "bg-[#e3eafb] text-[#2f5bd3]",
}: {
  titulo: string;
  valor: string;
  tono?: "normal" | "bueno" | "malo";
  detalle?: string;
  icono?: ReactNode;
  estilo?: string;
}) {
  const color =
    tono === "malo"
      ? "text-red-600"
      : tono === "bueno"
      ? "text-emerald-600"
      : "text-slate-900";

  const colorDetalle =
    tono === "malo"
      ? "text-red-600"
      : tono === "bueno"
      ? "text-emerald-600"
      : "text-slate-500";

  return (
    <div className="flex items-start gap-3.5 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-[0_14px_34px_-24px_rgba(29,36,51,0.3)]">
      {icono && (
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${estilo}`}
        >
          {icono}
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {titulo}
        </div>
        <div className={`text-2xl font-bold leading-tight ${color}`}>
          {valor}
        </div>
        {detalle && (
          <div className={`mt-1 text-xs leading-snug ${colorDetalle}`}>
            {detalle}
          </div>
        )}
      </div>
    </div>
  );
}

function Accion({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Ya tiene todos los días de vacaciones aplicados" : undefined}
      className={`flex items-center gap-2 border rounded-xl px-4 py-3 text-sm font-medium
        hover:bg-slate-50 active:scale-[0.98] transition cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        ${danger ? "text-red-600 border-red-300" : "border-slate-200"}
      `}
    >
      {icon}
      {label}
    </button>
  );
}

function Chip({
  children,
  onClick,
  suave = false,
}: {
  children: ReactNode;
  onClick: () => void;
  suave?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium border transition cursor-pointer ${
        suave
          ? "border-slate-200 text-slate-500 bg-white hover:bg-slate-50"
          : "border-[#2f5bd3]/30 text-[#2f5bd3] bg-white hover:bg-[#2f5bd3]/10"
      }`}
    >
      {children}
    </button>
  );
}

function HorasInputs({
  titulo,
  valor,
  onChange,
}: {
  titulo: string;
  valor: { entrada: string; salida: string };
  onChange: (v: { entrada: string; salida: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-700 w-14">{titulo}</span>
      <input
        type="time"
        value={valor.entrada}
        onChange={(e) => onChange({ ...valor, entrada: e.target.value })}
        className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
        aria-label={`${titulo}: entrada`}
      />
      <span className="text-slate-400">→</span>
      <input
        type="time"
        value={valor.salida}
        onChange={(e) => onChange({ ...valor, salida: e.target.value })}
        className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
        aria-label={`${titulo}: salida`}
      />
    </div>
  );
}

function Modal({
  children,
  onClose,
  ancho,
}: {
  children: ReactNode;
  onClose: () => void;
  ancho: string;
}) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white rounded-3xl p-6 ${ancho} max-w-full max-h-[92vh] overflow-y-auto space-y-4 shadow-2xl`}
      >
        {children}
      </div>
    </div>
  );
}

/* =========================
   CONTROL DE CONTRATO
========================= */
type DiaMes = {
  fecha: string;
  estado: string | null;
  minutosTrabajados: number;
};

type ResumenMes = {
  mes: string; // YYYY-MM
  trabajados: number; // minutos
  objetivo: number; // minutos que tocaban (laborables sin estado)
  diasLaborables: number;
};

type ControlContratoProps = {
  empleadoId: string;
  /** Mes que se está viendo (YYYY-MM): de aquí sale el año */
  mes: string;
  horasContratadasSemana: number;
};

const NOMBRES_MES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/* =======================
   HELPERS
======================= */
const conSigno = (min: number) => {
  const r = Math.round(min);
  if (r === 0) return "0 h 00 min";
  return `${r > 0 ? "+" : "-"}${minutosAHoras(Math.abs(r))}`;
};

const aHorasDecimal = (min: number) =>
  (min / 60).toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

/** Jornada completa de referencia (horas/semana) para calcular el % */
const JORNADA_COMPLETA_H = 40;

const porcentaje = (horasSemana: number) =>
  ((horasSemana / JORNADA_COMPLETA_H) * 100).toLocaleString("es-ES", {
    maximumFractionDigits: 1,
  });

/** Acepta "34,5" y "34.5" */
const leerHoras = (texto: string): number | null => {
  const n = Number(texto.trim().replace(",", "."));
  return texto.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};

/* =======================
   COMPONENTE
   Control de contrato: reparto anual de horas del empleado.
   - Objetivo anual = horas/semana ÷ 5 por cada día laborable (L-V) sin
     estado (las vacaciones, festivos, libres y bajas ya aplicados no cuentan).
   - Cuántas horas a la semana quedan por hacer hasta fin de año.
======================= */
function ControlContrato({
  empleadoId,
  mes,
  horasContratadasSemana,
}: ControlContratoProps) {
  const anio = Number(mes.slice(0, 4));

  const [dias, setDias] = useState<DiaMes[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horasInput, setHorasInput] = useState("");
  const [nominaMin, setNominaMin] = useState(0); // horas ya pagadas en nómina este año
  const [descontarNomina, setDescontarNomina] = useState(false);
  const descuento = descontarNomina ? nominaMin : 0;

  /* ---------- Carga de los 12 meses del año ---------- */
  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      setCargando(true);
      setError(null);

      const meses = Array.from(
        { length: 12 },
        (_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`
      );

      const respuestas = await Promise.allSettled(
        meses.map((m) =>
          api.get("/crm/horario", { params: { mes: m, empleadoId } })
        )
      );

      if (cancelado) return;

      if (respuestas.some((r) => r.status === "rejected")) {
        setDias([]);
        setError("No se han podido cargar todos los meses del año.");
        setCargando(false);
        return;
      }

      const todos: DiaMes[] = [];
      respuestas.forEach((r) => {
        if (r.status !== "fulfilled") return;
        (r.value.data?.dias ?? []).forEach((d: any) => {
          todos.push({
            fecha: d.fecha,
            estado: d.estado ?? null,
            minutosTrabajados: Number(d.minutosTrabajados) || 0,
          });
        });
      });

      // Horas extra ya pagadas en nómina: no cuentan para la jornada anual
      let nomina = 0;
      try {
        const saldo = await api.get("/crm/horario/saldo", {
          params: { empleadoId, mes },
        });
        (saldo.data?.ajustes ?? []).forEach((a: any) => {
          if (a.tipo === "NOMINA" && String(a.fecha).startsWith(String(anio))) {
            nomina += Math.abs(Number(a.minutos) || 0);
          }
        });
      } catch {
        nomina = 0;
      }
      if (cancelado) return;

      setNominaMin(nomina);
      setDias(todos);
      setCargando(false);
    };

    cargar();

    return () => {
      cancelado = true;
    };
  }, [empleadoId, anio, mes]);

  /* ---------- Cálculos ---------- */
  const calculo = useMemo(() => {
    const minutosDia = (horasContratadasSemana * 60) / 5;
    const hoy = hoyISO();

    const porMes = new Map<string, ResumenMes>();
    for (let i = 1; i <= 12; i++) {
      const clave = `${anio}-${String(i).padStart(2, "0")}`;
      porMes.set(clave, {
        mes: clave,
        trabajados: 0,
        objetivo: 0,
        diasLaborables: 0,
      });
    }

    let trabajados = 0;
    let objetivo = 0;
    let diasRestantes = 0; // laborables sin estado después de hoy
    let diasLaborablesAnio = 0; // laborables sin estado de todo el año

    dias.forEach((d) => {
      const resumen = porMes.get(d.fecha.slice(0, 7));
      if (!resumen) return;

      resumen.trabajados += d.minutosTrabajados;
      trabajados += d.minutosTrabajados;

      const laborable = !d.estado && !esFinDeSemana(d.fecha);
      if (laborable) {
        resumen.objetivo += minutosDia;
        resumen.diasLaborables += 1;
        objetivo += minutosDia;
        diasLaborablesAnio += 1;
        if (d.fecha > hoy) diasRestantes += 1;
      }
    });

    const brutos = trabajados;
    trabajados = brutos - descuento;

    const meses = Array.from(porMes.values());
    const mesesTranscurridos =
      hoy.slice(0, 4) > String(anio)
        ? 12
        : hoy.slice(0, 4) < String(anio)
        ? 0
        : Number(hoy.slice(5, 7));

    return {
      meses,
      trabajados,
      brutos,
      objetivo,
      restante: objetivo - trabajados,
      semanasRestantes: diasRestantes / 5,
      diasRestantes,
      semanasAnio: diasLaborablesAnio / 5,
      mediaMensual: mesesTranscurridos > 0 ? trabajados / mesesTranscurridos : 0,
      mediaObjetivoMensual: objetivo / 12,
      mesesTranscurridos,
      hoyMes: hoy.slice(0, 7),
    };
  }, [dias, anio, horasContratadasSemana, descuento]);

  const horasSemana = leerHoras(horasInput);
  const proyeccion =
    horasSemana !== null
      ? calculo.trabajados + horasSemana * 60 * calculo.semanasRestantes
      : null;

  // Contrato semanal que corresponde: las horas del año repartidas entre las
  // semanas laborables del año (mismas que usa la jornada anual)
  const contratoRecomendado =
    proyeccion !== null && calculo.semanasAnio > 0
      ? proyeccion / 60 / calculo.semanasAnio
      : null;

  /* ---------- Render ---------- */
  if (cargando) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-slate-200/70 bg-white p-12 shadow-[0_14px_34px_-24px_rgba(29,36,51,0.3)]">
        <Loader2 className="animate-spin text-[#2f5bd3]" size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
      >
        <AlertCircle size={18} className="shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* RESUMEN ANUAL */}
      <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_14px_34px_-24px_rgba(29,36,51,0.3)]">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Control de contrato {anio}
          </h2>
          <span className="text-sm text-slate-500">
            {aHorasDecimal(horasContratadasSemana * 60)} h/semana contratadas
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Dato
            titulo="Jornada anual"
            valor={minutosAHoras(calculo.objetivo)}
            detalle={`Media ${minutosAHoras(
              calculo.mediaObjetivoMensual
            )} al mes`}
          />
          <Dato
            titulo="Trabajadas hasta hoy"
            valor={minutosAHoras(calculo.trabajados)}
            detalle={
              descuento > 0
                ? `${minutosAHoras(calculo.brutos)} menos ${minutosAHoras(
                    descuento
                  )} pagadas en nómina`
                : calculo.mesesTranscurridos > 0
                ? `Media ${minutosAHoras(calculo.mediaMensual)} al mes`
                : undefined
            }
          />
          <Dato
            titulo={calculo.restante >= 0 ? "Faltan por hacer" : "Te pasas"}
            valor={minutosAHoras(Math.abs(calculo.restante))}
            tono={calculo.restante > 0 ? "malo" : "bueno"}
          />
          <Dato
            titulo="Semanas que quedan"
            valor={calculo.semanasRestantes.toLocaleString("es-ES", {
              maximumFractionDigits: 1,
            })}
            detalle={`${calculo.diasRestantes} días laborables`}
          />
        </div>
      </div>

      {/* CALCULADORA */}
      <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_14px_34px_-24px_rgba(29,36,51,0.3)]">
        <h3 className="text-base font-bold text-slate-900">
          Contrato que le corresponde
        </h3>

        {calculo.semanasRestantes === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No quedan días laborables en {anio}.
          </p>
        ) : (
          <>
            {nominaMin > 0 && (
              <button
                type="button"
                role="switch"
                aria-checked={descontarNomina}
                onClick={() => setDescontarNomina((v) => !v)}
                className="mt-4 flex cursor-pointer items-center gap-3 text-left"
              >
                <span
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                    descontarNomina ? "bg-[#2f5bd3]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      descontarNomina ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </span>
                <span className="text-sm text-slate-700">
                  <span className="font-semibold">
                    Descontar las horas pagadas en nómina
                  </span>{" "}
                  ({minutosAHoras(nominaMin)} este año)
                  <span className="block text-xs text-slate-500">
                    {descontarNomina
                      ? "Se restan: el contrato cubre solo su jornada normal."
                      : "No se restan: el contrato refleja todo lo que ha trabajado."}
                  </span>
                </span>
              </button>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-slate-600">
                Si hace desde hoy hasta fin de año
              </label>
              <div className="flex items-center rounded-full border-2 border-[#2f5bd3]/40 bg-white px-4 py-2 focus-within:border-[#2f5bd3]">
                <input
                  type="text"
                  inputMode="decimal"
                  value={horasInput}
                  onChange={(e) => setHorasInput(e.target.value)}
                  placeholder="escribe"
                  className="w-20 bg-transparent placeholder:text-sm placeholder:font-normal placeholder:text-slate-300 text-right text-base font-semibold text-slate-900 outline-none"
                />
                <span className="ml-2 text-sm text-slate-500">h / semana</span>
              </div>
            </div>

            {horasInput.trim() === "" && (
              <p className="mt-3 text-sm text-slate-500">
                Escribe las horas a la semana que crees que va a hacer hasta
                fin de año y te digo el contrato que necesitaría.
              </p>
            )}

            {horasInput.trim() !== "" && horasSemana === null && (
              <p className="mt-3 text-sm text-red-600">
                Escribe un número válido, por ejemplo 34,5.
              </p>
            )}

            {proyeccion !== null && contratoRecomendado !== null && (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-[#e3eafb] px-4 py-3 text-[#1f3f9c]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider">
                    Debería estar contratado a
                  </div>
                  <div className="mt-0.5 text-2xl font-bold">
                    {contratoRecomendado.toLocaleString("es-ES", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    h / semana
                  </div>
                  <div className="mt-1 text-lg font-bold">
                    {porcentaje(contratoRecomendado)} % de jornada
                  </div>
                  <div className="mt-0.5 text-xs">
                    Ahora está a{" "}
                    {aHorasDecimal(horasContratadasSemana * 60)} h
                    {Math.abs(
                      contratoRecomendado - horasContratadasSemana
                    ) < 0.01
                      ? " · cuadra justo."
                      : ` · ${
                          contratoRecomendado > horasContratadasSemana
                            ? "+"
                            : "-"
                        }${aHorasDecimal(
                          Math.abs(
                            contratoRecomendado - horasContratadasSemana
                          ) * 60
                        )} h a la semana de diferencia.`}
                  </div>
                  <div className="mt-0.5 text-xs">
                    Jornada actual {porcentaje(horasContratadasSemana)} %
                    {Math.abs(
                      contratoRecomendado - horasContratadasSemana
                    ) < 0.01
                      ? ""
                      : ` · diferencia ${
                          contratoRecomendado > horasContratadasSemana
                            ? "+"
                            : "-"
                        }${porcentaje(
                          Math.abs(
                            contratoRecomendado - horasContratadasSemana
                          )
                        )} puntos de jornada.`}
                  </div>
                </div>

                <p className="text-sm text-slate-600">
                  Con {horasSemana?.toLocaleString("es-ES")} h a la semana
                  hasta fin de año, el total sería{" "}
                  <strong className="text-slate-900">
                    {minutosAHoras(proyeccion)}
                  </strong>{" "}
                  ({calculo.semanasAnio.toLocaleString("es-ES", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  semanas laborables en {anio}).
                  {descuento > 0 &&
                    ` Ya descontadas ${minutosAHoras(
                      descuento
                    )} pagadas en nómina.`}
                </p>
                <p className="text-xs text-slate-400">
                  El % se calcula sobre {JORNADA_COMPLETA_H} h semanales de
                  jornada completa. Si tu convenio fija otra, el porcentaje
                  cambia.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* DETALLE POR MES */}
      <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_14px_34px_-24px_rgba(29,36,51,0.3)]">
        <h3 className="mb-3 text-base font-bold text-slate-900">
          Mes a mes
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-3">Mes</th>
                <th className="py-2 pr-3 text-right">Trabajadas</th>
                <th className="py-2 pr-3 text-right">Tocaban</th>
                <th className="py-2 text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {calculo.meses.map((m, i) => {
                const futuro = m.mes > calculo.hoyMes;
                const actual = m.mes === calculo.hoyMes;
                const dif = m.trabajados - m.objetivo;

                return (
                  <tr
                    key={m.mes}
                    className="border-t border-slate-100 text-slate-700"
                  >
                    <td className="py-2 pr-3 font-medium">
                      {NOMBRES_MES[i]}
                      {actual && (
                        <span className="ml-2 rounded-full bg-[#e3eafb] px-2 py-0.5 text-[10px] font-semibold text-[#2f5bd3]">
                          en curso
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {futuro ? "—" : minutosAHoras(m.trabajados)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {minutosAHoras(m.objetivo)}
                    </td>
                    <td
                      className={`py-2 text-right font-semibold ${
                        futuro || actual
                          ? "text-slate-400"
                          : dif < 0
                          ? "text-red-600"
                          : dif > 0
                          ? "text-emerald-600"
                          : "text-slate-500"
                      }`}
                    >
                      {futuro || actual ? "—" : conSigno(dif)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          Se cuentan solo los días laborables (L–V) sin vacaciones, festivo,
          día libre ni baja. Lo que aún no hayas marcado en el calendario
          cuenta como día de trabajo.
        </p>
      </div>
    </div>
  );
}

/* =======================
   TARJETA DE DATO
======================= */
function Dato({
  titulo,
  valor,
  detalle,
  tono = "normal",
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  tono?: "normal" | "bueno" | "malo";
}) {
  return (
    <div className="rounded-2xl bg-[#f5f7fc] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {titulo}
      </div>
      <div
        className={`mt-0.5 text-xl font-bold leading-tight ${
          tono === "malo"
            ? "text-red-600"
            : tono === "bueno"
            ? "text-emerald-600"
            : "text-slate-900"
        }`}
      >
        {valor}
      </div>
      {detalle && <div className="mt-0.5 text-xs text-slate-500">{detalle}</div>}
    </div>
  );
}