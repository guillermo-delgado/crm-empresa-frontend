import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

interface DataItem {
  mes: string;
  nueva: number;
  renovacion: number;
}

const ordenMeses = [
  "Ene","Feb","Mar","Abr","May","Jun",
  "Jul","Ago","Sep","Oct","Nov","Dic"
];

export default function ProduccionRenovacionesChart() {
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch("http://localhost:3001/api/crm/dashboard/facturacion", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text);
        }
        return res.json();
      })
      .then((json) => {

        const datosOrdenados = (json.produccion || []).sort(
          (a: DataItem, b: DataItem) =>
            ordenMeses.indexOf(a.mes) - ordenMeses.indexOf(b.mes)
        );

        setData(datosOrdenados);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando producción:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Cargando datos...
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        No hay datos disponibles
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />

        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />

        <YAxis tick={{ fontSize: 12 }} />

        <Tooltip />

        <Legend />

        <Bar
          dataKey="nueva"
          name="Nueva producción"
          fill="#3b82f6"
          radius={[6, 6, 0, 0]}
        />

        <Bar
          dataKey="renovacion"
          name="Renovaciones"
          fill="#10b981"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}