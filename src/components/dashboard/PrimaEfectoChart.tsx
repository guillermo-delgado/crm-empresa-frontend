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

export default function PrimaEfectoChart({
  aseguradora,
  ramo,
  usuario,
}: Props) {

  const [rawData, setRawData] = useState<BackendResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get("/ventas/dashboard/polizas-3-anios", {
          params: {
            aseguradora,
            ramo,
            usuario,
            tipo: "primaEfecto",
          },
        });

        if (active) setRawData(res.data || null);
      } catch (error) {
        console.error("Error PrimaEfectoChart:", error);
        if (active) setRawData(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => { active = false; };

  }, [aseguradora, ramo, usuario]);

  const { chartData, anios } = useMemo(() => {
    if (!rawData) return { chartData: [], anios: [] as string[] };

    const years = Object.keys(rawData).sort();
    const currentYear = String(new Date().getFullYear());
    const previousYear = String(new Date().getFullYear() - 1);
    const currentMonthIndex = new Date().getMonth();

    const currentData = rawData[currentYear] || [];
    const prevData = rawData[previousYear] || [];

    const sumUntil = (arr: number[], month: number) =>
      arr.slice(0, month + 1).reduce((a, b) => a + b, 0);

    // ===============================
    // 1️⃣ Crecimiento YTD acumulado
    // ===============================
    const ytdCurrent = sumUntil(currentData, currentMonthIndex);
    const ytdPrev = sumUntil(prevData, currentMonthIndex);

    const growthYTD =
      ytdPrev > 0
        ? (ytdCurrent - ytdPrev) / ytdPrev
        : 0;

    // ===============================
    // 2️⃣ Crecimiento promedio últimos 3 meses
    // ===============================
    const lastMonthsGrowth: number[] = [];

    for (let i = currentMonthIndex - 2; i <= currentMonthIndex; i++) {
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

    const cappedGrowth = Math.max(-0.5, Math.min(finalGrowth, 1.5));

    // ===============================
    // 4️⃣ Construcción dataset
    // ===============================
    const data = meses.map((mes, index) => {
      const row: Record<string, number | string> = { mes };

      years.forEach((anio) => {
        const arr = rawData[anio];
        row[anio] =
          Array.isArray(arr) && typeof arr[index] === "number"
            ? arr[index]
            : 0;
      });

      if (index <= currentMonthIndex) {
        row["Proyección cierre año"] =
          typeof currentData[index] === "number"
            ? currentData[index]
            : 0;
      } else {
        const base = prevData[index] ?? 0;
        const projected = Math.round(base * (1 + cappedGrowth));
        row["Proyección cierre año"] = projected > 0 ? projected : 0;
      }

      return row;
    });

    return {
      chartData: data,
      anios: years,
    };

  }, [rawData]);

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  return (
    <div className="w-full h-full flex flex-col">

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 animate-pulse">
          Cargando datos...
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          Sin datos disponibles
        </div>
      ) : (
        <div className="w-full h-[420px]">

          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" />

              <XAxis
                dataKey="mes"
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
              />

              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                tickFormatter={(value: number) =>
                  `${value.toLocaleString("es-ES")} €`
                }
              />

              <Tooltip
                formatter={(value) =>
                  `${Number(value).toLocaleString("es-ES")} €`
                }
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

              {/* PROYECCIÓN MEJORADA (MISMO DISEÑO) */}
              <Line
  type="monotone"
  dataKey="Proyección cierre año"
  stroke="#dc2626"
  strokeWidth={3}
  dot={false}
  strokeDasharray="6 4"
  name="Proyección cierre año"
/>


            </LineChart>
          </ResponsiveContainer>

        </div>
      )}
    </div>
  );
}
