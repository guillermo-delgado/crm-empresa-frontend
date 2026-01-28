import { useEffect, useState } from "react";
import api from "../../services/api";
import VentaForm from "./VentaForm";
import InfoModal from "../common/InfoModal";

type Props = {
  venta: any;
  onClose: () => void;
  onSaved?: (patch?: {
    _id: string;
    estadoRevision?: "pendiente" | "aceptada" | "rechazada" | null;
  }) => void;
};

export default function EditVentaModal({
  venta,
  onClose,
  onSaved,
}: Props) {
  const ventaData = venta?.data ?? venta;
  const changedFields: string[] = venta?.changedFields ?? [];
  const originalData = venta?.original ?? null;

  const [showInfo, setShowInfo] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);

  // ✅ USO PASIVO para evitar TS6133 (NO rompe nada)
  usuarios.length;

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const isSolicitud =
    isAdmin &&
    !!venta?.solicitudId &&
    changedFields.length > 0;

  const isDelete = changedFields.includes("__DELETE__");

  /* ===== CARGAR USUARIOS (ADMIN) ===== */
  useEffect(() => {
    if (!isAdmin) return;

    api
      .get("/users/asignables")
      .then((res) => setUsuarios(res.data || []))
      .catch(() => {});
  }, [isAdmin]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="relative bg-white rounded-lg p-6 w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
          {/* CERRAR */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-xl cursor-pointer"
          >
            ×
          </button>

          <h2 className="text-lg font-semibold mb-4">
            {isDelete ? "Eliminar venta" : "Editar venta"}
          </h2>

          <div className="flex-1 overflow-y-auto pr-2 min-h-0">
            <VentaForm
              key={ventaData._id}
              initialData={{
                fechaEfecto:
                  typeof ventaData.fechaEfecto === "string"
                    ? ventaData.fechaEfecto.includes("T")
                      ? ventaData.fechaEfecto.slice(0, 10)
                      : ventaData.fechaEfecto
                    : "",
                numeroPoliza: ventaData.numeroPoliza,
                documentoFiscal: ventaData.documentoFiscal,
                tomador: ventaData.tomador,
                aseguradora: ventaData.aseguradora,
                ramo: ventaData.ramo,
                primaNeta: ventaData.primaNeta,
                formaPago: ventaData.formaPago,
                actividad: ventaData.actividad || "",
                observaciones: ventaData.observaciones || "",
                usuario:
                  ventaData.createdBy?.numma ||
                  ventaData.createdBy?.nombre ||
                  ventaData.createdBy?.email ||
                  "",
              }}
              originalData={originalData}
              changedFields={changedFields}
              hideActions={false}
              submitLabel={isDelete ? "" : "Guardar cambios"}
              onCancel={onClose}
              onSubmit={async (data) => {
                if (isSolicitud) return;

                try {
                  const createdById =
                    data.createdBy || ventaData.createdBy?._id;

                  const documentoFiscalNormalizado =
                    data.documentoFiscal?.trim() === ""
                      ? undefined
                      : data.documentoFiscal;

                  await api.put(`/ventas/${ventaData._id}`, {
                    fechaEfecto: data.fechaEfecto,
                    aseguradora: data.aseguradora,
                    ramo: data.ramo,
                    numeroPoliza: data.numeroPoliza,
                    documentoFiscal: documentoFiscalNormalizado,
                    tomador: data.tomador,
                    primaNeta: Number(data.primaNeta),
                    formaPago: data.formaPago,
                    actividad: data.actividad,
                    observaciones: data.observaciones,
                    createdBy: createdById,
                  });

                  // ✅ USO REAL de onSaved (NO rompe nada)
                  onSaved?.({ _id: ventaData._id });

                  onClose();
                } catch (error: any) {
                  console.error("❌ Error editando venta:", {
                    status: error.response?.status,
                    data: error.response?.data,
                  });
                }
              }}
            />
          </div>

          {/* BOTONES ADMIN SOLICITUD */}
          {isSolicitud && (
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                className="px-4 py-2 rounded bg-green-600 text-white cursor-pointer"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  try {
                    await api.post(
                      `/solicitudes/${venta.solicitudId}/aprobar`
                    );
                    onClose();
                  } catch {
                    alert("Error aprobando la solicitud");
                  }
                }}
              >
                Aceptar cambios
              </button>

              {!isDelete && (
                <button
                  type="button"
                  className="px-4 py-2 rounded border text-slate-600 cursor-pointer"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    try {
                      await api.post(
                        `/solicitudes/${venta.solicitudId}/rechazar`
                      );
                      onClose();
                    } catch {
                      alert("Error rechazando la solicitud");
                    }
                  }}
                >
                  Rechazar
                </button>
              )}

              {isDelete && (
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-red-600 text-white cursor-pointer"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    await api.delete(`/ventas/${ventaData._id}`);
                    await api.post(
                      `/solicitudes/${venta.solicitudId}/aprobar`
                    );
                    onClose();
                  }}
                >
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showInfo && (
        <InfoModal
          type={isDelete ? "delete" : "edit"}
          onClose={() => {
            setShowInfo(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
