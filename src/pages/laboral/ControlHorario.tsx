import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  LogIn,
  LogOut,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
import api from "../../services/api";
import {
  ZONA_ES,
  horaAMinutos,
  horaEspana,
  minutosAHoras,
} from "../../utils/fechasES";

/* =========================
   TIPOS
========================= */
type FichajeHoy = {
  tipo: "ENTRADA" | "SALIDA";
  hora: string; // HH:mm
  pausa?: boolean;
  motivo?: string;
};

type RegistroHoy = {
  estado: "FUERA" | "DENTRO" | "PAUSA";
  minutosTrabajados: number;
  nombre: string;
  // Hora real de la última entrada (HH:mm, España). Solo si el backend la envía.
  ultimaEntrada?: string | null;
  // Pausa en curso
  pausa?: { motivo: string; desde: string } | null;
  // Fichajes de hoy y tramos de su turno (para la línea de tiempo)
  fichajes?: FichajeHoy[];
  turno?: { entrada: string; salida: string }[];
};

const REGISTRO_VACIO: RegistroHoy = {
  estado: "FUERA",
  minutosTrabajados: 0,
  nombre: "",
  ultimaEntrada: null,
  pausa: null,
  fichajes: [],
  turno: [],
};

const MOTIVOS_PAUSA = ["Médico", "Gestión personal", "Otro"] as const;

const CLAVE_INICIO = "hora_inicio_jornada";

/* localStorage puede fallar (modo privado, datos bloqueados) */
const leerInicio = (): string | null => {
  try {
    return localStorage.getItem(CLAVE_INICIO);
  } catch {
    return null;
  }
};

const guardarInicio = (valor: string) => {
  try {
    localStorage.setItem(CLAVE_INICIO, valor);
  } catch {
    // ignorar
  }
};

const borrarInicio = () => {
  try {
    localStorage.removeItem(CLAVE_INICIO);
  } catch {
    // ignorar
  }
};

const esHoraValida = (valor: unknown): valor is string =>
  typeof valor === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(valor);

/* Línea de tiempo del día */
type FilaTiempo = { color: string; texto: string; valor: string };

const construirLinea = (r: RegistroHoy): FilaTiempo[] => {
  const filas: FilaTiempo[] = [];
  const turno = r.turno ?? [];
  const fichajes = r.fichajes ?? [];

  if (fichajes.length === 0) {
    filas.push({ color: "#94a3b8", texto: "Aún no has fichado hoy", valor: "—" });
    if (turno.length > 0) {
      filas.push({
        color: "#2f5bd3",
        texto: "Tu turno de hoy",
        valor: turno.map((t) => `${t.entrada} – ${t.salida}`).join("  ·  "),
      });
    }
    return filas;
  }

  // Índice de la fila de pausa abierta (para cerrarla al volver)
  let pausaAbierta: { fila: FilaTiempo; desde: string; motivo: string } | null =
    null;

  for (const f of fichajes) {
    if (f.tipo === "ENTRADA") {
      if (pausaAbierta) {
        pausaAbierta.fila.valor = `${pausaAbierta.desde} – ${f.hora}`;
        pausaAbierta = null;
      } else {
        filas.push({ color: "#10b981", texto: "Entrada", valor: f.hora });
      }
    } else if (f.pausa) {
      const fila: FilaTiempo = {
        color: "#f59e0b",
        texto: f.motivo ? `Pausa (${f.motivo})` : "Pausa",
        valor: `desde ${f.hora}`,
      };
      filas.push(fila);
      pausaAbierta = { fila, desde: f.hora, motivo: f.motivo ?? "" };
    } else {
      filas.push({ color: "#ef4444", texto: "Salida", valor: f.hora });
    }
  }

  // Salida prevista mientras sigue en la jornada
  if (r.estado !== "FUERA" && turno.length > 0) {
    filas.push({
      color: "#94a3b8",
      texto: "Salida prevista",
      valor: turno[turno.length - 1].salida,
    });
  }

  return filas;
};

export default function ControlHorario() {
  const [registro, setRegistro] = useState<RegistroHoy>(REGISTRO_VACIO);
  const [horaActual, setHoraActual] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [fichando, setFichando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorFichar, setErrorFichar] = useState<string | null>(null);

  // Hoja "Motivo de la pausa"
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [motivoSel, setMotivoSel] = useState<string>("");
  const [motivoOtro, setMotivoOtro] = useState("");

  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);

  const programar = (accion: () => void, ms: number) => {
    temporizadores.current.push(setTimeout(accion, ms));
  };

  /* ⏱ Reloj en tiempo real */
  useEffect(() => {
    const t = setInterval(() => {
      setHoraActual(new Date());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* Limpiar temporizadores al salir de la pantalla */
  useEffect(() => {
    const lista = temporizadores.current;
    return () => lista.forEach(clearTimeout);
  }, []);

  const cargarEstado = async (): Promise<RegistroHoy | null> => {
    try {
      const res = await api.get("/horario/hoy");

      if (!res.data) {
        setRegistro(REGISTRO_VACIO);
        borrarInicio();
        setErrorCarga(false);
        return null;
      }

      const datos = {
        ...REGISTRO_VACIO,
        ...(res.data as RegistroHoy),
      };

      setRegistro(datos);
      setErrorCarga(false);

      if (datos.estado === "DENTRO") {
        // Respaldo para cuando el backend no envía la hora de entrada
        if (!leerInicio()) guardarInicio(new Date().toISOString());
      } else {
        // 🔴 Si está FUERA o en PAUSA, limpiar siempre
        borrarInicio();
      }

      return datos;
    } catch {
      // No fingimos "fuera de jornada": el estado real es desconocido
      setErrorCarga(true);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEstado();
  }, []);

  /* 🔘 FICHAR (backend decide entrada/salida; también sirve para volver de una pausa) */
  const fichar = async () => {
    if (fichando || errorCarga) return;

    setFichando(true);
    setErrorFichar(null);

    try {
      const estabaFuera = registro.estado === "FUERA";
      const volvia = registro.estado === "PAUSA";

      const respuesta = await api.post("/horario/fichar");

      const nuevoRegistro = await cargarEstado();
      const nombre = nuevoRegistro?.nombre ?? registro.nombre ?? "";

      if (volvia) {
        setMensaje(`De vuelta, ${nombre}`);
      } else if (estabaFuera) {
        const hora = Number(horaEspana().hora.slice(0, 2));
        const saludo = hora < 14 ? "Buenos días" : "Buenas tardes";
        setMensaje(`${saludo}, ${nombre}`);
      } else {
        setMensaje(`Hasta pronto, ${nombre}`);
      }

      // Si el fichaje se ajustó a su horario, se lo contamos
      const datosFichaje = respuesta?.data;
      if (datosFichaje?.ajustado && esHoraValida(datosFichaje?.horaRegistrada)) {
        setAviso(
          `${estabaFuera ? "Entrada" : "Salida"} registrada a las ${
            datosFichaje.horaRegistrada
          } según tu horario`
        );
        programar(() => setAviso(null), 10000);
      } else {
        setAviso(null);
      }

      programar(() => setMensaje(null), 10000);
    } catch (e: any) {
      setErrorFichar(e.response?.data?.message || "Error al fichar");
      programar(() => setErrorFichar(null), 8000);
    } finally {
      setFichando(false);
    }
  };

  /* ☕ EMPEZAR PAUSA */
  const abrirHoja = () => {
    if (fichando || errorCarga) return;
    setMotivoSel("");
    setMotivoOtro("");
    setHojaAbierta(true);
  };

  const empezarPausa = async () => {
    if (fichando || !motivoSel) return;

    const motivo =
      motivoSel === "Otro" ? motivoOtro.trim() || "Otro" : motivoSel;

    setFichando(true);
    setErrorFichar(null);

    try {
      await api.post("/horario/pausa", { motivo });
      setHojaAbierta(false);
      await cargarEstado();
      setMensaje("Pausa iniciada");
      setAviso(null);
      programar(() => setMensaje(null), 6000);
    } catch (e: any) {
      setHojaAbierta(false);
      setErrorFichar(e.response?.data?.message || "Error al iniciar la pausa");
      programar(() => setErrorFichar(null), 8000);
    } finally {
      setFichando(false);
    }
  };

  /* Tiempo trabajado hoy, en vivo */
  const calcularMinutosEnVivo = () => {
    if (registro.estado !== "DENTRO") {
      return registro.minutosTrabajados;
    }

    // ✅ Con la hora real de entrada que envía el backend (fiable)
    if (esHoraValida(registro.ultimaEntrada)) {
      const desdeEntrada =
        horaEspana(horaActual).minutos - horaAMinutos(registro.ultimaEntrada);

      return registro.minutosTrabajados + Math.max(0, desdeEntrada);
    }

    // Respaldo (backend antiguo): contador desde que se abrió la pantalla
    const inicio = leerInicio();
    if (!inicio) return registro.minutosTrabajados;

    const diffMin = Math.floor(
      (horaActual.getTime() - new Date(inicio).getTime()) / 60000
    );

    return registro.minutosTrabajados + Math.max(0, diffMin);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#2f5bd3]" size={28} />
      </div>
    );
  }

  const enJornada = registro.estado === "DENTRO";
  const enPausa = registro.estado === "PAUSA";

  const horaTexto = horaActual.toLocaleTimeString("es-ES", {
    timeZone: ZONA_ES,
    hour: "2-digit",
    minute: "2-digit",
  });

  const fechaTexto = horaActual.toLocaleDateString("es-ES", {
    timeZone: ZONA_ES,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // Solo la primera letra en mayúscula: "Sábado, 3 de octubre"
  const fechaLarga = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);

  const minutosVivo = calcularMinutosEnVivo();

  /* Anillo: lo trabajado frente a lo que dura su turno (8 h si no tiene) */
  const objetivo =
    (registro.turno ?? []).reduce(
      (acc, t) => acc + (horaAMinutos(t.salida) - horaAMinutos(t.entrada)),
      0
    ) || 480;
  const progreso = Math.min(1, minutosVivo / objetivo);

  const RADIO = 104;
  const LONGITUD = 2 * Math.PI * RADIO;

  /* Cuenta de la pausa en curso */
  let textoCentro = horaTexto;
  let subCentro = "Hora actual · España";

  if (enPausa && registro.pausa && esHoraValida(registro.pausa.desde)) {
    const min = Math.max(
      0,
      horaEspana(horaActual).minutos - horaAMinutos(registro.pausa.desde)
    );
    textoCentro = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
      min % 60
    ).padStart(2, "0")}`;
    subCentro = registro.pausa.motivo
      ? `En pausa · ${registro.pausa.motivo}`
      : "En pausa";
  }

  const linea = construirLinea(registro);
  const colorAnillo = enPausa ? "#f59e0b" : "#2f5bd3";

  return (
    <div className="flex justify-center px-1 pb-4 pt-6">
      <div className="flex min-h-[calc(100dvh-8rem)] w-full max-w-md flex-col gap-4">
        {/* CABECERA */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Control horario
            </h1>
            <p className="text-sm text-slate-500">{fechaLarga}</p>
          </div>

          <span
            className={`mt-1 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              enJornada
                ? "bg-emerald-100 text-emerald-700"
                : enPausa
                ? "bg-amber-100 text-amber-700"
                : "bg-white text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            {(enJornada || enPausa) && (
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  enJornada
                    ? "animate-pulse bg-emerald-500"
                    : "animate-pulse bg-amber-500"
                }`}
              />
            )}
            {enJornada ? "En jornada" : enPausa ? "En pausa" : "Fuera"}
          </span>
        </div>

        {/* SALUDO */}
        <div className="min-h-[1.75rem] text-center">
          {mensaje && (
            <div className="text-xl font-semibold tracking-tight text-slate-700">
              {mensaje}
            </div>
          )}
        </div>

        {/* ANILLO + TIEMPO TRABAJADO */}
        <div className="rounded-[2rem] bg-white px-5 pb-5 pt-7 text-center shadow-[0_22px_40px_-28px_rgba(29,36,51,0.4)]">
          <div className="relative mx-auto h-[236px] w-[236px]">
            <svg
              width="236"
              height="236"
              className="-rotate-90"
              aria-hidden="true"
            >
              <circle
                cx="118"
                cy="118"
                r={RADIO}
                fill="none"
                stroke="#e8edf7"
                strokeWidth="14"
              />
              <circle
                cx="118"
                cy="118"
                r={RADIO}
                fill="none"
                stroke={colorAnillo}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${LONGITUD * progreso} ${LONGITUD}`}
                className="transition-[stroke-dasharray] duration-700"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[3.5rem] font-bold leading-none tabular-nums tracking-tight text-slate-900">
                {textoCentro}
              </span>
              <span className="mt-1.5 text-[13px] text-slate-500">
                {subCentro}
              </span>
            </div>
          </div>

          {errorCarga ? (
            <div className="mt-4 space-y-3">
              <div
                role="alert"
                className="flex items-center justify-center gap-2 text-sm font-medium text-red-700"
              >
                <AlertCircle size={18} />
                No se ha podido comprobar tu estado.
              </div>

              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  cargarEstado();
                }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#e3eafb] px-4 py-2 text-sm font-semibold text-[#2f5bd3] transition hover:bg-[#d5def7]"
              >
                <RefreshCw size={15} />
                Reintentar
              </button>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500">
              Trabajado hoy{" "}
              <b className="text-lg font-bold tabular-nums text-slate-900">
                {minutosAHoras(minutosVivo)}
              </b>
            </div>
          )}
        </div>

        {/* LÍNEA DE TIEMPO */}
        <div className="rounded-3xl bg-white px-5 py-1.5 shadow-[0_14px_30px_-26px_rgba(29,36,51,0.4)]">
          {linea.map((fila, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-slate-100 py-3 text-sm text-slate-700 last:border-0"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: fila.color }}
              />
              {fila.texto}
              <b className="ml-auto tabular-nums text-slate-900">
                {fila.valor}
              </b>
            </div>
          ))}
        </div>

        {/* AVISO: fichaje ajustado al horario */}
        {aviso && (
          <div
            role="status"
            className="rounded-2xl border border-[#2f5bd3]/20 bg-[#e3eafb] px-4 py-3 text-sm font-medium text-[#2a4fbd]"
          >
            {aviso}
          </div>
        )}

        {/* ERROR AL FICHAR */}
        {errorFichar && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            <AlertCircle size={18} className="shrink-0" />
            {errorFichar}
          </div>
        )}

        {/* BOTONES */}
        <div className="mt-auto flex gap-3 pt-2">
          {enJornada && (
            <button
              type="button"
              onClick={abrirHoja}
              disabled={fichando || errorCarga}
              className="flex flex-[0.8] cursor-pointer items-center justify-center gap-2.5 rounded-full bg-amber-500 py-4 text-lg font-semibold text-white shadow-[0_16px_28px_-14px_rgba(245,158,11,0.9)] transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Pause size={22} />
              Pausa
            </button>
          )}

          <button
            type="button"
            onClick={fichar}
            disabled={fichando || errorCarga}
            className={`
              flex cursor-pointer items-center justify-center gap-2.5
              rounded-full py-4 text-lg font-semibold text-white
              transition active:scale-[0.98]
              disabled:cursor-not-allowed disabled:opacity-60
              ${enJornada ? "flex-[1.2]" : "w-full"}
              ${
                enJornada
                  ? "bg-red-600 shadow-[0_16px_28px_-14px_rgba(220,38,38,0.9)] hover:bg-red-700"
                  : "bg-emerald-600 shadow-[0_16px_28px_-14px_rgba(5,150,105,0.9)] hover:bg-emerald-700"
              }
            `}
          >
            {fichando ? (
              <Loader2 size={22} className="animate-spin" />
            ) : enJornada ? (
              <LogOut size={22} />
            ) : enPausa ? (
              <Play size={22} />
            ) : (
              <LogIn size={22} />
            )}
            {fichando
              ? "Registrando…"
              : enJornada
              ? "Fichar salida"
              : enPausa
              ? "Volver al trabajo"
              : "Fichar entrada"}
          </button>
        </div>
      </div>

      {/* HOJA: MOTIVO DE LA PAUSA */}
      {hojaAbierta && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !fichando) setHojaAbierta(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Motivo de la pausa"
            className="w-full max-w-md rounded-t-[2rem] bg-white px-6 pb-8 pt-3 shadow-[0_-20px_40px_-20px_rgba(15,23,42,0.35)]"
          >
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-slate-200" />

            <h2 className="text-xl font-bold text-slate-900">
              Motivo de la pausa
            </h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              El tiempo de pausa no cuenta como trabajado.
            </p>

            <div className="flex flex-wrap gap-2.5">
              {MOTIVOS_PAUSA.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivoSel(m)}
                  className={`cursor-pointer rounded-full border-[1.5px] px-4 py-2.5 text-sm font-semibold transition ${
                    motivoSel === m
                      ? "border-amber-500 bg-amber-100 text-amber-800"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {motivoSel === "Otro" && (
              <input
                type="text"
                value={motivoOtro}
                maxLength={40}
                onChange={(e) => setMotivoOtro(e.target.value)}
                placeholder="Escribe el motivo (opcional)"
                className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            )}

            <button
              type="button"
              onClick={empezarPausa}
              disabled={!motivoSel || fichando}
              className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-amber-500 py-4 text-base font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fichando ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Pause size={20} />
              )}
              Empezar pausa
            </button>

            <button
              type="button"
              onClick={() => setHojaAbierta(false)}
              disabled={fichando}
              className="mt-2 w-full cursor-pointer py-2 text-sm font-medium text-slate-500"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}