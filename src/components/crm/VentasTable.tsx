import { Ban, Pencil, RotateCcw, Trash2 } from "lucide-react";

type Venta = {
  _id: string;
  fecha: string;
  fechaVenta?: string;
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
   🎨 ESTILO DE FILA
   PRIORIDAD:
   1️⃣ ANULADA
   2️⃣ ADMIN → pendiente
   3️⃣ EMPLEADO → estados revisión
   Devuelve fondo suave + barra de color a la izquierda
====================================================== */
const getRowStyle = (venta: Venta, isAdmin?: boolean) => {
  if (venta.estado === "ANULADA") {
    return {
      row: "bg-red-50/70 text-red-700/80",
      bar: "shadow-[inset_4px_0_0_0_#fca5a5]",
    };
  }

  if (isAdmin) {
    return venta.estadoRevision === "pendiente"
      ? { row: "bg-blue-50/70", bar: "shadow-[inset_4px_0_0_0_#2f5bd3]" }
      : { row: "", bar: "" };
  }

  switch (venta.estadoRevision) {
    case "pendiente":
      return {
        row: "bg-amber-50/70",
        bar: "shadow-[inset_4px_0_0_0_#fbbf24]",
      };
    case "aceptada":
      return {
        row: "bg-emerald-50/70",
        bar: "shadow-[inset_4px_0_0_0_#34d399]",
      };
    case "rechazada":
      return {
        row: "bg-red-50/70",
        bar: "shadow-[inset_4px_0_0_0_#f87171]",
      };
    default:
      return { row: "", bar: "" };
  }
};

const iniciales = (nombre?: string) => {
  if (!nombre) return "–";
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "–";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
};

const formatoPrima = (n: number) =>
  `${Number(n || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;

const th =
  "px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500";

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
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm lg:min-w-0 lg:table-fixed">
          <thead>
            <tr className="border-b border-slate-200/70 bg-slate-50/80">
              <th className={`${th} text-left lg:w-[9%]`}>Fecha</th>
              <th className={`${th} text-left lg:w-[11%]`}>Póliza</th>
              <th className={`${th} text-left lg:w-[22%]`}>Tomador</th>
              <th className={`${th} text-left lg:w-[10%]`}>Aseguradora</th>
              <th className={`${th} text-left lg:w-[14%]`}>Ramo</th>
              <th className={`${th} text-right lg:w-[10%]`}>Prima</th>
              <th className={`${th} text-left lg:w-[12%]`}>Usuario</th>
              <th className={`${th} text-center lg:w-[12%]`}>Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {ventas.map((v, i) => {
              const estilo = getRowStyle(v, isAdmin);
              const anulada = v.estado === "ANULADA";
              const limpiable = !isAdmin && !!v.estadoRevision && !anulada;

              return (
                <tr
                  key={v._id ?? i}
                  className={`transition-colors ${estilo.row} ${
                    limpiable
                      ? "cursor-pointer hover:brightness-[0.98]"
                      : "hover:bg-slate-50/80"
                  }`}
                  onClick={() => {
                    if (isAdmin) return;
                    if (!v.estadoRevision) return;
                    onClearRevision?.(v);
                  }}
                >
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-slate-500 ${estilo.bar}`}
                  >
                    {v.fecha}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold tabular-nums ${
                        anulada ? "line-through" : "text-slate-800"
                      }`}
                    >
                      {v.poliza}
                    </span>
                  </td>

                  <td
                    className="truncate px-4 py-3 font-medium text-slate-700"
                    title={v.tomador}
                  >
                    {v.tomador}
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {v.aseguradora}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-flex max-w-full items-center rounded-full bg-[#eaeffc] px-2.5 py-0.5 text-xs font-medium leading-tight text-[#2f5bd3]">
                      {v.ramo}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-800">
                    {formatoPrima(v.prima)}
                  </td>

                  <td className="px-4 py-3">
                    {v.usuario ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d5ddf0] text-[10px] font-bold text-[#2f5bd3]">
                          {iniciales(v.usuario)}
                        </span>
                        <span className="truncate text-slate-600" title={v.usuario}>
                          {v.usuario}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* ================= ACCIONES ================= */}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {/* ✏️ EDITAR / ACTUALIZAR */}
                      <button
                        type="button"
                        disabled={!onEdit}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(v);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#eaeffc] px-2.5 py-1.5 text-xs font-medium text-[#2f5bd3] transition hover:bg-[#dbe4fb] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Pencil size={13} />
                        {isAdmin && v.estadoRevision === "pendiente"
                          ? "Actualizar"
                          : "Editar"}
                      </button>

                      {/* 🟠 ANULAR */}
                      {onAnular && !anulada && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAnular(v);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-600 transition hover:bg-orange-100"
                        >
                          <Ban size={13} />
                          Anular
                        </button>
                      )}

                      {/* 🔴 ESTADO ANULADA (SOLO EMPLEADO) */}
                      {anulada && !isAdmin && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                          Anulada
                        </span>
                      )}

                      {/* 🟢 REHABILITAR */}
                      {isAdmin && anulada && onRehabilitar && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRehabilitar(v);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <RotateCcw size={13} />
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
                          aria-label="Eliminar venta"
                          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {ventas.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-sm text-slate-400"
                >
                  No hay ventas para el periodo seleccionado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}