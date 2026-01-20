import { useEffect, useState } from "react";
import api from "../../services/api";

interface Venta {
  _id: string;
  fechaEfecto: string;
  aseguradora: string;
  ramo: string;
  numeroPoliza: string;
  tomador: string;
  primaNeta: number;
  formaPago: string;
  createdBy: {
    nombre: string;
    email: string;
  };
}

const Dashboard = () => {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVentas = async () => {
      try {
        const res = await api.get("/ventas");
        setVentas(res.data);
      } catch (error) {
        console.error("Error cargando ventas", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVentas();
  }, []);

  if (loading) {
    return <div className="p-10 text-xl">Cargando ventas…</div>;
  }

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold mb-6">Ventas</h1>

      <table className="w-full border border-slate-300">
        <thead className="bg-slate-200 text-left">
          <tr>
            <th className="p-3">Fecha efecto</th>
            <th className="p-3">Póliza</th>
            <th className="p-3">Tomador</th>
            <th className="p-3">Aseguradora</th>
            <th className="p-3">Ramo</th>
            <th className="p-3">Prima</th>
            <th className="p-3">Creado por</th>
          </tr>
        </thead>
        <tbody>
          {ventas.map((venta) => (
            <tr key={venta._id} className="border-t">
              <td className="p-3">
                {new Date(venta.fechaEfecto).toLocaleDateString()}
              </td>
              <td className="p-3">{venta.numeroPoliza}</td>
              <td className="p-3">{venta.tomador}</td>
              <td className="p-3">{venta.aseguradora}</td>
              <td className="p-3">{venta.ramo}</td>
              <td className="p-3">{venta.primaNeta} €</td>
              <td className="p-3">{venta.createdBy?.nombre}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Dashboard;
