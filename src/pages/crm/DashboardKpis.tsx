
import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Coins,
  Maximize2,
  X,
} from "lucide-react";
import {
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
  kpis: any;
  isAdmin: boolean;
  modoFecha: "efecto" | "venta";
  mes: number;
  anio: number;
};

const CARD =
  "rounded-xl border border-slate-200 bg-white shadow-sm";

  

const coloresRamo = [
  "#2563eb",
  "#16a34a",
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
    <div className={`${CARD} min-h-[149px] p-5`}>
      <div className="flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${iconBackground} ${iconColor}`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>

          {subtitle && (
            <p className="text-xs font-semibold uppercase text-blue-600">
              {subtitle}
            </p>
          )}

          <p className="mt-2 text-[25px] font-bold leading-none tracking-tight text-slate-950">
            {value}
          </p>

          {isAdmin && typeof variation === "number" && (
            <div className="mt-3">
              <span
                className={`text-sm font-semibold ${
                  positive
                    ? "text-emerald-600"
                    : negative
                    ? "text-red-600"
                    : "text-slate-500"
                }`}
              >
                {positive ? "↑ +" : negative ? "↓ " : ""}
                {variation.toFixed(0)}%
              </span>

              <p className="mt-0.5 text-xs text-slate-500">
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
      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      aria-label={label}
      title="Maximizar"
    >
      <Maximize2 size={18} />
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
          <h3 className="text-sm font-semibold text-slate-900">
            {title}
            {subtitle && (
              <span className="ml-1 font-normal text-slate-500">
                ({subtitle})
              </span>
            )}
          </h3>

          <div className="flex shrink-0 items-center gap-2">
            {title === "Actividad comercial diaria" && (
              <span className="hidden whitespace-nowrap text-xs text-slate-400 sm:inline">
                Evolución mensual
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 sm:p-8">
          <section className="relative max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
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
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
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
  total,
  expanded = false,
}: {
  datos: Array<[string, number]>;
  total: number;
  expanded?: boolean;
}) {
  const segmentos = useMemo(() => {
    let acumulado = 0;

    return datos.map(([ramo, importe], index) => {
      const porcentaje = total > 0 ? (importe / total) * 100 : 0;
      const inicio = acumulado;
      acumulado += porcentaje;

      return {
        ramo,
        importe,
        porcentaje,
        inicio,
        fin: acumulado,
        color: coloresRamo[index % coloresRamo.length],
      };
    });
  }, [datos, total]);

  const gradient =
    segmentos.length > 0
      ? `conic-gradient(${segmentos
          .map(
            (segmento) =>
              `${segmento.color} ${segmento.inicio}% ${segmento.fin}%`
          )
          .join(", ")})`
      : "#e2e8f0";

  return (
    <div
      className={
        expanded
          ? "grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]"
          : "grid w-full min-w-0 grid-cols-[minmax(130px,0.95fr)_minmax(0,1.05fr)] items-center gap-4"
      }
    >
      <div className="flex min-w-0 items-center justify-center">
        <div
          className={
            expanded
              ? "relative aspect-square w-full max-w-[360px]"
              : "relative aspect-square w-full max-w-[210px]"
          }
        >
          <div className="h-full w-full rounded-full" style={{ background: gradient }} />
          <div
            className={
              expanded
                ? "absolute inset-[24%] flex flex-col items-center justify-center rounded-full bg-white text-center"
                : "absolute inset-[23%] flex flex-col items-center justify-center rounded-full bg-white px-1 text-center"
            }
          >
            <span
              className={
                expanded
                  ? "whitespace-nowrap text-3xl font-bold leading-none tracking-tight text-slate-900"
                  : "whitespace-nowrap text-[clamp(10px,1vw,16px)] font-bold leading-none tracking-[-0.04em] text-slate-900"
              }
            >
              {euros(total)}
            </span>
            <span
              className={
                expanded
                  ? "mt-3 text-base text-slate-500"
                  : "mt-2 text-[clamp(9px,0.7vw,12px)] leading-none text-slate-500"
              }
            >
              Total
            </span>
          </div>
        </div>
      </div>

      <div className={expanded ? "min-w-0 space-y-6" : "min-w-0 space-y-4"}>
        {segmentos.map((segmento) => (
          <div
            key={segmento.ramo}
            className={
              expanded
                ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"
                : "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
            }
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={expanded ? "h-4 w-4 shrink-0 rounded-full" : "h-3 w-3 shrink-0 rounded-full"}
                style={{ backgroundColor: segmento.color }}
              />
              <span
                className={
                  expanded
                    ? "min-w-0 break-words text-base text-slate-700"
                    : "min-w-0 truncate text-[clamp(10px,0.75vw,13px)] text-slate-600"
                }
                title={segmento.ramo}
              >
                {segmento.ramo}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <span
                className={
                  expanded
                    ? "text-base font-semibold text-slate-800"
                    : "text-[clamp(10px,0.75vw,13px)] font-semibold text-slate-700"
                }
              >
                {euros(segmento.importe)}
              </span>
              <span className={expanded ? "text-base text-slate-400" : "text-[clamp(9px,0.7vw,12px)] text-slate-400"}>
                ({segmento.porcentaje.toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProduccionSemanal({
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
  const semanas = useMemo(() => {
    // Todas las operaciones de calendario se realizan con fechas UTC de medianoche.
    // Así evitamos errores por cambios de hora, horario de verano y zona horaria local.
    const fechaCalendario = (fecha: string | undefined): string | null => {
      if (!fecha) return null;

      // Una fecha YYYY-MM-DD es una fecha de calendario y no debe convertirse
      // mediante new Date(), porque podría desplazarse al día anterior.
      const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.slice(0, 10));
      if (soloFecha && fecha.length === 10) {
        const [, year, month, day] = soloFecha;
        const comprobacion = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
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
      if (Number.isNaN(instant.getTime())) return null;

      const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(instant);

      const year = partes.find((parte) => parte.type === "year")?.value;
      const month = partes.find((parte) => parte.type === "month")?.value;
      const day = partes.find((parte) => parte.type === "day")?.value;

      if (!year || !month || !day) return null;
      return `${year}-${month}-${day}`;
    };

    const aUtc = (clave: string) => {
      const [year, month, day] = clave.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    };

    const clave = (fecha: Date) =>
      fecha.toISOString().slice(0, 10);

    const primerDiaMes = new Date(Date.UTC(anio, mes - 1, 1));
    const ultimoDiaMes = new Date(Date.UTC(anio, mes, 0));

    // En UTC: lunes = 0 ... domingo = 6.
    const lunesIndex = (primerDiaMes.getUTCDay() + 6) % 7;
    const domingoIndex = (ultimoDiaMes.getUTCDay() + 6) % 7;

    const inicioCalendario = new Date(primerDiaMes);
    inicioCalendario.setUTCDate(inicioCalendario.getUTCDate() - lunesIndex);

    const finCalendario = new Date(ultimoDiaMes);
    finCalendario.setUTCDate(finCalendario.getUTCDate() + (6 - domingoIndex));

    const resultado: {
      inicio: string;
      fin: string;
      total: number;
      ventas: number;
    }[] = [];

    const cursor = new Date(inicioCalendario);
    while (cursor <= finCalendario) {
      const inicio = clave(cursor);
      const finDate = new Date(cursor);
      finDate.setUTCDate(finDate.getUTCDate() + 6);

      resultado.push({
        inicio,
        fin: clave(finDate),
        total: 0,
        ventas: 0,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    const inicioMesClave = clave(primerDiaMes);
    const finMesClave = clave(ultimoDiaMes);

    ventas.forEach((venta) => {
      const fecha = fechaCalendario(venta.createdAt);
      if (!fecha || fecha < inicioMesClave || fecha > finMesClave) return;

      const fechaUtc = aUtc(fecha);
      const semana = resultado.find((item) => {
        const inicio = aUtc(item.inicio);
        const fin = aUtc(item.fin);
        return fechaUtc >= inicio && fechaUtc <= fin;
      });

      if (!semana) return;

      semana.total += Number(venta.primaNeta) || 0;
      semana.ventas += 1;
    });

    return resultado;
  }, [ventas, mes, anio]);

  const maximo = Math.max(...semanas.map((semana) => semana.total), 1);

  const formatoFecha = (claveFecha: string) =>
    aFechaLocalSegura(claveFecha).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });

  return (
    <div className={expanded ? "space-y-8" : "space-y-5"}>
      {semanas.map((semana, index) => {
        const porcentaje = (semana.total / maximo) * 100;

        return (
          <div key={`${semana.inicio}-${semana.fin}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="whitespace-nowrap text-slate-600">
                Semana {index + 1} ({formatoFecha(semana.inicio)} - {formatoFecha(semana.fin)})
              </span>

              <span className="font-semibold text-slate-800">
                {euros(semana.total)}
              </span>

              <span className="whitespace-nowrap text-slate-500">
                {semana.ventas} ventas
              </span>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>
        );
      })}
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
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pólizas creadas
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {totalPolizas}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Producción generada
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {euros(produccionTotal)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Prima media
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {euros(mediaPorPoliza)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center gap-5 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-blue-300" />
            Pólizas creadas
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1 w-5 rounded-full bg-blue-800" />
            Producción (€)
          </div>
        </div>

        <div className="h-[360px] w-full sm:h-[440px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={datosGrafico}
              margin={{ top: 12, right: 18, left: 4, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
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
                cursor={{ fill: "#f1f5f9" }}
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;

                  const polizas =
                    payload.find((item: any) => item.dataKey === "polizas")
                      ?.value ?? 0;
                  const produccion =
                    payload.find((item: any) => item.dataKey === "produccion")
                      ?.value ?? 0;

                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
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
              <Bar
                yAxisId="polizas"
                dataKey="polizas"
                name="Pólizas creadas"
                fill="#93c5fd"
                radius={[5, 5, 0, 0]}
                maxBarSize={28}
              />
              <Line
                yAxisId="euros"
                type="monotone"
                dataKey="produccion"
                name="Producción"
                stroke="#172b91"
                strokeWidth={3}
                dot={{ r: 3, fill: "#172b91", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">
          Detalle diario
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {datos
            .filter((item) => item.ventas > 0 || item.total > 0)
            .map((item) => (
              <div
                key={item.dia}
                className="rounded-lg border border-slate-200 bg-white p-3"
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
  const puntos = datos
    .map((item) => {
      const x =
        datos.length === 1
          ? 150
          : 12 + ((item.dia - 1) / (datos.length - 1)) * 276;
      const y = 190 - (item.total / maxProduccion) * 165;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <>
      <div className="mb-3 flex justify-center gap-5 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-sm bg-blue-300" />
          Nº de pólizas creadas
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1 w-5 rounded-full bg-blue-800" />
          Producción (€)
        </div>
      </div>
      <div className="relative h-[220px] w-full">
        <div className="absolute inset-0 flex items-end justify-between gap-1 px-2">
          {datos.map((item) => (
            <div
              key={item.dia}
              className="flex h-full flex-1 items-end"
            >
              <div
                className="w-full rounded-t-sm bg-blue-300"
                style={{
                  height: `${(item.ventas / maxVentas) * 100}%`,
                  minHeight: item.ventas > 0 ? "3px" : "0",
                }}
                title={`${item.dia}: ${item.ventas} pólizas creadas · ${euros(item.total)}`}
              />
            </div>
          ))}
        </div>
        <svg
          viewBox="0 0 300 205"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <polyline
            points={puntos}
            fill="none"
            stroke="#172b91"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="mt-2 flex justify-between px-1 text-[10px] text-slate-400">
        <span>1</span>
        <span>{Math.ceil(datos.length / 3)}</span>
        <span>{Math.ceil(datos.length / 2)}</span>
        <span>{datos.length}</span>
      </div>
    </>
  );
}

export default function DashboardKpis({
  ventas,
  kpis,
  isAdmin,
  mes,
  anio,
}: Props) {
  const produccionPorRamo = useMemo(() => {
    const resultado: Record<string, number> = {};

    ventas.forEach((venta) => {
      const ramo = venta.ramo || "Sin ramo";
      resultado[ramo] = (resultado[ramo] || 0) + (Number(venta.primaNeta) || 0);
    });

    return Object.entries(resultado).sort((a, b) => b[1] - a[1]);
  }, [ventas]);

  const produccionTotal = ventas.reduce(
    (total, venta) => total + (Number(venta.primaNeta) || 0),
    0
  );

  return (
    <div className="space-y-4">
<div
  className={
    isAdmin
      ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.35fr]"
      : "grid w-full grid-cols-1 gap-4 sm:grid-cols-2"
  }
>        <KPIBox
          title="Producción total"
          value={euros(Number(kpis?.produccion?.actual) || produccionTotal)}
          variation={kpis?.produccion?.variacionPct}
          isAdmin={isAdmin}
          icon={<Coins size={27} />}
          iconBackground="bg-emerald-100"
          iconColor="text-emerald-600"
        />
{isAdmin && (
     <>
        <KPIBox
          title="Producción comercial"
          subtitle="(Registro)"
          value={euros(Number(kpis?.produccionCreated?.actual) || 0)}
          variation={kpis?.produccionCreated?.variacionPct}
          isAdmin={isAdmin}
          icon={<BarChart3 size={27} />}
          iconBackground="bg-blue-100"
          iconColor="text-blue-600"
        />

        <KPIBox
          title="Nº de ventas"
          value={String(kpis?.polizas?.actual ?? ventas.length)}
          variation={kpis?.polizas?.variacionPct}
          isAdmin={isAdmin}
          icon={<CalendarDays size={27} />}
          iconBackground="bg-purple-100"
          iconColor="text-purple-600"
        />
</>
        )}

        <div className={`${CARD} min-w-0 p-4`}>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Producción por ramo</h3>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {produccionPorRamo.map(([ramo, total]) => (
              <div key={ramo} className="min-w-0 rounded-lg border border-slate-200 px-3 py-2">
                <p className="truncate text-xs text-slate-500" title={ramo}>{ramo}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{euros(total)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

{isAdmin && (
     <>
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <MaximizablePanel
          title="Producción por semanas"
         
        >
          {(expanded) => (
            <ProduccionSemanal
              ventas={ventas}
             
              mes={mes}
              anio={anio}
              expanded={expanded}
            />
          )}
        </MaximizablePanel>

        <MaximizablePanel title="Actividad comercial diaria" subtitle="pólizas creadas">
          {(expanded) => <VentasDiarias ventas={ventas} mes={mes} anio={anio} expanded={expanded} />}
        </MaximizablePanel>

        <MaximizablePanel title="Producción por ramo">
          {(expanded) => <RamoDonut datos={produccionPorRamo} total={produccionTotal} expanded={expanded} />}
        </MaximizablePanel>
      </div>

      </>
        )}
    </div>
  );
}
