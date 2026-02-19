import { useEffect, useState } from "react";
import api from "../../services/api";

type Venta = {
  aseguradora?: string;
  ramo?: string;
  createdBy?: {
    _id: string;
    nombre: string;
  };
};

type Props = {
  isAdmin: boolean;
  aseguradora: string;
  setAseguradora: (v: string) => void;
  ramo: string;
  setRamo: (v: string) => void;
  usuario: string;
  setUsuario: (v: string) => void;
};

export default function DashboardFilters({
  isAdmin,
  aseguradora,
  setAseguradora,
  ramo,
  setRamo,
  usuario,
  setUsuario,
}: Props) {
  const [aseguradoras, setAseguradoras] = useState<string[]>([]);
  const [ramos, setRamos] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<{ _id: string; nombre: string }[]>([]);

  useEffect(() => {
    const fetchFiltros = async () => {
      try {
        const res = await api.get("/ventas/libro", {
          params: {
            month: 1,
            year: new Date().getFullYear(),
          },
        });

        const ventas: Venta[] = res.data?.ventas || [];

        // Aseguradoras únicas
        const uniqueAseguradoras = Array.from(
          new Set(
            ventas
              .map((v) => v.aseguradora)
              .filter(Boolean)
          )
        ) as string[];

        setAseguradoras(uniqueAseguradoras);

        // Ramos únicos
        const uniqueRamos = Array.from(
          new Set(
            ventas
              .map((v) => v.ramo)
              .filter(Boolean)
          )
        ) as string[];

        setRamos(uniqueRamos);

        // Usuarios únicos
        const usersMap = new Map<string, { _id: string; nombre: string }>();

        ventas.forEach((v) => {
          if (v.createdBy?._id) {
            usersMap.set(v.createdBy._id, v.createdBy);
          }
        });

        setUsuarios(Array.from(usersMap.values()));

      } catch (error) {
        console.error("Error cargando filtros:", error);
      }
    };

    fetchFiltros();
  }, []);

  return (
    <div className="flex flex-wrap gap-6 items-end">
      {/* ASEGURADORA */}
      <div>
        <label className="block text-xs font-semibold mb-1">
          Aseguradora
        </label>
        <select
          value={aseguradora}
          onChange={(e) => setAseguradora(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="ALL">Todas</option>
          {aseguradoras.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* RAMO */}
      <div>
        <label className="block text-xs font-semibold mb-1">
          Ramo
        </label>
        <select
          value={ramo}
          onChange={(e) => setRamo(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="ALL">Todos</option>
          {ramos.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* USUARIO */}
      {isAdmin && (
        <div>
          <label className="block text-xs font-semibold mb-1">
            Usuario
          </label>
          <select
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">Todos</option>
            {usuarios.map((u) => (
              <option key={u._id} value={u._id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
