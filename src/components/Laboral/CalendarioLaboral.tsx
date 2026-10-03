import { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  X,
} from "lucide-react";
import {
  claveFecha,
  claveMes,
  diasDelMes,
  esFinDeSemana,
  etiquetaMes,
  formatFechaES,
  hoyISO,
  huecosIniciales,
  minutosAHoras,
  minutosEntre,
  nombreDia,
  parseISO,
} from "../../utils/fechasES";

/* =====================
   TIPOS
===================== */
type Fichaje = {
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
};

type Estado = "VACACIONES" | "DIA_LIBRE" | "BAJA" | "FESTIVO" | null;

type DiaTrabajado = {
  fecha: string; // YYYY-MM-DD
  horas: string;
  minutos?: number;
  fichajes: Fichaje[];

  // 🔑 ESTADO REAL (IGUAL QUE CRM)
  estado?: Estado;

  // 🔄 TURNOS
  turno?: "MANANA" | "TARDE" | "MANANA_TARDE";
  horaEntradaManana?: string | null;
  horaSalidaManana?: string | null;
  horaEntradaTarde?: string | null;
  horaSalidaTarde?: string | null;
};

type DiaBackend = {
  fecha: string;
  estado?: Estado;
  minutosTrabajados: number;
  fichajes: Fichaje[];
  turno?: "MANANA" | "TARDE" | "MANANA_TARDE";
  horaEntradaManana?: string | null;
  horaSalidaManana?: string | null;
  horaEntradaTarde?: string | null;
  horaSalidaTarde?: string | null;
};

/* =====================
   HELPERS
===================== */

/**
 * Id del empleado conectado. Se lee en el momento de la petición
 * (no al cargar el archivo) para no arrastrar datos de otra sesión.
 */
const obtenerEmpleadoId = (): string | undefined => {
  try {
    const usuario = JSON.parse(localStorage.getItem("user") || "{}");
    const id = usuario?._id ?? usuario?.id;
    if (id) return String(id);
  } catch {
    // ignorar
  }

  return localStorage.getItem("userId") || undefined;
};

const agruparFichajes = (fichajes: Fichaje[]) => {
  const ordenados = [...fichajes].sort((a, b) => a.hora.localeCompare(b.hora));
  const bloques: { entrada: string; salida?: string }[] = [];

  for (let i = 0; i < ordenados.length; i++) {
    if (ordenados[i].tipo === "ENTRADA") {
      bloques.push({
        entrada: ordenados[i].hora,
        salida:
          ordenados[i + 1]?.tipo === "SALIDA"
            ? ordenados[i + 1].hora
            : undefined,
      });
    }
  }

  return bloques;
};

const ETIQUETA_ESTADO: Record<string, string> = {
  FESTIVO: "Festivo",
  DIA_LIBRE: "Libre",
  VACACIONES: "Vacaciones",
  BAJA: "Baja",
};

const ETIQUETA_TURNO: Record<string, string> = {
  MANANA: "Mañana",
  TARDE: "Tarde",
  MANANA_TARDE: "Mañana / Tarde",
};

/* =====================
   COMPONENTE
===================== */
export default function CalendarioLaboral() {
  const [periodo, setPeriodo] = useState(() => {
    const { y, m } = parseISO(hoyISO());
    return { year: y, month: m }; // month: 1-12
  });
  const { year, month } = periodo;

  const [diasTrabajados, setDiasTrabajados] = useState<
    Record<string, DiaTrabajado>
  >({});
  const [diaActivo, setDiaActivo] = useState<DiaTrabajado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detalleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      const mes = claveMes(year, month);
      const empleadoId = obtenerEmpleadoId();

      setCargando(true);
      setError(null);
      setDiaActivo(null);

      // 1️⃣ CALENDARIO GENERAL (VACACIONES / FESTIVOS / DÍAS LIBRES)
      // 2️⃣ CALENDARIO DEL EMPLEADO
      const [general, empleado] = await Promise.allSettled([
        api.get("/horario/calendario-general", { params: { mes } }),
        api.get("/horario/historial", {
          params: { mes, ...(empleadoId ? { empleadoId } : {}) },
        }),
      ]);

      if (cancelado) return;

      if (general.status === "rejected" && empleado.status === "rejected") {
        setDiasTrabajados({});
        setError("No se ha podido cargar el calendario. Inténtalo de nuevo.");
        setCargando(false);
        return;
      }

      const map: Record<string, DiaTrabajado> = {};

      // ⬇️ PRIMERO: CALENDARIO GENERAL
      if (general.status === "fulfilled") {
        (general.value.data?.dias ?? []).forEach((d: any) => {
          map[d.fecha] = {
            fecha: d.fecha,
            horas: "",
            minutos: 0,
            fichajes: [],
            estado: d.estado ?? d.tipo ?? null,
          };
        });
      }

      // ⬇️ DESPUÉS: DATOS DEL EMPLEADO (PISAN AL GENERAL)
      if (empleado.status === "fulfilled") {
        (empleado.value.data?.dias ?? []).forEach((d: DiaBackend) => {
          const minutos = Number(d.minutosTrabajados) || 0;

          map[d.fecha] = {
            fecha: d.fecha,

            horas:
              minutos > 0
                ? `${Math.floor(minutos / 60)}h ${minutos % 60}m`
                : "",

            minutos,
            fichajes: d.fichajes ?? [],

            // 👇 SI EL EMPLEADO NO TIENE ESTADO, SE MANTIENE EL GENERAL
            estado: d.estado ?? map[d.fecha]?.estado ?? null,

            turno: d.turno ?? undefined,
            horaEntradaManana: d.horaEntradaManana ?? null,
            horaSalidaManana: d.horaSalidaManana ?? null,
            horaEntradaTarde: d.horaEntradaTarde ?? null,
            horaSalidaTarde: d.horaSalidaTarde ?? null,
          };
        });
      }

      setDiasTrabajados(map);
      setCargando(false);
    };

    cargar();

    return () => {
      cancelado = true;
    };
  }, [year, month]);

  const irMes = (delta: number) => {
    setPeriodo(({ year, month }) => {
      const indice = year * 12 + (month - 1) + delta;
      return { year: Math.floor(indice / 12), month: (indice % 12) + 1 };
    });
  };

  const irAHoy = () => {
    const { y, m } = parseISO(hoyISO());
    setPeriodo({ year: y, month: m });
  };

  const hoy = hoyISO();
  const esMesDeHoy = hoy.slice(0, 7) === claveMes(year, month);
  const diasMes = diasDelMes(year, month);
  const offset = huecosIniciales(year, month);

  /* =====================
     CÁLCULO
  ===================== */
  const diasTrabajadosMes = Object.values(diasTrabajados).filter(
    (d) => d.minutos !== undefined && d.minutos > 0
  );

  const totalMinutos = diasTrabajadosMes.reduce(
    (acc, d) => acc + (d.minutos ?? 0),
    0
  );

  /* =====================
     CLASES POR TIPO
  ===================== */
  const getDayClasses = (dia?: DiaTrabajado, fecha?: string) => {
    // 1️⃣ ESTADOS (PRIORIDAD ABSOLUTA)
    if (dia?.estado === "VACACIONES") {
      return "bg-sky-50 text-sky-800 border-sky-200";
    }

    if (dia?.estado === "BAJA") {
      return "bg-red-50 text-red-800 border-red-200";
    }

    if (dia?.estado === "FESTIVO") {
      return "bg-violet-50 text-violet-800 border-violet-200";
    }

    if (dia?.estado === "DIA_LIBRE" && fecha && !esFinDeSemana(fecha)) {
      return "bg-orange-50 text-orange-800 border-orange-200";
    }

    // 2️⃣ FIN DE SEMANA
    if (fecha && esFinDeSemana(fecha)) {
      return "bg-slate-100/80 text-slate-400 border-slate-200";
    }

    // 3️⃣ DÍA TRABAJADO
    if (dia?.minutos && dia.minutos > 0) {
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    }

    // 4️⃣ NORMAL
    return "bg-white text-slate-500 border-slate-200";
  };

  const abrirDia = (dia: DiaTrabajado) => {
    setDiaActivo(dia);

    requestAnimationFrame(() => {
      detalleRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const botonMes =
    "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:bg-[#eef1fa] hover:text-[#2f5bd3] active:scale-95";

  return (
    <div className="min-h-screen bg-[#f1f3f8] px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* CABECERA */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => irMes(-1)}
            aria-label="Mes anterior"
            className={botonMes}
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex flex-col items-center gap-1">
            <h1 className="text-xl font-bold capitalize tracking-tight text-slate-900 sm:text-2xl">
              {etiquetaMes(year, month)}
            </h1>

            {!esMesDeHoy && (
              <button
                type="button"
                onClick={irAHoy}
                className="cursor-pointer rounded-full bg-[#e3eafb] px-3 py-0.5 text-xs font-semibold text-[#2f5bd3] transition hover:bg-[#d5def7]"
              >
                Ir a hoy
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => irMes(1)}
            aria-label="Mes siguiente"
            className={botonMes}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* RESUMEN MENSUAL */}
        <div className="mx-auto grid max-w-md grid-cols-2 gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_10px_28px_-18px_rgba(29,36,51,0.22)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CalendarDays size={22} />
            </span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Días trabajados
              </div>
              <div className="text-2xl font-bold leading-tight text-slate-900">
                {diasTrabajadosMes.length}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_10px_28px_-18px_rgba(29,36,51,0.22)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e3eafb] text-[#2f5bd3]">
              <Clock size={22} />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Horas trabajadas
              </div>
              <div className="truncate text-xl font-bold leading-tight text-slate-900">
                {minutosAHoras(totalMinutos)}
              </div>
            </div>
          </div>
        </div>

        {/* LEYENDA */}
        <div className="flex flex-wrap justify-center gap-2 text-xs font-medium text-slate-600">
          {[
            ["bg-emerald-500", "Día trabajado"],
            ["bg-violet-500", "Festivo"],
            ["bg-sky-400", "Vacaciones"],
            ["bg-red-500", "Baja"],
            ["bg-orange-400", "Día libre"],
          ].map(([color, texto]) => (
            <span
              key={texto}
              className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3 py-1.5"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
              {texto}
            </span>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="mx-auto flex max-w-xl items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        {/* CALENDARIO */}
        <div className="relative rounded-3xl border border-slate-200/70 bg-white p-3 shadow-[0_14px_34px_-20px_rgba(29,36,51,0.25)] sm:p-5">
          {cargando && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/60 backdrop-blur-[1px]">
              <Loader2 className="animate-spin text-[#2f5bd3]" size={28} />
            </div>
          )}

          <div className="scroll-smooth overflow-x-auto sm:overflow-visible">
            <div className="grid min-w-[700px] grid-cols-7 gap-2.5 text-center text-sm sm:min-w-0 sm:gap-3">
              {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                <div
                  key={d}
                  className="pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  {d}
                </div>
              ))}

              {/* HUECOS INICIALES */}
              {Array.from({ length: offset }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* DÍAS DEL MES */}
              {diasMes.map((dia) => {
                const fecha = claveFecha(year, month, dia);
                const tipoFinal = diasTrabajados[fecha];
                const isHoy = fecha === hoy;
                const seleccionado = diaActivo?.fecha === fecha;

                return (
                  <button
                    type="button"
                    key={fecha}
                    onClick={() => {
                      if (!tipoFinal) return;
                      abrirDia(tipoFinal);
                    }}
                    className={`
                      touch-manipulation
                      flex h-20 flex-col items-center justify-between gap-1.5
                      rounded-2xl border px-2 py-2 md:h-24
                      transition
                      ${
                        tipoFinal
                          ? getDayClasses(tipoFinal, fecha)
                          : esFinDeSemana(fecha)
                          ? "border-slate-200 bg-slate-100/80 text-slate-400"
                          : "border-slate-200 bg-white text-slate-400"
                      }
                      ${isHoy ? "ring-2 ring-[#2f5bd3] ring-offset-2" : ""}
                      ${seleccionado ? "shadow-md ring-2 ring-slate-400" : ""}
                      ${
                        tipoFinal
                          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                          : "cursor-default"
                      }
                    `}
                  >
                    {/* ───────── TOP ───────── */}
                    <div className="flex flex-col items-center gap-0.5">
                      <div
                        className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-bold leading-none ${
                          isHoy ? "bg-[#2f5bd3] text-white" : ""
                        }`}
                      >
                        {dia}
                      </div>

                      {tipoFinal?.estado && (
                        <span className="whitespace-nowrap rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase">
                          {ETIQUETA_ESTADO[tipoFinal.estado]}
                        </span>
                      )}
                    </div>

                    {/* ───────── CENTER ───────── */}
                    <div className="flex w-full flex-col items-center gap-0.5 px-1 text-center">
                      {tipoFinal?.turno && (
                        <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium text-slate-700">
                          {ETIQUETA_TURNO[tipoFinal.turno]}
                        </div>
                      )}

                      {tipoFinal?.turno === "MANANA" &&
                        tipoFinal.horaEntradaManana &&
                        tipoFinal.horaSalidaManana && (
                          <div className="text-[11px] leading-tight text-slate-600">
                            {tipoFinal.horaEntradaManana} -{" "}
                            {tipoFinal.horaSalidaManana}
                          </div>
                        )}

                      {tipoFinal?.turno === "TARDE" &&
                        tipoFinal.horaEntradaTarde &&
                        tipoFinal.horaSalidaTarde && (
                          <div className="text-[11px] leading-tight text-slate-600">
                            {tipoFinal.horaEntradaTarde} -{" "}
                            {tipoFinal.horaSalidaTarde}
                          </div>
                        )}

                      {tipoFinal?.turno === "MANANA_TARDE" && (
                        <div className="text-[11px] leading-tight text-slate-600">
                          {tipoFinal.horaEntradaManana} -{" "}
                          {tipoFinal.horaSalidaManana}
                          <br />
                          {tipoFinal.horaEntradaTarde} -{" "}
                          {tipoFinal.horaSalidaTarde}
                        </div>
                      )}

                      {tipoFinal?.horas && tipoFinal.estado !== "DIA_LIBRE" && (
                        <div className="mt-0.5 text-[10px] font-semibold text-slate-700">
                          {tipoFinal.horas}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* DETALLE DÍA */}
        {diaActivo && (
          <div
            ref={detalleRef}
            className="scroll-mt-4 space-y-5 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_14px_34px_-20px_rgba(29,36,51,0.25)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold capitalize tracking-tight text-slate-900">
                  {nombreDia(diaActivo.fecha)}
                </div>
                <div className="text-sm text-slate-500">
                  {formatFechaES(diaActivo.fecha)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {diaActivo.estado && (
                  <span className="rounded-full bg-[#e3eafb] px-3 py-1 text-xs font-semibold text-[#2f5bd3]">
                    {ETIQUETA_ESTADO[diaActivo.estado]}
                  </span>
                )}

                {diaActivo.horas && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                    {diaActivo.horas}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setDiaActivo(null)}
                  aria-label="Cerrar detalle"
                  title="Cerrar"
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {diaActivo.turno && (
              <div className="rounded-2xl bg-[#f5f7fc] px-4 py-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">
                  {ETIQUETA_TURNO[diaActivo.turno]}
                </span>
                {(diaActivo.turno === "MANANA" ||
                  diaActivo.turno === "MANANA_TARDE") &&
                  diaActivo.horaEntradaManana &&
                  diaActivo.horaSalidaManana && (
                    <span className="ml-3">
                      {diaActivo.horaEntradaManana} -{" "}
                      {diaActivo.horaSalidaManana}
                    </span>
                  )}
                {(diaActivo.turno === "TARDE" ||
                  diaActivo.turno === "MANANA_TARDE") &&
                  diaActivo.horaEntradaTarde &&
                  diaActivo.horaSalidaTarde && (
                    <span className="ml-3">
                      {diaActivo.horaEntradaTarde} - {diaActivo.horaSalidaTarde}
                    </span>
                  )}
              </div>
            )}

            <div className="space-y-3">
              {agruparFichajes(diaActivo.fichajes).map((b, i) => {
                const duracion = b.salida
                  ? minutosEntre(b.entrada, b.salida)
                  : null;

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white px-5 py-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 text-lg font-semibold text-slate-800">
                        <span>{b.entrada}</span>
                        <ArrowRight size={18} className="text-slate-400" />
                        <span>{b.salida ?? "—"}</span>
                      </div>

                      <div className="flex gap-6 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <LogIn size={14} className="text-emerald-600" />
                          Entrada
                        </div>
                        <div className="flex items-center gap-1">
                          <LogOut size={14} className="text-[#2f5bd3]" />
                          Salida
                        </div>
                      </div>
                    </div>

                    {duracion !== null && (
                      <div className="rounded-full bg-[#eef1fa] px-3 py-1 text-sm font-semibold text-slate-700">
                        {Math.floor(duracion / 60)} h {duracion % 60} min
                      </div>
                    )}
                  </div>
                );
              })}

              {agruparFichajes(diaActivo.fichajes).length === 0 && (
                <p className="rounded-2xl bg-[#f5f7fc] px-4 py-3 text-sm text-slate-500">
                  No hay fichajes registrados este día.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}