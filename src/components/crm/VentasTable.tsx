type Venta = {
    _id: string;
  fecha: string;
  poliza: string;
  tomador: string;
  aseguradora: string;
  ramo: string;
  prima: number;
  usuario: string;
};

type Props = {
  ventas: Venta[];
  onEdit?: (venta: Venta) => void;
  onDelete?: (venta: Venta) => void;
};

export default function VentasTable({
  ventas,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-4 py-2 text-left">Fecha</th>
            <th className="px-4 py-2 text-left">Póliza</th>
            <th className="px-4 py-2 text-left">Tomador</th>
            <th className="px-4 py-2 text-left">Aseguradora</th>
            <th className="px-4 py-2 text-left">Ramo</th>
            <th className="px-4 py-2 text-right">Prima</th>
            <th className="px-4 py-2 text-left">Usuario</th>
            <th className="px-4 py-2 text-center">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {ventas.map((v, i) => (
            <tr
              key={i}
              className="border-t hover:bg-slate-50 transition"
            >
              <td className="px-4 py-2">{v.fecha}</td>

              <td className="px-4 py-2 font-medium">
                {v.poliza}
              </td>

              <td className="px-4 py-2">{v.tomador}</td>

              <td className="px-4 py-2">{v.aseguradora}</td>

              <td className="px-4 py-2">{v.ramo}</td>

              <td className="px-4 py-2 text-right font-semibold">
                {v.prima.toFixed(2)} €
              </td>

              <td className="px-4 py-2 text-slate-500">
                {v.usuario || "-"}
              </td>

              {/* ACCIONES */}
              <td className="px-4 py-2 text-center">
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    disabled={!onEdit}
                    onClick={() => onEdit?.(v)}
                    className="
                      text-blue-600 text-xs font-medium
                      hover:underline
                      cursor-pointer
                      disabled:opacity-40
                      disabled:cursor-not-allowed
                    "
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    disabled={!onDelete}
                    onClick={() => onDelete?.(v)}
                    className="
                      text-red-600 text-xs font-medium
                      hover:underline
                      cursor-pointer
                      disabled:opacity-40
                      disabled:cursor-not-allowed
                    "
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {ventas.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-6 text-center text-slate-400"
              >
                No hay ventas para el periodo seleccionado
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
