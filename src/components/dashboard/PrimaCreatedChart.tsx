import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";

type BackendResponse = Record<string, number[]>;

type Props = {
  aseguradora: string;
  ramo: string;
  usuario: string;
};

const meses = [
  "Ene","Feb","Mar","Abr","May","Jun",
  "Jul","Ago","Sep","Oct","Nov","Dic"
];

type ChartRow = {
  mes: string;
  proyeccion?: number;
  [key: string]: number | string | undefined;
};

const formatCurrency = (value: unknown) => {
  const num = typeof value === "number" ? value : Number(value);
  return `${(num || 0).toLocaleString("es-ES")} €`;
};

export default function PrimaEfectoChart({
  aseguradora,
  ramo,
  usuario,
}: Props) {

  const [efectoData, setEfectoData] = useState<BackendResponse | null>(null);
  const [ventaAdelantada, setVentaAdelantada] = useState<number[]>([]);
  const [ventaAdelantadaPrev, setVentaAdelantadaPrev] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"efecto" | "adelantado">("efecto");

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const thirdYear = currentYear - 2;
  const currentMonth = new Date().getMonth();

  /* =========================
     FETCH DATOS
  ========================= */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {

        // 1️⃣ Prima efecto normal
        const efectoRes = await api.get(
          "/ventas/dashboard/polizas-3-anios",
          {
            params: {
              aseguradora,
              ramo,
              usuario,
              tipo: "primaEfecto",
            },
          }
        );

        setEfectoData(efectoRes.data || null);

        // 2️⃣ Venta adelantada AÑO ACTUAL
        const promisesActual = Array.from({ length: 12 }, (_, i) =>
          api.get("/ventas/dashboard/venta-adelantada", {
            params: {
              anio: currentYear,
              mes: i + 1,
            },
          })
        );

        // 3️⃣ Venta adelantada AÑO ANTERIOR
        const promisesPrev = Array.from({ length: 12 }, (_, i) =>
          api.get("/ventas/dashboard/venta-adelantada", {
            params: {
              anio: previousYear,
              mes: i + 1,
            },
          })
        );

        const [resultsActual, resultsPrev] = await Promise.all([
          Promise.all(promisesActual),
          Promise.all(promisesPrev),
        ]);

        setVentaAdelantada(resultsActual.map(r => r.data.total || 0));
        setVentaAdelantadaPrev(resultsPrev.map(r => r.data.total || 0));

      } catch (error) {
        console.error("ERROR FETCH:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [aseguradora, ramo, usuario]);

  /* =========================
     BUILD DATA
  ========================= */
  const chartData: ChartRow[] = useMemo(() => {

    if (!efectoData) return [];

    const years = Object.keys(efectoData).sort();

    const data: ChartRow[] = meses.map((mes, index) => {
      const row: ChartRow = { mes };

      if (viewMode === "efecto") {

        years.forEach((anio) => {
          const arr = efectoData[anio];
          row[anio] =
            Array.isArray(arr) && typeof arr[index] === "number"
              ? arr[index]
              : 0;
        });

      } else {

        // 🔥 Venta adelantada REAL comparativa
        row[currentYear] = ventaAdelantada[index] ?? 0;
        row[previousYear] = ventaAdelantadaPrev[index] ?? 0;
        row[thirdYear] = 0;

      }

      return row;
    });

    /* =========================
       PROYECCIÓN
    ========================= */

    const currentKey = String(currentYear);
    const prevKey = String(previousYear);

    const currentArr = data.map(r => Number(r[currentKey] ?? 0));
    const prevArr = data.map(r => Number(r[prevKey] ?? 0));

    const sumUntil = (arr: number[], month: number) =>
      arr.slice(0, month + 1).reduce((a, b) => a + b, 0);

    const ytdCurrent = sumUntil(currentArr, currentMonth);
    const ytdPrev = sumUntil(prevArr, currentMonth);

    const growth =
      ytdPrev > 0 ? (ytdCurrent - ytdPrev) / ytdPrev : 0;

    const proyeccion: number[] = [];

    for (let i = 0; i < 12; i++) {
      if (i <= currentMonth) {
        proyeccion[i] = currentArr[i] ?? 0;
      } else {
        const base = prevArr[i] ?? 0;
        proyeccion[i] = Math.round(base * (1 + growth));
      }
    }

    return data.map((row, index) => ({
      ...row,
      proyeccion: proyeccion[index],
    }));

  }, [
    efectoData,
    ventaAdelantada,
    ventaAdelantadaPrev,
    viewMode,
    currentYear,
    previousYear,
    currentMonth
  ]);

  const anios =
    viewMode === "efecto" && efectoData
      ? Object.keys(efectoData).sort()
      : [String(currentYear), String(previousYear)];

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="w-full h-full min-h-[320px] flex flex-col">

      <div className="flex justify-between items-center mb-2 px-2">
        <button
          onClick={() =>
            setViewMode(viewMode === "efecto" ? "adelantado" : "efecto")
          }
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft size={16} />
          {viewMode === "efecto"
            ? "Ver venta adelantada"
            : "Ver prima efecto"}
          <ChevronRight size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          Cargando gráfica...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis
              tickFormatter={(value) =>
                `${Number(value).toLocaleString("es-ES")} €`
              }
              tick={{ fontSize: 12 }}
            />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />

            {anios.map((anio) => {
              const yearNumber = Number(anio);

              let strokeColor = "#94a3b8";
              let strokeWidth = 2;
              let dotSize = 3;

              if (yearNumber === currentYear) {
                strokeColor = "#2563eb";
                strokeWidth = 4;
                dotSize = 5;
              }

              if (yearNumber === previousYear) {
                strokeColor = "#16a34a";
              }

              if (yearNumber === thirdYear) {
                strokeColor = "#94a3b8";
              }

              return (
                <Line
                  key={anio}
                  type="monotone"
                  dataKey={anio}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  dot={{ r: dotSize }}
                  activeDot={{ r: dotSize + 2 }}
                />
              );
            })}

            <Line
              type="monotone"
              dataKey="proyeccion"
              stroke="#dc2626"
              strokeWidth={3}
              dot={false}
              strokeDasharray="6 4"
              name="Proyección cierre año"
            />

          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
