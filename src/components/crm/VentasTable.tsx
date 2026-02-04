import { Trash2 } from "lucide-react";

type Venta = {
  _id: string;
  fecha: string;
  poliza: string;
  tomador: string;
  aseguradora: string;
  ramo: string;
  prima: number;
  usuario: string;

  // 🔴 Estado de anulación (legacy / opcional)
  anulada?: boolean;

  // ✅ ESTADO REAL DESDE BACKEND
  estado?: "ANULADA";

  // 🔔 Estado visual de revisión
  estadoRevision?: "pendiente" | "aceptada" | "rechazada" | null;
};

type Props = {
  ventas: Venta[];
  onEdit?: (venta: Venta) => void;
  onDelete?: (venta: Venta) => void;
  onAnular?: (venta: Venta) => void;
  onRehabilitar?: (venta: Venta) => void;
  isAdmin?: boolean;
  onClearRevision?: (venta: Venta) => void;
};

/* ======================================================
   🎨 COLOR DE FILA
   PRIORIDAD:
   1️⃣ ANULADA
   2️⃣ ADMIN → pendiente
   3️⃣ EMPLEADO → estados revisión
====================================================== */
const getRowClass = (venta: Venta, isAdmin?: boolean) => {
  // 🔴 ANULADA → rojo pastel
  if (venta.estado === "ANULADA") {
    return "bg-red-50 text-red-600 border-l-4 border-red-300";
  }

  // 👑 ADMIN → solo azul si hay pendiente
  if (isAdmin) {
    return venta.estadoRevision === "pendiente" ? "bg-blue-50" : "";
  }

  // 👤 EMPLEADO → estados revisión
  switch (venta.estadoRevision) {
    case "pendiente":
      return "bg-yellow-50";
    case "aceptada":
      return "bg-green-50";
    case "rechazada":
      return "bg-red-50";
    default:
      return "";
  }
};

export default function VentasTable({
  ventas,
  onEdit,
  onDelete,
  onAnular,
  onRehabilitar,
  isAdmin,
  onClearRevision,
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
              className={`
                border-t transition
                ${getRowClass(v, isAdmin)}
                ${
                  !isAdmin &&
                  v.estadoRevision &&
                  v.estado !== "ANULADA"
                    ? "cursor-pointer"
                    : "hover:bg-slate-50"
                }
              `}
              onClick={() => {
                if (isAdmin) return;
                if (!v.estadoRevision) return;
                if (!v.estadoRevision) return;
                onClearRevision?.(v);
              }}
            >
              <td className="px-4 py-2">{v.fecha}</td>
              <td className="px-4 py-2 font-medium">{v.poliza}</td>
              <td className="px-4 py-2">{v.tomador}</td>
              <td className="px-4 py-2">{v.aseguradora}</td>
              <td className="px-4 py-2">{v.ramo}</td>
              <td className="px-4 py-2 text-right font-semibold">
                {v.prima.toFixed(2)} €
              </td>
              <td className="px-4 py-2 text-slate-500">
                {v.usuario || "-"}
              </td>

              {/* ================= ACCIONES ================= */}
              <td className="px-4 py-2 text-center align-middle">

                <div className="flex justify-center gap-3">

                  {/* ✏️ EDITAR / ACTUALIZAR */}
                  <button
                    type="button"
                    disabled={!onEdit}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(v);
                    }}
                    className="
                      text-blue-600 text-xs font-medium
                      hover:underline
                      cursor-pointer
                      disabled:opacity-40
                      disabled:cursor-not-allowed
                    "
                  >
                    {isAdmin && v.estadoRevision === "pendiente"
                      ? "Actualizar"
                      : "Editar"}
                  </button>

                  {/* 🟠 ANULAR */}
                  {onAnular && v.estado !== "ANULADA" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnular(v);
                      }}
                      className="text-orange-600 text-xs font-medium hover:underline cursor-pointer"
                    >
                      Anular
                    </button>
                  )}

                 {/* 🔴 ESTADO ANULADA (SOLO EMPLEADO) */}
{v.estado === "ANULADA" && !isAdmin && (
  <span
    className="
      inline-flex items-center
      px-2 py-0.5
      rounded-full
      text-[11px]
      font-medium
      bg-red-100
      text-red-700
    "
  >
    Anulada
  </span>
)}


                  {/* 🟢 REHABILITAR */}
                  {isAdmin && v.estado === "ANULADA" && onRehabilitar && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();

                        console.log("🟢 CLICK REHABILITAR DESDE TABLA", {
                          ventaId: v._id,
                          estado: v.estado,
                          estadoRevision: v.estadoRevision,
                          isAdmin,
                        });

                        onRehabilitar(v);
                      }}
                      className="text-green-600 text-xs font-medium hover:underline cursor-pointer"
                    >
                      Rehabilitar
                    </button>
                  )}

                  {/* 🗑 ELIMINAR (solo admin) */}
                  {isAdmin && onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(v);
                      }}
                      title="Eliminar"
                      className="
                        text-slate-400
                        hover:text-red-600
                        transition
                        cursor-pointer
                      "
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
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
