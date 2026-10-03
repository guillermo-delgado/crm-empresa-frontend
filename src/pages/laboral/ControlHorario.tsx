import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
} from "lucide-react";
import api from "../../services/api";
import {
  ZONA_ES,
  formatFechaES,
  horaAMinutos,
  horaEspana,
  hoyISO,
  minutosAHoras,
} from "../../utils/fechasES";

type RegistroHoy = {
  estado: "FUERA" | "DENTRO";
  minutosTrabajados: number;
  nombre: string;
  // Hora real de la última entrada (HH:mm, España). Solo si el backend la envía.
  ultimaEntrada?: string | null;
};

const REGISTRO_VACIO: RegistroHoy = {
  estado: "FUERA",
  minutosTrabajados: 0,
  nombre: "",
  ultimaEntrada: null,
};

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

export default function ControlHorario() {
  const [registro, setRegistro] = useState<RegistroHoy>(REGISTRO_VACIO);
  const [horaActual, setHoraActual] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [fichando, setFichando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorFichar, setErrorFichar] = useState<string | null>(null);

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

      const datos = res.data as RegistroHoy;

      setRegistro(datos);
      setErrorCarga(false);

      if (datos.estado === "DENTRO") {
        // Respaldo para cuando el backend no envía la hora de entrada
        if (!leerInicio()) guardarInicio(new Date().toISOString());
      } else {
        // 🔴 Si está FUERA, limpiar siempre
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

  /* 🔘 FICHAR (backend decide entrada/salida) */
  const fichar = async () => {
    if (fichando || errorCarga) return;

    setFichando(true);
    setErrorFichar(null);

    try {
      const estabaFuera = registro.estado === "FUERA";

      await api.post("/horario/fichar");

      const nuevoRegistro = await cargarEstado();
      const nombre = nuevoRegistro?.nombre ?? registro.nombre ?? "";

      if (estabaFuera) {
        const hora = Number(horaEspana().hora.slice(0, 2));
        const saludo = hora < 14 ? "Buenos días" : "Buenas tardes";
        setMensaje(`${saludo}, ${nombre}`);
      } else {
        setMensaje(`Hasta pronto, ${nombre}`);
      }

      programar(() => setMensaje(null), 10000);
    } catch (e: any) {
      setErrorFichar(e.response?.data?.message || "Error al fichar");
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
      <div className="flex min-h-screen items-center justify-center bg-[#f1f3f8]">
        <Loader2 className="animate-spin text-[#2f5bd3]" size={28} />
      </div>
    );
  }

  const enJornada = registro.estado === "DENTRO";

  const horaTexto = horaActual.toLocaleTimeString("es-ES", {
    timeZone: ZONA_ES,
    hour: "2-digit",
    minute: "2-digit",
  });

  const segundos = horaActual
    .toLocaleTimeString("es-ES", { timeZone: ZONA_ES, second: "2-digit" })
    .slice(-2);

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f1f3f8] px-5 py-8">
      <div className="flex w-full max-w-md flex-1 flex-col justify-between gap-8">
        {/* CABECERA */}
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Control horario
          </h1>

          <p className="text-sm text-slate-500">
            Hoy · {formatFechaES(hoyISO())}
          </p>
        </div>

        {/* SALUDO */}
        <div className="min-h-[2.5rem] text-center">
          {mensaje && (
            <div className="text-2xl font-semibold tracking-tight text-slate-700 transition-opacity duration-500 md:text-3xl">
              {mensaje}
            </div>
          )}
        </div>

        {/* HORA ACTUAL */}
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-1 text-slate-900">
            <span className="text-7xl font-bold tracking-tight">
              {horaTexto}
            </span>
            <span className="w-8 text-left text-xl font-medium text-slate-400">
              {segundos}
            </span>
          </div>
          <div className="mt-2 text-sm text-slate-500">
            Hora actual (España)
          </div>
        </div>

        {/* ESTADO */}
        <div className="space-y-4 rounded-3xl border border-slate-200/70 bg-white p-6 text-center shadow-[0_14px_34px_-20px_rgba(29,36,51,0.25)]">
          {errorCarga ? (
            <div className="space-y-3">
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
            <>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Estado
                </div>

                <div
                  className={`mt-1.5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-base font-semibold ${
                    enJornada
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      enJornada
                        ? "animate-pulse bg-emerald-500"
                        : "bg-slate-400"
                    }`}
                  />
                  {enJornada ? "En jornada" : "Fuera de jornada"}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tiempo trabajado hoy
                </div>

                <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                  {minutosAHoras(calcularMinutosEnVivo())}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ERROR AL FICHAR */}
        {errorFichar && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            <AlertCircle size={18} className="shrink-0" />
            {errorFichar}
          </div>
        )}

        {/* BOTÓN PRINCIPAL */}
        <button
          type="button"
          onClick={fichar}
          disabled={fichando || errorCarga}
          className={`
            flex w-full cursor-pointer items-center justify-center gap-3
            rounded-2xl py-5 text-lg font-semibold text-white
            transition active:scale-[0.98]
            disabled:cursor-not-allowed disabled:opacity-60
            ${
              enJornada
                ? "bg-red-600 shadow-[0_14px_28px_-14px_rgba(220,38,38,0.8)] hover:bg-red-700"
                : "bg-emerald-600 shadow-[0_14px_28px_-14px_rgba(5,150,105,0.8)] hover:bg-emerald-700"
            }
          `}
        >
          {fichando ? (
            <Loader2 size={22} className="animate-spin" />
          ) : enJornada ? (
            <LogOut size={22} />
          ) : (
            <LogIn size={22} />
          )}
          {fichando
            ? "Registrando…"
            : enJornada
            ? "Fichar salida"
            : "Fichar entrada"}
        </button>
      </div>
    </div>
  );
}