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
  [year: string]: string | number | undefined;
};

const formatNumber = (value: unknown) => {
  const num = typeof value === "number" ? value : Number(value);
  return (num || 0).toLocaleString("es-ES");
};

export default function Polizas3AniosChart({
  aseguradora,
  ramo,
  usuario,
}: Props) {

  const [rawData, setRawData] = useState<BackendResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get(
          "/ventas/dashboard/polizas-3-anios",
          {
            params: {
              aseguradora,
              ramo,
              usuario,
              tipo: "polizas",
            },
          }
        );
        setRawData(res.data || null);
      } catch (error) {
        console.error("Error Polizas3AniosChart:", error);
        setRawData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [aseguradora, ramo, usuario]);

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const thirdYear = currentYear - 2;

  const chartData: ChartRow[] = useMemo(() => {
    if (!rawData) return [];

    const anios = Object.keys(rawData).sort();

    const currentKey = currentYear.toString();
    const prevKey = previousYear.toString();

    const currentData = rawData[currentKey] || [];
    const prevData = rawData[prevKey] || [];

    const currentMonth = new Date().getMonth(); // 0-11

    const sumUntil = (arr: number[], month: number) =>
      arr.slice(0, month + 1).reduce((a, b) => a + b, 0);

    // ===============================
    // 1️⃣ Crecimiento YTD acumulado
    // ===============================
    const ytdCurrent = sumUntil(currentData, currentMonth);
    const ytdPrev = sumUntil(prevData, currentMonth);

    const growthYTD =
      ytdPrev > 0
        ? (ytdCurrent - ytdPrev) / ytdPrev
        : 0;

    // ===============================
    // 2️⃣ Crecimiento promedio últimos 3 meses
    // ===============================
    const lastMonthsGrowth: number[] = [];

    for (let i = currentMonth - 2; i <= currentMonth; i++) {
      if (i >= 0 && prevData[i] > 0) {
        lastMonthsGrowth.push(
          (currentData[i] - prevData[i]) / prevData[i]
        );
      }
    }

    const growthRecent =
      lastMonthsGrowth.length > 0
        ? lastMonthsGrowth.reduce((a, b) => a + b, 0) / lastMonthsGrowth.length
        : 0;

    // ===============================
    // 3️⃣ Modelo mixto ponderado
    // ===============================
    const finalGrowth =
      growthYTD * 0.6 + growthRecent * 0.4;

    // Protección contra valores extremos
    const cappedGrowth = Math.max(-0.5, Math.min(finalGrowth, 1.5));

    // ===============================
    // 4️⃣ Generar proyección híbrida mejorada
    // ===============================
    const proyeccion: number[] = [];

    for (let i = 0; i < 12; i++) {
      if (i <= currentMonth) {
        proyeccion[i] = currentData[i] ?? 0;
      } else {
        const base = prevData[i] ?? 0;
        proyeccion[i] = Math.round(base * (1 + cappedGrowth));
      }
    }

    // ===============================
    // 5️⃣ Construcción dataset gráfico
    // ===============================
    return meses.map((mes, index) => {
      const row: ChartRow = { mes };

      anios.forEach((anio) => {
        const arr = rawData[anio];
        row[anio] =
          Array.isArray(arr) && typeof arr[index] === "number"
            ? arr[index]
            : 0;
      });

      row.proyeccion = proyeccion[index];

      return row;
    });

  }, [rawData, currentYear, previousYear]);

  const anios = rawData ? Object.keys(rawData).sort() : [];

  return (
    <div className="w-full h-full min-h-[320px]">

      {loading ? (
        <div className="h-full flex items-center justify-center text-slate-400 text-sm">
          Cargando gráfica...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />

            <YAxis
              allowDecimals={false}
              tickFormatter={(value) =>
                Number(value).toLocaleString("es-ES")
              }
              tick={{ fontSize: 12 }}
            />

            <Tooltip
              formatter={(value) => formatNumber(value)}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            />

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

            {/* 🔴 Línea proyección mejorada */}
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
