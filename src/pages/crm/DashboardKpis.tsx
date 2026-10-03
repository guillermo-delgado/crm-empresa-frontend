import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Coins,
  Maximize2,
  X,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Venta = {
  _id: string;
  fechaEfecto: string;
  createdAt?: string;
  ramo: string;
  primaNeta: number;
};

type Props = {
  ventas: Venta[];
  ventasProduccionSemanal?: Venta[];
  kpis: any;
  isAdmin: boolean;
  // Se mantiene por compatibilidad con LibroVentas; los widgets de actividad y
  // semanas usan SIEMPRE la fecha de venta registrada (createdAt).
  modoFecha?: "efecto" | "venta";
  mes: number;
  anio: number;
  onSemanaClick?: (ventaIds: string[] | null) => void;
};

const CARD =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(29,36,51,0.04),0_10px_28px_-18px_rgba(29,36,51,0.22)]";

  

const coloresRamo = [
  "#2f5bd3",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#06b6d4",
  "#64748b",
];


function euros(value: number) {
  return value.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}



function KPIBox({
  title,
  subtitle,
  value,
  variation,
  icon,
  iconBackground,
  iconColor,
  isAdmin,
}: {
  title: string;
  subtitle?: string;
  value: string;
  variation?: number | null;
  icon: React.ReactNode;
  iconBackground: string;
  iconColor: string;
  isAdmin: boolean;
}) {
  const positive =
    typeof variation === "number" && variation > 0;

  const negative =
    typeof variation === "number" && variation < 0;

  return (
    <div className={`${CARD} relative min-h-[149px] overflow-hidden p-5 transition-shadow hover:shadow-[0_14px_32px_-18px_rgba(29,36,51,0.3)]`}>
      <div className="flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${iconBackground} ${iconColor}`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {title}
          </p>

          {subtitle && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f5bd3]">
              {subtitle}
            </p>
          )}

          <p className="mt-2.5 text-[26px] font-bold leading-none tracking-tight text-slate-900">
            {value}
          </p>

          {isAdmin && typeof variation === "number" && (
            <div className="mt-3">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  positive
                    ? "bg-emerald-50 text-emerald-700"
                    : negative
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {positive ? "↑ +" : negative ? "↓ " : ""}
                {variation.toFixed(0)}%
              </span>

              <p className="mt-1.5 text-xs text-slate-400">
                Respecto al mes anterior
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function MaximizeButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full p-2 text-slate-400 transition hover:bg-[#eef1fa] hover:text-[#2f5bd3]"
      aria-label={label}
      title="Maximizar"
    >
      <Maximize2 size={16} />
    </button>
  );
}

function MaximizablePanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: (expanded: boolean) => React.ReactNode;
}) {
  const [maximizado, setMaximizado] = useState(false);

  return (
    <>
      <section className={`${CARD} flex min-w-0 flex-col p-5`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
            {title}
            {subtitle && (
              <span className="ml-1 font-normal text-slate-500">
                ({subtitle})
              </span>
            )}
          </h3>

          <div className="flex shrink-0 items-center gap-2">
            {title === "Producción por semanas" && (
              <span className="hidden whitespace-nowrap text-xs text-slate-400 sm:inline">
                Ventas registradas
              </span>
            )}
            {title === "Actividad comercial diaria" && (
              <span className="hidden whitespace-nowrap text-xs text-slate-400 sm:inline">
                Por fecha de venta
              </span>
            )}
            {title === "Producción por ramo" && (
              <span className="hidden whitespace-nowrap text-xs text-slate-400 sm:inline">
                Distribución mensual
              </span>
            )}
            <MaximizeButton
              onClick={() => setMaximizado(true)}
              label={`Maximizar ${title}`}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">{children(false)}</div>
      </section>

      {maximizado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8">
          <section className="relative max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1 text-sm text-slate-500">
                    {subtitle === "fecha de efecto" || subtitle === "fecha de venta"
                      ? `Datos por ${subtitle}`
                      : "Distribución mensual detallada"}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMaximizado(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label={`Cerrar ${title}`}
                title="Cerrar"
              >
                <X size={22} />
              </button>
            </div>

            {children(true)}
          </section>
        </div>
      )}
    </>
  );
}

function RamoDonut({
  datos,
  totalPolizas,
  totalPrima,
  expanded = false,
}: {
  datos: Array<[string, number, number]>;
  totalPolizas: number;
  totalPrima: number;
  expanded?: boolean;
}) {
  const segmentos = useMemo(() => {
    let acumuladoPolizas = 0;
    let acumuladoPrima = 0;

    const primaTotal = datos.reduce((sum, [, , prima]) => sum + prima, 0);

    return datos.map(([ramo, polizas, prima], index) => {
      const porcentajePolizas =
        totalPolizas > 0 ? (polizas / totalPolizas) * 100 : 0;
      const porcentajePrima =
        primaTotal > 0 ? (prima / primaTotal) * 100 : 0;

      const polizasInicio = acumuladoPolizas;
      acumuladoPolizas += porcentajePolizas;

      const primaInicio = acumuladoPrima;
      acumuladoPrima += porcentajePrima;

      return {
        ramo,
        polizas,
        prima,
        porcentajePolizas,
        porcentajePrima,
        polizasInicio,
        polizasFin: acumuladoPolizas,
        primaInicio,
        primaFin: acumuladoPrima,
        color: coloresRamo[index % coloresRamo.length],
      };
    });
  }, [datos, totalPolizas]);

  const valoresPolizas = segmentos.map((s) => ({
    pct: s.porcentajePolizas,
    color: s.color,
    nombre: `${s.ramo}: ${s.polizas}`,
  }));

  const valoresPrima = segmentos.map((s) => ({
    pct: s.porcentajePrima,
    color: s.color,
    nombre: `${s.ramo}: ${euros(s.prima)}`,
  }));

  const Donut = ({
    valores,
    value,
    label,
    compact = false,
  }: {
    valores: Array<{ pct: number; color: string; nombre: string }>;
    value: string | number;
    label: string;
    compact?: boolean;
  }) => {
    const size = compact ? 132 : 210;
    const grosor = compact ? 14 : 20;
    const radio = (size - grosor) / 2;
    const circunferencia = 2 * Math.PI * radio;
    const visibles = valores.filter((v) => v.pct > 0);
    const separacion = visibles.length > 1 ? grosor + (compact ? 3 : 5) : 0;
    let acumulado = 0;

    return (
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radio}
            fill="none"
            stroke="#eef1f8"
            strokeWidth={grosor}
          />

          {visibles.map((v) => {
            const largoTotal = (circunferencia * v.pct) / 100;
            const largo = Math.max(largoTotal - separacion, 0.01);
            const inicio = acumulado + separacion / 2;
            acumulado += largoTotal;

            return (
              <circle
                key={v.nombre}
                cx={size / 2}
                cy={size / 2}
                r={radio}
                fill="none"
                stroke={v.color}
                strokeWidth={grosor}
                strokeLinecap={visibles.length > 1 ? "round" : "butt"}
                strokeDasharray={`${largo} ${circunferencia - largo}`}
                strokeDashoffset={-inicio}
                className="transition-opacity hover:opacity-80"
              >
                <title>{v.nombre}</title>
              </circle>
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className={
              compact
                ? "text-xl font-bold leading-none tracking-tight text-slate-900"
                : "whitespace-nowrap text-base font-bold leading-tight tracking-tight text-slate-900"
            }
          >
            {value}
          </span>
          <span
            className={
              compact
                ? "mt-1 text-[10px] font-medium uppercase tracking-wider text-slate-400"
                : "mt-1 text-xs font-medium uppercase tracking-wider text-slate-400"
            }
          >
            {label}
          </span>
        </div>
      </div>
    );
  };

  if (!expanded) {
    return (
      <div className="grid w-full min-w-0 grid-cols-[132px_minmax(0,1fr)] items-center gap-4">
        <Donut
          valores={valoresPolizas}
          value={totalPolizas}
          label="pólizas"
          compact
        />

        <div className="min-w-0 space-y-2">
          {segmentos.map((s) => (
            <div
              key={s.ramo}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate text-slate-600" title={s.ramo}>
                  {s.ramo}
                </span>
              </div>
              <span className="whitespace-nowrap font-semibold text-slate-700">
                {s.polizas}
              </span>
              <span className="whitespace-nowrap text-slate-400">
                ({s.porcentajePolizas.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Resumen superior */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-[#f5f7fc] px-5 py-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pólizas
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {totalPolizas}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Distribución por número de pólizas
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-[#f5f7fc] px-5 py-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Prima total
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {euros(totalPrima)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Distribución económica
          </div>
        </div>
      </div>

      {/* Dos análisis independientes */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Distribución por pólizas
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Peso de cada ramo sobre el total de pólizas.
            </p>
          </div>

          <div className="flex items-center gap-7">
            <Donut
              valores={valoresPolizas}
              value={totalPolizas}
              label="pólizas"
            />

            <div className="min-w-0 flex-1 space-y-3">
              {segmentos.map((s) => (
                <div
                  key={s.ramo}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span
                      className="truncate text-sm text-slate-700"
                      title={s.ramo}
                    >
                      {s.ramo}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-slate-900">
                      {s.polizas}
                    </span>
                    <span className="ml-1 text-xs text-slate-400">
                      ({s.porcentajePolizas.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Distribución por prima
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Peso económico de cada ramo sobre la prima total.
            </p>
          </div>

          <div className="flex items-center gap-7">
            <Donut
              valores={valoresPrima}
              value={euros(totalPrima)}
              label="prima"
            />

            <div className="min-w-0 flex-1 space-y-3">
              {segmentos.map((s) => (
                <div
                  key={s.ramo}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span
                      className="truncate text-sm text-slate-700"
                      title={s.ramo}
                    >
                      {s.ramo}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-slate-900">
                      {euros(s.prima)}
                    </span>
                    <span className="ml-1 text-xs text-slate-400">
                      ({s.porcentajePrima.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function ProduccionSemanal({
  ventas,
  mes,
  anio,
  expanded = false,
  onSemanaClick,
}: {
  ventas: Venta[];
  mes: number;
  anio: number;
  expanded?: boolean;
  onSemanaClick?: (ventaIds: string[] | null) => void;
}) {
  const [semanaVentaIds, setSemanaVentaIds] = useState<string[] | null>(null);

  const semanas = useMemo(() => {
    // Todas las operaciones de calendario se realizan con fechas UTC de medianoche.
    const fechaCalendario = (
      fecha: string | undefined
    ): string | null => {
      if (!fecha) return null;

      const soloFecha =
        /^(\d{4})-(\d{2})-(\d{2})$/.exec(
          fecha.slice(0, 10)
        );

      if (soloFecha && fecha.length === 10) {
        const [, year, month, day] = soloFecha;

        const comprobacion = new Date(
          Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day)
          )
        );

        if (
          comprobacion.getUTCFullYear() !== Number(year) ||
          comprobacion.getUTCMonth() !== Number(month) - 1 ||
          comprobacion.getUTCDate() !== Number(day)
        ) {
          return null;
        }

        return `${year}-${month}-${day}`;
      }

      const instant = new Date(fecha);

      if (Number.isNaN(instant.getTime())) {
        return null;
      }

      const partes = new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "Europe/Madrid",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }
      ).formatToParts(instant);

      const year = partes.find(
        (parte) => parte.type === "year"
      )?.value;

      const month = partes.find(
        (parte) => parte.type === "month"
      )?.value;

      const day = partes.find(
        (parte) => parte.type === "day"
      )?.value;

      if (!year || !month || !day) {
        return null;
      }

      return `${year}-${month}-${day}`;
    };

    const aUtc = (clave: string) => {
      const [year, month, day] =
        clave.split("-").map(Number);

      return new Date(
        Date.UTC(year, month - 1, day)
      );
    };

    const clave = (fecha: Date) =>
      fecha.toISOString().slice(0, 10);

    const primerDiaMes = new Date(
      Date.UTC(anio, mes - 1, 1)
    );

    const ultimoDiaMes = new Date(
      Date.UTC(anio, mes, 0)
    );

    // Lunes = 0 ... domingo = 6
    const lunesIndex =
      (primerDiaMes.getUTCDay() + 6) % 7;

    const domingoIndex =
      (ultimoDiaMes.getUTCDay() + 6) % 7;

    const inicioCalendario =
      new Date(primerDiaMes);

    inicioCalendario.setUTCDate(
      inicioCalendario.getUTCDate() - lunesIndex
    );

    const finCalendario =
      new Date(ultimoDiaMes);

    finCalendario.setUTCDate(
      finCalendario.getUTCDate() +
        (6 - domingoIndex)
    );

    const resultado: {
      inicio: string;
      fin: string;
      total: number;
      ventas: number;
      ventaIds: string[];
    }[] = [];

    const cursor = new Date(
      inicioCalendario
    );

    while (cursor <= finCalendario) {
      const inicio = clave(cursor);

      const finDate = new Date(cursor);

      finDate.setUTCDate(
        finDate.getUTCDate() + 6
      );

      resultado.push({
        inicio,
        fin: clave(finDate),
        total: 0,
        ventas: 0,
        ventaIds: [],
      });

      cursor.setUTCDate(
        cursor.getUTCDate() + 7
      );
    }

    const inicioMesClave =
      clave(primerDiaMes);

    const finMesClave =
      clave(ultimoDiaMes);

    ventas.forEach((venta) => {
      const fecha = fechaCalendario(venta.createdAt);

      if (
        !fecha ||
        fecha < inicioMesClave ||
        fecha > finMesClave
      ) {
        return;
      }

      const fechaUtc = aUtc(fecha);

      const semana = resultado.find(
        (item) => {
          const inicio = aUtc(item.inicio);
          const fin = aUtc(item.fin);

          return (
            fechaUtc >= inicio &&
            fechaUtc <= fin
          );
        }
      );

      if (!semana) return;

      // EXACTAMENTE las ventas que entran en el cálculo semanal
      semana.total +=
        Number(venta.primaNeta) || 0;

      semana.ventas += 1;

      semana.ventaIds.push(venta._id);
    });

    return resultado;
  }, [ventas, mes, anio]);

  const maximo = Math.max(
    ...semanas.map(
      (semana) => semana.total
    ),
    1
  );

  const formatoFecha = (
    claveFecha: string
  ) =>
    aFechaLocalSegura(
      claveFecha
    ).toLocaleDateString(
      "es-ES",
      {
        day: "numeric",
        month: "short",
      }
    );

  // Límites del mes (claves YYYY-MM-DD): una semana que empieza en el mes
  // anterior o termina en el siguiente solo cuenta los días del propio mes.
  const inicioMesClave = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const finMesClave = `${anio}-${String(mes).padStart(2, "0")}-${String(
    new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  ).padStart(2, "0")}`;

  return (
    <div
      className={
        expanded
          ? "space-y-5"
          : "space-y-2"
      }
    >
      {semanas.map(
        (semana, index) => {
          const porcentaje =
            (semana.total / maximo) *
            100;

          const cuentaDesde =
            semana.inicio < inicioMesClave ? inicioMesClave : semana.inicio;
          const cuentaHasta =
            semana.fin > finMesClave ? finMesClave : semana.fin;

          return (
            <div
              key={`${semana.inicio}-${semana.fin}`}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto_28px] items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-[#f1f3f8]"
            >
              <button
                type="button"
                disabled={semana.total <= 0 || semana.ventas <= 0}
                onClick={() => {
                  if (semana.total <= 0 || semana.ventas <= 0) return;
                  setSemanaVentaIds(semana.ventaIds);
                  onSemanaClick?.(semana.ventaIds);
                }}
                className={`group col-span-1 min-w-0 text-left ${
                  semana.total <= 0 || semana.ventas <= 0
                    ? "cursor-default"
                    : "cursor-pointer"
                }`}
              >
                <div
                  className="mb-1 truncate text-[11px] text-slate-600 group-hover:text-[#2f5bd3]"
                  title={`Cuenta del ${formatoFecha(cuentaDesde)} al ${formatoFecha(cuentaHasta)}`}
                >
                  Semana {index + 1} (
                  {formatoFecha(semana.inicio)} - {formatoFecha(semana.fin)})
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#e6eaf5]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#2f5bd3] to-[#5b8def] transition-all group-hover:from-[#2548b3] group-hover:to-[#2f5bd3]"
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
              </button>

              <span className="whitespace-nowrap text-[11px] font-semibold text-slate-800">
                {euros(semana.total)}
              </span>

              <span className="whitespace-nowrap text-[11px] text-slate-500">
                {semana.ventas} ventas
              </span>

              <div className="flex h-6 w-6 items-center justify-center">
                {semana.total > 0 &&
                  semana.ventas > 0 &&
                  semanaVentaIds !== null &&
                  semana.ventaIds.some((id) => semanaVentaIds.includes(id)) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSemanaVentaIds(null);
                        onSemanaClick?.(null);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700"
                      title="Quitar filtro de esta semana"
                      aria-label="Quitar filtro de esta semana"
                    >
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  )}
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

function aFechaLocalSegura(claveFecha: string) {
  const [year, month, day] = claveFecha.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function ActividadComercialMaximizada({
  datos,
}: {
  datos: Array<{ dia: number; ventas: number; total: number }>;
}) {
  const totalPolizas = datos.reduce((total, item) => total + item.ventas, 0);
  const produccionTotal = datos.reduce((total, item) => total + item.total, 0);
  const mediaPorPoliza =
    totalPolizas > 0 ? produccionTotal / totalPolizas : 0;

  const datosGrafico = datos.map((item) => ({
    dia: String(item.dia).padStart(2, "0"),
    polizas: item.ventas,
    produccion: item.total,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-[#f5f7fc] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pólizas creadas
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {totalPolizas}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-[#f5f7fc] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Producción generada
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {euros(produccionTotal)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-[#f5f7fc] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Prima media
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {euros(mediaPorPoliza)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-3 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center gap-5 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#8fa9ee]" />
            Pólizas creadas
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1 w-5 rounded-full bg-[#2f5bd3]" />
            Producción (€)
          </div>
        </div>

        <div className="h-[360px] w-full sm:h-[440px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={datosGrafico}
              margin={{ top: 12, right: 18, left: 4, bottom: 8 }}
            >
              <defs>
                <linearGradient id="dkBarra" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7d9aeb" />
                  <stop offset="100%" stopColor="#d5def7" />
                </linearGradient>
                <linearGradient id="dkArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2f5bd3" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#2f5bd3" stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="#e6eaf5"
                vertical={false}
              />
              <XAxis
                dataKey="dia"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="polizas"
                allowDecimals={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={34}
                label={{
                  value: "Pólizas",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#64748b",
                  fontSize: 11,
                }}
              />
              <YAxis
                yAxisId="euros"
                orientation="right"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={66}
                tickFormatter={(value: number) =>
                  `${Math.round(value).toLocaleString("es-ES")} €`
                }
                label={{
                  value: "Producción",
                  angle: 90,
                  position: "insideRight",
                  fill: "#64748b",
                  fontSize: 11,
                }}
              />
              <Tooltip
                cursor={{ fill: "#f1f3f8" }}
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;

                  const polizas =
                    payload.find((item: any) => item.dataKey === "polizas")
                      ?.value ?? 0;
                  const produccion =
                    payload.find((item: any) => item.dataKey === "produccion")
                      ?.value ?? 0;

                  return (
                    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xl">
                      <p className="mb-3 text-sm font-semibold text-slate-900">
                        Día {label}
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-8">
                          <span className="text-slate-500">Pólizas creadas</span>
                          <span className="font-semibold text-slate-900">
                            {polizas}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-8">
                          <span className="text-slate-500">Producción</span>
                          <span className="font-semibold text-slate-900">
                            {euros(Number(produccion) || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                yAxisId="euros"
                type="monotone"
                dataKey="produccion"
                name="Producción"
                stroke="none"
                fill="url(#dkArea)"
                legendType="none"
                tooltipType="none"
                isAnimationActive={false}
              />
              <Bar
                yAxisId="polizas"
                dataKey="polizas"
                name="Pólizas creadas"
                fill="url(#dkBarra)"
                radius={[8, 8, 0, 0]}
                maxBarSize={26}
              />
              <Line
                yAxisId="euros"
                type="monotone"
                dataKey="produccion"
                name="Producción"
                stroke="#2f5bd3"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: "#2f5bd3", stroke: "#ffffff", strokeWidth: 3 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-[#f5f7fc] p-4">
        <p className="text-sm font-semibold text-slate-900">
          Detalle diario
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {datos
            .filter((item) => item.ventas > 0 || item.total > 0)
            .map((item) => (
              <div
                key={item.dia}
                className="rounded-xl border border-slate-200/70 bg-white p-3"
              >
                <p className="text-xs text-slate-500">Día {item.dia}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {item.ventas} pólizas
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {euros(item.total)}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function VentasDiarias({
  ventas,
  mes,
  anio,
  expanded = false,
}: {
  ventas: Venta[];
  mes: number;
  anio: number;
  expanded?: boolean;
}) {
  const datos = useMemo(() => {
    const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const resultado = Array.from({ length: diasDelMes }, (_, i) => ({
      dia: i + 1,
      ventas: 0,
      total: 0,
    }));

    ventas.forEach((venta) => {
      // Actividad comercial = SIEMPRE fecha de venta registrada (createdAt),
      // nunca la fecha de efecto.
      if (!venta.createdAt) return;

      const fecha = new Date(venta.createdAt);
      if (Number.isNaN(fecha.getTime())) return;

      const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(fecha);

      const year = Number(
        partes.find((p) => p.type === "year")?.value
      );
      const month = Number(
        partes.find((p) => p.type === "month")?.value
      );
      const day = Number(partes.find((p) => p.type === "day")?.value);

      if (year !== anio || month !== mes || day < 1 || day > diasDelMes) {
        return;
      }

      resultado[day - 1].ventas += 1;
      resultado[day - 1].total += Number(venta.primaNeta) || 0;
    });

    return resultado;
  }, [ventas, mes, anio]);

  if (expanded) {
    return <ActividadComercialMaximizada datos={datos} />;
  }

  const maxVentas = Math.max(...datos.map((item) => item.ventas), 1);
  const maxProduccion = Math.max(...datos.map((item) => item.total), 1);

  const ANCHO = 300;
  const BASE = 150;

  const puntos = datos.map((item) => ({
    x: datos.length === 1 ? ANCHO / 2 : ((item.dia - 1) / (datos.length - 1)) * ANCHO,
    y: BASE - (item.total / maxProduccion) * 125,
  }));

  const trazo = puntos
    .map((punto, index) => {
      if (index === 0) return `M ${punto.x} ${punto.y}`;
      const anterior = puntos[index - 1];
      const medio = (anterior.x + punto.x) / 2;
      return `C ${medio} ${anterior.y}, ${medio} ${punto.y}, ${punto.x} ${punto.y}`;
    })
    .join(" ");

  const area = `${trazo} L ${puntos[puntos.length - 1].x} ${BASE} L ${puntos[0].x} ${BASE} Z`;

  return (
    <div className="w-full">
      {/* Leyenda */}
      <div className="mb-4 flex items-center justify-center gap-2 text-[11px] font-medium text-slate-600">
        <span className="flex items-center gap-2 rounded-full bg-[#eef1fa] px-3 py-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#8fa9ee]" />
          Nº de pólizas
        </span>
        <span className="flex items-center gap-2 rounded-full bg-[#eef1fa] px-3 py-1">
          <span className="h-[3px] w-4 rounded-full bg-[#2f5bd3]" />
          Producción (€)
        </span>
      </div>

      {/* Gráfico */}
      <div className="relative h-[190px] w-full">
        {/* Rejilla */}
        <div className="pointer-events-none absolute inset-x-0 bottom-7 top-3 flex flex-col justify-between">
          <div className="border-t border-dashed border-slate-200/80" />
          <div className="border-t border-dashed border-slate-200/80" />
          <div className="border-t border-dashed border-slate-200/80" />
          <div className="border-t border-slate-200" />
        </div>

        {/* Barras */}
        <div className="absolute inset-x-0 bottom-7 top-3 flex items-end gap-[3px]">
          {datos.map((item) => (
            <div
              key={item.dia}
              className="flex h-full flex-1 items-end"
            >
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-[#d5def7] to-[#9db4f0] transition-all hover:from-[#b8c8f4] hover:to-[#6f8fe6]"
                style={{
                  height: `${(item.ventas / maxVentas) * 100}%`,
                  minHeight: item.ventas > 0 ? "4px" : "0",
                }}
                title={`${item.dia}: ${item.ventas} pólizas · ${euros(item.total)}`}
              />
            </div>
          ))}
        </div>

        {/* Línea de producción suavizada con área */}
        <svg
          viewBox={`0 0 ${ANCHO} 160`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 top-3 h-[160px] w-full"
        >
          <defs>
            <linearGradient id="dkAreaCompacta" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f5bd3" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2f5bd3" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#dkAreaCompacta)" />
          <path
            d={trazo}
            fill="none"
            stroke="#2f5bd3"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Eje inferior */}
        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] font-medium text-slate-400">
          <span>1</span>
          <span>5</span>
          <span>10</span>
          <span>15</span>
          <span>20</span>
          <span>25</span>
          <span>{datos.length}</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardKpis({
  ventas,
  ventasProduccionSemanal,
  kpis,
  isAdmin,
  mes,
  anio,
  onSemanaClick,
}: Props) {
  const produccionPorRamo = useMemo(() => {
    const resultado: Record<string, number> = {};

    ventas.forEach((venta) => {
      const ramo = venta.ramo || "Sin ramo";
      resultado[ramo] = (resultado[ramo] || 0) + (Number(venta.primaNeta) || 0);
    });

    return Object.entries(resultado).sort((a, b) => b[1] - a[1]);
  }, [ventas]);

  const polizasPorRamo = useMemo(() => {
    const resultado: Record<string, { polizas: number; prima: number }> = {};

    ventas.forEach((venta) => {
      const ramo = venta.ramo || "Sin ramo";

      if (!resultado[ramo]) {
        resultado[ramo] = { polizas: 0, prima: 0 };
      }

      resultado[ramo].polizas += 1;
      resultado[ramo].prima += Number(venta.primaNeta) || 0;
    });

    return Object.entries(resultado).sort(
      (a, b) => b[1].polizas - a[1].polizas
    );
  }, [ventas]);

  const datosRamoDonut = polizasPorRamo.map(
    ([ramo, datos]) => [ramo, datos.polizas, datos.prima] as [string, number, number]
  );

  const produccionTotal = ventas.reduce(
    (total, venta) => total + (Number(venta.primaNeta) || 0),
    0
  );

  // Producción comercial (Registro):
  // suma SIEMPRE las ventas registradas (createdAt) del periodo seleccionado,
  // independientemente de la fecha de efecto. LibroVentas ya pasa aquí
  // únicamente las ventas registradas que respetan aseguradora/usuario/ramo.
  const produccionRegistro = (ventasProduccionSemanal ?? []).reduce(
    (total, venta) => total + (Number(venta.primaNeta) || 0),
    0
  );

  const primaMedia = ventas.length > 0
    ? produccionTotal / ventas.length
    : 0;

  return (
    <div className="space-y-4">
<div
        className={
          isAdmin
            ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.35fr]"
            : "grid w-full grid-cols-1 gap-4 md:grid-cols-3"
        }
      >
        <KPIBox
          title={isAdmin ? "Producción total" : "Producción"}
          value={euros(produccionTotal)}
          variation={isAdmin ? kpis?.produccion?.variacionPct : undefined}
          isAdmin={isAdmin}
          icon={<Coins size={27} />}
          iconBackground="bg-emerald-100"
          iconColor="text-emerald-600"
        />

        {isAdmin ? (
          <>
            <KPIBox
              title="Producción comercial"
              subtitle="(Registro)"
              value={euros(produccionRegistro)}
              variation={kpis?.produccionCreated?.variacionPct}
              isAdmin
              icon={<BarChart3 size={27} />}
              iconBackground="bg-[#e3eafb]"
              iconColor="text-[#2f5bd3]"
            />

            <KPIBox
              title="Nº de ventas"
              value={String(ventas.length)}
              variation={kpis?.polizas?.variacionPct}
              isAdmin
              icon={<CalendarDays size={27} />}
              iconBackground="bg-purple-100"
              iconColor="text-purple-600"
            />
          </>
        ) : (
          <>
            <KPIBox
              title="Nº de ventas"
              value={String(ventas.length)}
              isAdmin={false}
              icon={<CalendarDays size={27} />}
              iconBackground="bg-purple-100"
              iconColor="text-purple-600"
            />

            <KPIBox
              title="Prima media"
              value={euros(primaMedia)}
              isAdmin={false}
              icon={<BarChart3 size={27} />}
              iconBackground="bg-[#e3eafb]"
              iconColor="text-[#2f5bd3]"
            />
          </>
        )}

        {isAdmin && (
          <div className={`${CARD} min-w-0 p-5`}>
            <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-slate-900">
              Producción por ramo
            </h3>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {produccionPorRamo.map(([ramo, total]) => (
                <div
                  key={ramo}
                  className="min-w-0 rounded-xl border border-slate-200/70 bg-[#f8f9fd] px-3 py-2"
                >
                  <p className="truncate text-xs text-slate-500" title={ramo}>
                    {ramo}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {euros(total)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <MaximizablePanel title="Producción por semanas">
          {(expanded) => (
            <ProduccionSemanal
              ventas={ventasProduccionSemanal ?? ventas}
              mes={mes}
              anio={anio}
              expanded={expanded}
              onSemanaClick={onSemanaClick}
            />
          )}
        </MaximizablePanel>

        <MaximizablePanel title="Actividad comercial diaria">
          {(expanded) => (
            <VentasDiarias
              ventas={ventasProduccionSemanal ?? ventas}
              mes={mes}
              anio={anio}
              expanded={expanded}
            />
          )}
        </MaximizablePanel>

        <MaximizablePanel title="Producción por ramo">
          {(expanded) => (
            <RamoDonut
              datos={datosRamoDonut}
              totalPolizas={ventas.length}
              totalPrima={produccionTotal}
              expanded={expanded}
            />
          )}
        </MaximizablePanel>
      </div>    </div>
  );
}