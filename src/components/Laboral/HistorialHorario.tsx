import { useEffect, useState } from "react";
import api from "../../services/api";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Timer,
} from "lucide-react";
import {
  addDias,
  esFinDeSemana,
  esMesFuturo,
  etiquetaMes,
  formatFechaES,
  lunesDe,
  mesActualISO,
  minutosAHoras,
  nombreDia,
  nombreDiaCorto,
  parseISO,
  sumarMes,
  ultimoDiaDelMes,
} from "../../utils/fechasES";

/* =======================
   TIPOS
======================= */
type Fichaje = {
  tipo: "ENTRADA" | "SALIDA";
  hora: string;
};

type Dia = {
  fecha: string;
  diaSemana: string;
  estado?: string | null; // VACACIONES | DIA_LIBRE | BAJA | FESTIVO
  minutosTrabajados: number;
  fichajes: Fichaje[];
};

type HistorialResponse = {
  mes: string; // YYYY-MM
  totalHoras: string;
  diasTrabajados: number;
  horasContratadasSemana: number;
  dias: Dia[];
};

type AjusteSaldo = {
  id: string;
  fecha: string;
  tipo: "DESCANSO" | "NOMINA" | "REGULARIZACION";
  minutos: number;
  comentario: string;
};

type Saldo = {
  saldoMinutos: number;
  esMesActual: boolean;
  esMesFuturo: boolean;
  aperturaMinutos: number; // lo que traía de meses anteriores
  mesMinutos: number; // horas del mes (trabajadas − las que tocaban)
  ajustesMesMinutos: number;
  cierreMinutos: number; // apertura + mes + ajustes
  confirmadoMinutos: number; // pendiente real (sin el mes en curso)
  ajustes: AjusteSaldo[];
};

const ETIQUETA_AJUSTE: Record<AjusteSaldo["tipo"], string> = {
  DESCANSO: "Compensadas con descanso",
  NOMINA: "Pagadas en nómina",
  REGULARIZACION: "Regularización",
};

const conSigno = (min: number) =>
  min === 0 ? "0 h 00 min" : `${min > 0 ? "+" : "-"}${minutosAHoras(Math.abs(min))}`;

type Semana = {
  label: string;
  dias: Dia[];
  totalMin: number;
  objetivoMin: number; // horas que tocaban (sin días libres, vacaciones, bajas ni festivos)
  parcial: boolean; // la semana continúa en el mes anterior o siguiente
  fin: string; // domingo (YYYY-MM-DD)
};

/* =======================
   HELPERS
======================= */
const formatearMes = (mes: string) => {
  const { y, m } = parseISO(`${mes}-01`);
  return etiquetaMes(y, m);
};

const aMin = (h: string) => {
  const [hh, mm] = h.split(":").map(Number);
  return (hh || 0) * 60 + (mm || 0);
};

type Tramo = { entrada: string; salida: string | null };

const construirTramos = (fichajes: Fichaje[]): Tramo[] => {
  const ordenados = [...fichajes].sort((a, b) => a.hora.localeCompare(b.hora));
  const tramos: Tramo[] = [];
  ordenados.forEach((f) => {
    if (f.tipo === "ENTRADA") {
      tramos.push({ entrada: f.hora, salida: null });
    } else if (tramos.length > 0 && tramos[tramos.length - 1].salida === null) {
      tramos[tramos.length - 1].salida = f.hora;
    }
  });
  return tramos;
};

/* =======================
   COMPONENTE
======================= */
export default function HistorialHorario() {
  const [mesActual, setMesActual] = useState(mesActualISO());
  const [data, setData] = useState<HistorialResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [verAjustes, setVerAjustes] = useState(false);

  // Bolsa de horas (no bloquea la pantalla si falla)
  useEffect(() => {
    let cancelado = false;
    api
      .get("/horario/saldo", { params: { mes: mesActual } })
      .then((res) => {
        if (!cancelado) setSaldo(res.data);
      })
      .catch(() => {
        if (!cancelado) setSaldo(null);
      });
    return () => {
      cancelado = true;
    };
  }, [intento, mesActual]);

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      setLoading(true);
      setError(false);
      setOpenDay(null);

      try {
        const res = await api.get("/horario/historial", {
          params: { mes: mesActual },
        });

        if (!cancelado) setData(res.data);
      } catch {
        if (!cancelado) {
          setData(null);
          setError(true);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    cargar();

    return () => {
      cancelado = true;
    };
  }, [mesActual, intento]);

  const siguienteBloqueado = esMesFuturo(sumarMes(mesActual, 1));

  const botonMes =
    "flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f3f8] text-slate-600 transition";

  const cabecera = (
    <div className="space-y-4">
      <h1 className="text-[1.65rem] font-bold tracking-tight text-slate-900">
        Historial
      </h1>

      <div className="flex items-center justify-between gap-2 rounded-full bg-white p-1.5 shadow-[0_10px_28px_-18px_rgba(29,36,51,0.25)] ring-1 ring-slate-200/70">
        <button
          type="button"
          onClick={() => setMesActual(sumarMes(mesActual, -1))}
          aria-label="Mes anterior"
          className={`${botonMes} cursor-pointer hover:bg-[#eef1fa] hover:text-[#2f5bd3] active:scale-95`}
        >
          <ChevronLeft size={20} />
        </button>

        <span className="text-center text-base font-semibold capitalize text-slate-900">
          {formatearMes(mesActual)}
        </span>

        <button
          type="button"
          onClick={() => setMesActual(sumarMes(mesActual, 1))}
          disabled={siguienteBloqueado}
          aria-label="Mes siguiente"
          className={`${botonMes} ${
            siguienteBloqueado
              ? "cursor-not-allowed opacity-40"
              : "cursor-pointer hover:bg-[#eef1fa] hover:text-[#2f5bd3] active:scale-95"
          }`}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );

  /* ---------- Carga inicial ---------- */
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#f1f3f8] py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {cabecera}
          <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
            <Loader2 className="animate-spin text-[#2f5bd3]" size={22} />
            Cargando historial…
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Error / sin datos ---------- */
  if (!data) {
    return (
      <div className="min-h-screen bg-[#f1f3f8] py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {cabecera}
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200/70 bg-white px-6 py-14 text-center shadow-[0_14px_34px_-20px_rgba(29,36,51,0.25)]">
            <AlertCircle
              size={30}
              className={error ? "text-red-500" : "text-slate-400"}
            />
            <p className="font-medium text-slate-700">
              {error
                ? "No se ha podido cargar el historial."
                : "No hay datos disponibles"}
            </p>
            <button
              type="button"
              onClick={() => setIntento((n) => n + 1)}
              className="cursor-pointer rounded-full bg-[#2f5bd3] px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_-10px_rgba(47,91,211,0.7)] transition hover:bg-[#2548b3]"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Cálculos ---------- */
  const dias = data.dias ?? [];
  const mesDatos = data.mes || mesActual;

  const minutosContratoSemana = Number(data.horasContratadasSemana ?? 0) * 60;

  const diasTrabajados = dias.filter(
    (d) => (d.minutosTrabajados ?? 0) > 0
  ).length;

  const totalMinutosMes = dias.reduce(
    (acc, d) => acc + (d.minutosTrabajados ?? 0),
    0
  );

  const mediaDiaria =
    diasTrabajados > 0 ? totalMinutosMes / diasTrabajados : 0;

  /* =======================
     AGRUPAR POR SEMANAS
  ======================= */
  const { y: yMes, m: mMes } = parseISO(`${mesDatos}-01`);
  const primerDiaMes = `${mesDatos}-01`;
  const ultimoDiaMes = `${mesDatos}-${String(
    ultimoDiaDelMes(yMes, mMes)
  ).padStart(2, "0")}`;

  const semanas: Record<string, Semana> = {};

  dias.forEach((dia) => {
    const lunes = lunesDe(dia.fecha);

    if (!semanas[lunes]) {
      const domingo = addDias(lunes, 6);

      semanas[lunes] = {
        label: `Semana del ${formatFechaES(lunes)} al ${formatFechaES(
          domingo
        )}`,
        dias: [],
        totalMin: 0,
        objetivoMin: 0,
        parcial: lunes < primerDiaMes || domingo > ultimoDiaMes,
        fin: domingo,
      };
    }

    semanas[lunes].dias.push(dia);
    semanas[lunes].totalMin += dia.minutosTrabajados ?? 0;

    // Solo cuenta como día a cumplir si es laborable y no tiene estado
    if (!dia.estado && !esFinDeSemana(dia.fecha)) {
      semanas[lunes].objetivoMin += minutosContratoSemana / 5;
    }
  });

  const hoyISO = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Europe/Madrid",
  });

  const listaSemanas = Object.entries(semanas)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, semana]) => semana)
    .filter((semana) => semana.totalMin > 0);

  return (
    <div className="min-h-screen bg-[#f1f3f8] py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {cabecera}

        {/* RESUMEN DEL MES */}
        <div className="rounded-3xl bg-gradient-to-br from-[#2f5bd3] to-[#6d5be0] p-5 text-white shadow-[0_18px_36px_-18px_rgba(47,91,211,0.7)]">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/75">
            Horas trabajadas
          </div>
          <div className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
            {minutosAHoras(totalMinutosMes)}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/75">
                <CalendarDays size={13} /> Días
              </div>
              <div className="mt-0.5 text-lg font-bold">{diasTrabajados}</div>
            </div>
            <div className="rounded-2xl bg-white/15 px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/75">
                <Timer size={13} /> Media por día
              </div>
              <div className="mt-0.5 text-lg font-bold">
                {diasTrabajados > 0 ? minutosAHoras(mediaDiaria) : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* BOLSA DE HORAS */}
        {saldo && !saldo.esMesFuturo && (
          <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-[0_10px_28px_-18px_rgba(29,36,51,0.22)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Bolsa de horas
                </div>
                <div
                  className={`text-2xl font-bold ${
                    saldo.confirmadoMinutos > 0
                      ? "text-emerald-600"
                      : saldo.confirmadoMinutos < 0
                      ? "text-red-600"
                      : "text-slate-900"
                  }`}
                >
                  {conSigno(saldo.confirmadoMinutos)}
                </div>
                <div className="text-xs text-slate-500">
                  {saldo.confirmadoMinutos > 0
                    ? "A tu favor"
                    : saldo.confirmadoMinutos < 0
                    ? "Pendientes de recuperar"
                    : "Estás al día"}
                  {saldo.esMesActual
                    ? " · meses cerrados"
                    : " · al cierre del mes"}
                </div>
                <div className="text-xs text-slate-500">
                  Del mes anterior {conSigno(saldo.aperturaMinutos)} · Este mes{" "}
                  {conSigno(saldo.mesMinutos + saldo.ajustesMesMinutos)}
                  {saldo.esMesActual ? " (en curso)" : ""}
                </div>
              </div>

              {saldo.ajustes.some((a) => a.fecha.slice(0, 7) === mesActual) && (
                <button
                  type="button"
                  onClick={() => setVerAjustes((v) => !v)}
                  aria-expanded={verAjustes}
                  className="flex cursor-pointer items-center gap-1 rounded-full bg-[#eef1fa] px-3 py-1.5 text-xs font-semibold text-[#2f5bd3]"
                >
                  Detalle
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${
                      verAjustes ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}
            </div>

            {verAjustes && (
              <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                {saldo.ajustes
                  .filter((a) => a.fecha.slice(0, 7) === mesActual)
                  .map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800">
                        {ETIQUETA_AJUSTE[a.tipo]}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {formatFechaES(a.fecha)}
                        {a.comentario ? ` · ${a.comentario}` : ""}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 font-bold ${
                        a.minutos < 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {conSigno(a.minutos)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* SEMANAS */}
        <div
          className={`space-y-6 transition-opacity ${
            loading ? "opacity-50" : "opacity-100"
          }`}
        >
          {listaSemanas.length === 0 && (
            <div className="rounded-3xl border border-slate-200/70 bg-white px-6 py-12 text-center text-slate-500 shadow-[0_14px_34px_-20px_rgba(29,36,51,0.25)]">
              No hay jornadas registradas este mes.
            </div>
          )}

          {listaSemanas.map((semana) => {
            const objetivoSemana = semana.objetivoMin;
            const hayContrato = objetivoSemana > 0;
            const diff = semana.totalMin - objetivoSemana;
            const cerrada = semana.fin < hoyISO;
            const mostrarDiff = hayContrato && !semana.parcial && cerrada;
            const mostrarProgreso = hayContrato && !semana.parcial;
            const porcentaje = hayContrato
              ? Math.min(100, (semana.totalMin / objetivoSemana) * 100)
              : 0;

            return (
              <section
                key={semana.label}
                className="space-y-3 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-[0_14px_34px_-20px_rgba(29,36,51,0.25)] sm:p-5"
              >
                {/* CABECERA SEMANA */}
                <div className="px-1 pb-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-600">
                      {semana.label}
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      {minutosAHoras(semana.totalMin)}
                    </div>
                  </div>

                  {mostrarProgreso && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6eaf5]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            mostrarDiff && diff >= 0
                              ? "bg-emerald-500"
                              : "bg-gradient-to-r from-[#2f5bd3] to-[#5b8def]"
                          }`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>

                      {mostrarDiff ? (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            diff > 0
                              ? "bg-emerald-50 text-emerald-700"
                              : diff < 0
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {diff > 0 ? "+" : diff < 0 ? "-" : ""}
                          {minutosAHoras(Math.abs(diff))}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs font-medium text-slate-500">
                          de {minutosAHoras(objetivoSemana)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* DÍAS */}
                {semana.dias
                  .filter((dia) => (dia.minutosTrabajados ?? 0) > 0)
                  .map((dia) => {
                    const abierto = openDay === dia.fecha;

                    const tramos = construirTramos(dia.fichajes ?? []);

                    return (
                      <div
                        key={dia.fecha}
                        className={`rounded-2xl border transition ${
                          abierto
                            ? "border-[#c9d6f6] bg-[#f5f8ff]"
                            : "border-slate-200/70 bg-white hover:border-slate-300"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenDay(abierto ? null : dia.fecha)
                          }
                          aria-expanded={abierto}
                          className="flex w-full cursor-pointer items-center gap-4 rounded-2xl p-3 text-left"
                        >
                          <div
                            className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${
                              abierto
                                ? "bg-[#2f5bd3] text-white"
                                : "bg-[#eef1fa] text-slate-700"
                            }`}
                          >
                            <span className="text-lg font-bold">
                              {parseISO(dia.fecha).d}
                            </span>
                            <span className="mt-0.5 text-[10px] font-semibold uppercase">
                              {nombreDiaCorto(dia.fecha)}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-semibold capitalize text-slate-900">
                              {dia.diaSemana || nombreDia(dia.fecha)}
                            </div>
                            <div className="text-sm text-slate-500">
                              {formatFechaES(dia.fecha)}
                            </div>
                          </div>

                          <div className="font-bold text-slate-900">
                            {minutosAHoras(dia.minutosTrabajados ?? 0)}
                          </div>

                          <ChevronDown
                            size={18}
                            className={`shrink-0 text-slate-400 transition-transform ${
                              abierto ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {abierto && (
                          <div className="border-t border-[#dbe4f8] px-4 pb-4 pt-3">
                            {tramos.length === 0 && (
                              <p className="text-sm text-slate-500">
                                Sin fichajes registrados.
                              </p>
                            )}

                            <ol className="space-y-3">
                              {tramos.map((t, i) => {
                                const dur =
                                  t.salida !== null
                                    ? Math.max(0, aMin(t.salida) - aMin(t.entrada))
                                    : null;
                                return (
                                  <li key={i} className="flex items-start gap-3">
                                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                                      <Check size={14} strokeWidth={3} />
                                    </span>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-900">
                                          {t.entrada} –{" "}
                                          {t.salida ?? "en curso"}
                                        </span>
                                        {dur !== null && (
                                          <span className="rounded-full bg-[#e3eafb] px-2.5 py-0.5 text-xs font-semibold text-[#2f5bd3]">
                                            {minutosAHoras(dur)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        Entrada · {t.salida ? "Salida" : "sin salida"}
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}