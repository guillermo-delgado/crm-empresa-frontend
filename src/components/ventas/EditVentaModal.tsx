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
  // 👉 venta normal o venta desde solicitud
  const ventaData = venta?.data ?? venta;
  const changedFields: string[] = venta?.changedFields ?? [];
  const originalData = venta?.original ?? null;

  const [showInfo, setShowInfo] = useState(false);

  // 👉 si hay changedFields, estamos revisando una solicitud
  const isSolicitud = changedFields.length > 0;

  // ✅ NORMALIZAR FECHA PARA INPUT TYPE="date"
  const fechaEfecto =
    ventaData.fechaEfecto && typeof ventaData.fechaEfecto === "string"
      ? ventaData.fechaEfecto.includes("T")
        ? ventaData.fechaEfecto.slice(0, 10)
        : ventaData.fechaEfecto
      : "";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Editar venta</h2>

          {/* ===== CONTENIDO CON SCROLL ===== */}
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
              hideActions={isSolicitud}
              submitLabel="Guardar cambios"
              onCancel={onClose}
              onSubmit={async (data) => {
                if (isSolicitud) return;

                try {
                  await api.put(`/ventas/${ventaData._id}`, {
                    ...data,
                    primaNeta: Number(data.primaNeta),
                  });

                  // ✅ ADMIN → guardado directo
                  onSaved();
                  onClose();
                } catch (error: any) {
                  if (error.response?.status === 403) {
                    // 🔥 EMPLEADO → guardar edición pendiente
                    localStorage.setItem(
                      `venta_pending_${ventaData._id}`,
                      JSON.stringify(data)
                    );

                    setShowInfo(true);
                  } else {
                    alert("Error al guardar los cambios");
                  }
                }
              }}
            />
          </div>

          {/* ===== BOTONES SOLO PARA SOLICITUDES (ADMIN) ===== */}
          {isSolicitud && (
            <div className="flex justify-end gap-3 mt-4">
              {/* RECHAZAR */}
              <button
                type="button"
                className="px-4 py-2 rounded border text-slate-600 cursor-pointer"
                onClick={async () => {
                  try {
                    await api.post(
                      `/solicitudes/${venta.solicitudId}/rechazar`
                    );

                    // 🔥 limpiar edición pendiente
                    localStorage.removeItem(
                      `venta_pending_${ventaData._id}`
                    );

                    onSaved();
                    onClose();
                  } catch {
                    alert(
                      "No se pudo rechazar la solicitud. Revisa el servidor."
                    );
                  }
                }}
              >
                Rechazar
              </button>

              {/* APROBAR */}
              <button
                type="button"
                className="px-4 py-2 rounded bg-green-600 text-white cursor-pointer"
                onClick={async () => {
                  try {
                    await api.post(
                      `/solicitudes/${venta.solicitudId}/aprobar`
                    );

                    // 🔥 limpiar edición pendiente
                    localStorage.removeItem(
                      `venta_pending_${ventaData._id}`
                    );

                    onSaved();
                    onClose();
                  } catch {
                    alert("No se pudo aprobar la solicitud");
                  }
                }}
              >
                Aprobar cambios
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== MODAL INFO PARA EMPLEADO ===== */}
      {showInfo && (
        <InfoModal
          title="Solicitud enviada"
          message="Tu solicitud de modificación ha sido enviada correctamente y queda pendiente de aprobación."
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
