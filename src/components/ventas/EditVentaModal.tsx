import { useState } from "react";
import api from "../../services/api";
import VentaForm from "./VentaForm";
import InfoModal from "./InfoModal";

type Props = {
  venta: any;
  onClose: () => void;
  onSaved: () => void;
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

  const isSolicitud = changedFields.length > 0;
  const isDelete = changedFields.includes("__DELETE__");

  const fechaEfecto =
    ventaData.fechaEfecto && typeof ventaData.fechaEfecto === "string"
      ? ventaData.fechaEfecto.includes("T")
        ? ventaData.fechaEfecto.slice(0, 10)
        : ventaData.fechaEfecto
      : "";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="relative bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

          {/* ❌ CERRAR */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-xl cursor-pointer"
            aria-label="Cerrar"
          >
            ×
          </button>

          {/* TÍTULO */}
          <h2 className="text-lg font-semibold mb-4">
            {isDelete ? "Eliminar venta" : "Editar venta"}
          </h2>

          {/* FORMULARIO */}
          <div className="flex-1 overflow-y-auto pr-2">
            <VentaForm
              key={ventaData._id}
              initialData={{
                fechaEfecto,
                numeroPoliza: ventaData.numeroPoliza || ventaData.poliza,
                tomador: ventaData.tomador,
                aseguradora: ventaData.aseguradora,
                ramo: ventaData.ramo,
                primaNeta: ventaData.primaNeta ?? ventaData.prima,
                formaPago: ventaData.formaPago,
                actividad: ventaData.actividad || "",
                observaciones: ventaData.observaciones || "",
                usuario:
                  ventaData.createdBy?.numma ??
                  ventaData.createdBy?.nombre ??
                  ventaData.createdBy?.email ??
                  "",
              }}
              originalData={originalData}
              changedFields={changedFields}
              onCancel={onClose}
              hideActions={isSolicitud}
submitLabel={isDelete ? "" : "Guardar cambios"}
onSubmit={async (data) => {
  if (isSolicitud) return;

  try {
    await api.put(`/ventas/${ventaData._id}`, {
      ...data,
      primaNeta: Number(data.primaNeta),
    });

    onSaved();
    onClose();
  } catch (error: any) {
    if (error.response?.status === 403) {
      localStorage.setItem(
        `venta_pending_${ventaData._id}`,
        JSON.stringify(data)
      );
      setShowInfo(true);
    }
  }
}}

             
            />
          </div>

          {/* BOTONES ADMIN */}
          {isSolicitud && (
            <div className="flex justify-end gap-3 mt-4">

              <button
                className="px-4 py-2 rounded border text-slate-600 cursor-pointer"
                onClick={async () => {
                  await api.post(
                    `/solicitudes/${venta.solicitudId}/rechazar`
                  );
                  onSaved();
                  onClose();
                }}
              >
                Rechazar
              </button>

              {!isDelete && (
                <button
                  className="px-4 py-2 rounded bg-green-600 text-white cursor-pointer"
                  onClick={async () => {
                    await api.post(
                      `/solicitudes/${venta.solicitudId}/aprobar`
                    );
                    onSaved();
                    onClose();
                  }}
                >
                  Aprobar cambios
                </button>
              )}

              {isDelete && (
                <button
                  className="px-4 py-2 rounded bg-red-600 text-white cursor-pointer"
                  onClick={async () => {
                    await api.delete(`/ventas/${ventaData._id}`);
                    await api.post(
                      `/solicitudes/${venta.solicitudId}/aprobar`
                    );
                    onSaved();
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

      {/* INFO EMPLEADO */}
      {showInfo && (
        <InfoModal
          type={isDelete ? "delete" : "edit"}
          onClose={() => {
            setShowInfo(false);
            onSaved();
            onClose();
          }}
        />
      )}
    </>
  );
}
