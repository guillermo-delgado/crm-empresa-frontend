import { useEffect, useState } from "react";
import api from "../../services/api";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  Timer,
} from "lucide-react";
import {
  addDias,
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

type Semana = {
  label: string;
  dias: Dia[];
  totalMin: number;
  parcial: boolean; // la semana continúa en el mes anterior o siguiente
};

/* =======================
   HELPERS
======================= */
const formatearMes = (mes: string) => {
  const { y, m } = parseISO(`${mes}-01`);
  return etiquetaMes(y, m);
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
    "flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 shadow-sm transition";

  const cabecera = (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => setMesActual(sumarMes(mesActual, -1))}
        aria-label="Mes anterior"
        className={`${botonMes} cursor-pointer hover:bg-[#eef1fa] hover:text-[#2f5bd3] active:scale-95`}
      >
        <ChevronLeft size={20} />
      </button>

      <h1 className="text-center text-xl font-bold capitalize tracking-tight text-slate-900 sm:text-2xl">
        Historial · {formatearMes(mesActual)}
      </h1>

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
  );

  /* ---------- Carga inicial ---------- */
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#f1f3f8] px-4 py-6">
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
      <div className="min-h-screen bg-[#f1f3f8] px-4 py-6">
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
        parcial: lunes < primerDiaMes || domingo > ultimoDiaMes,
      };
    }

    semanas[lunes].dias.push(dia);
    semanas[lunes].totalMin += dia.minutosTrabajados ?? 0;
  });

  const listaSemanas = Object.entries(semanas)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, semana]) => semana)
    .filter((semana) => semana.totalMin > 0);

  return (
    <div className="min-h-screen bg-[#f1f3f8] px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {cabecera}

        {/* RESUMEN DEL MES */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Resumen
            icono={<CalendarDays size={21} />}
            estilo="bg-emerald-50 text-emerald-600"
            titulo="Días trabajados"
            valor={String(diasTrabajados)}
          />
          <Resumen
            icono={<Clock size={21} />}
            estilo="bg-[#e3eafb] text-[#2f5bd3]"
            titulo="Horas trabajadas"
            valor={minutosAHoras(totalMinutosMes)}
          />
          <Resumen
            icono={<Timer size={21} />}
            estilo="bg-violet-50 text-violet-600"
            titulo="Media por día"
            valor={diasTrabajados > 0 ? minutosAHoras(mediaDiaria) : "—"}
          />
        </div>

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
            const hayContrato = minutosContratoSemana > 0;
            const diff = semana.totalMin - minutosContratoSemana;
            const mostrarDiff = hayContrato && !semana.parcial;
            const porcentaje = hayContrato
              ? Math.min(100, (semana.totalMin / minutosContratoSemana) * 100)
              : 0;

            return (
              <section
                key={semana.label}
                className="space-y-3 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-[0_14px_34px_-20px_rgba(29,36,51,0.25)] sm:p-5"
              >
                {/* CABECERA SEMANA */}
                <div className="rounded-2xl bg-[#f5f7fc] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-800">
                      {semana.label}
                    </div>

                    {semana.parcial && (
                      <span
                        title="Esta semana continúa en otro mes, por eso no se compara con el contrato."
                        className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200"
                      >
                        Semana parcial
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-sm text-slate-600">
                    <span>
                      Horas trabajadas:{" "}
                      <span className="font-semibold text-slate-900">
                        {minutosAHoras(semana.totalMin)}
                      </span>
                    </span>

                    {mostrarDiff && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
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
                    )}
                  </div>

                  {mostrarDiff && (
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#e6eaf5]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          diff >= 0
                            ? "bg-emerald-500"
                            : "bg-gradient-to-r from-[#2f5bd3] to-[#5b8def]"
                        }`}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* DÍAS */}
                {semana.dias
                  .filter((dia) => (dia.minutosTrabajados ?? 0) > 0)
                  .map((dia) => {
                    const abierto = openDay === dia.fecha;

                    const fichajesOrdenados = [...(dia.fichajes ?? [])].sort(
                      (a, b) => a.hora.localeCompare(b.hora)
                    );

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
                          <div className="space-y-2 border-t border-[#dbe4f8] px-4 pb-4 pt-3">
                            {fichajesOrdenados.length === 0 && (
                              <p className="text-sm text-slate-500">
                                Sin fichajes registrados.
                              </p>
                            )}

                            {fichajesOrdenados.map((f, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-sm"
                              >
                                <span
                                  className={`flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    f.tipo === "ENTRADA"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-[#e3eafb] text-[#2f5bd3]"
                                  }`}
                                >
                                  {f.tipo === "ENTRADA" ? (
                                    <LogIn size={13} />
                                  ) : (
                                    <LogOut size={13} />
                                  )}
                                  {f.tipo === "ENTRADA" ? "Entrada" : "Salida"}
                                </span>

                                <span className="font-semibold text-slate-800">
                                  {f.hora}
                                </span>
                              </div>
                            ))}
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

function Resumen({
  icono,
  estilo,
  titulo,
  valor,
}: {
  icono: React.ReactNode;
  estilo: string;
  titulo: string;
  valor: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_10px_28px_-18px_rgba(29,36,51,0.22)]">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${estilo}`}
      >
        {icono}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {titulo}
        </div>
        <div className="truncate text-xl font-bold leading-tight text-slate-900">
          {valor}
        </div>
      </div>
    </div>
  );
}