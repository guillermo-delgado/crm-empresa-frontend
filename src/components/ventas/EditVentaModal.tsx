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

// ✅ CLAVE PARA EL BUILD (una sola vez)
const usuariosAsignables = usuarios;



  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const isSolicitud =
    isAdmin &&
    !!venta?.solicitudId &&
    changedFields.length > 0;

  const isDelete = changedFields.includes("__DELETE__");

  /* =========================
     CARGAR USUARIOS (ADMIN)
     (se mantiene por compatibilidad futura)
  ========================= */
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

            {/* 🔴 REHABILITAR VENTA (SOLO ADMIN Y SOLO SI ESTÁ ANULADA) */}
{ventaData?.estado === "ANULADA" && (

  <div className="mb-4 flex items-center gap-4 p-3 rounded-md bg-red-50 border border-red-200">
    <span className="text-sm font-medium text-red-700">
      Esta venta está anulada
    </span>

<button
  type="button"
  onClick={async () => {
    try {
      await api.post(
  `/ventas/${ventaData._id}/rehabilitar`,
  {},
  {
    validateStatus: (status) => status === 403 || status < 400,
  }
);

    } catch (error: any) {
      // 🟡 403 = solicitud creada correctamente (COMPORTAMIENTO ESPERADO)
      if (error?.response?.status !== 403) {
        console.error("❌ Error inesperado solicitando rehabilitación", error);
      }
    } finally {
      // ✅ SIEMPRE: cerrar modal y mostrar InfoModal
      setShowInfo(true);
    }
  }}
  className="
    ml-auto
    px-3 py-1.5
    rounded-md
    text-xs font-semibold
    bg-white
    border border-red-300
    text-red-700
    hover:bg-red-100
    cursor-pointer
  "
>
  Solicitar rehabilitación
</button>



  </div>
)}


            <VentaForm
            usuariosAsignables={usuariosAsignables}
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
              hideActions={ventaData?.estado === "ANULADA"}
              submitLabel={isDelete ? "" : "Guardar cambios"}
              onCancel={onClose}
              onSubmit={async (data) => {
                if (isSolicitud) return;

                try {
                  const createdById =
                    data.createdBy || ventaData.createdBy?._id;

                  // =========================
                  // NORMALIZAR Y COMPARAR DNI
                  // =========================
                  const documentoFiscalNormalizado =
                    data.documentoFiscal?.trim() === ""
                      ? undefined
                      : data.documentoFiscal?.trim();

                  const documentoFiscalOriginal =
                    ventaData.documentoFiscal?.trim() || "";

                  const documentoFiscalHaCambiado =
                    documentoFiscalNormalizado !== documentoFiscalOriginal;

                  // =========================
                  // CONSTRUIR PAYLOAD LIMPIO
                  // =========================
                  const payload: any = {
                    fechaEfecto: data.fechaEfecto,
                    aseguradora: data.aseguradora,
                    ramo: data.ramo,
                    numeroPoliza: data.numeroPoliza,
                    tomador: data.tomador,
                    primaNeta: Number(data.primaNeta),
                    formaPago: data.formaPago,
                    actividad: data.actividad,
                    observaciones: data.observaciones,
                    createdBy: createdById,
                  };

                

                  // 🔑 SOLO enviar DNI si realmente cambia
                  if (documentoFiscalHaCambiado) {
                    payload.documentoFiscal =
                      documentoFiscalNormalizado;
                  }

                  await api.put(
                    `/ventas/${ventaData._id}`,
                    payload
                  );

                  // 🔔 Notificar al padre (LibroVentas)
                  onSaved?.({ _id: ventaData._id });

                  onClose();
              } catch (error: any) {
  const status = error.response?.status;

  // 🟡 EMPLEADO → 403 = solicitud enviada correctamente
  if (status === 403) {
    console.info("🟡 Solicitud enviada para revisión (403 esperado)");

    // Cerrar modal igualmente
    onClose();

    return;
  }

  // 🔴 Error real
  console.error("❌ Error editando venta:", {
    status,
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

                    await api.delete(
                      `/ventas/${ventaData._id}`
                    );
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
