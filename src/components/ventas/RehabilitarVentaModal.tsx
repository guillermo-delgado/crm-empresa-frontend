import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

/* =========================
   TIPOS
========================= */
type Props = {
  venta: {
    _id: string;
    numeroPoliza?: string;
    tomador?: string;
    estado?: "ANULADA" | string;
    solicitadoPor?: { nombre: string };
  };

  solicitud: {
    _id: string;
    tipo: "REHABILITAR_VENTA";
    estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
    payloadOrigen?: {
      motivo?: string;
      fechaTipo?: string;
      fechaAnulacion?: string;
      derivadoVerti?: boolean;
    };
  };

  onClose: () => void;
  onConfirm: () => void;
};

/* =========================
   COMPONENTE
========================= */
export default function RehabilitarVentaModal({
  venta,
  solicitud,
  onClose,
  onConfirm,
}: Props) {
  /* =========================
     ESTADO
  ========================= */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* =========================
     DEBUG MOUNT
  ========================= */
  // useEffect(() => {
  //   console.log("🟡 MODAL REHABILITAR MONTADO", {
  //     ventaId: venta?._id,
  //     estado: venta?.estado,
  //     solicitud,
  //     local: (solicitud as any)?.local,
  //   });
  // }, []);

  /* =========================
     VALIDACIONES INICIALES
  ========================= */
  useEffect(() => {
    // 🟢 MODO LOCAL (admin desde tabla) → NO validar
    if ((solicitud as any)?.local) {
      setError(null);
      return;
    }

    // 🔴 SOLO para solicitudes reales
    if (venta?.estado !== "ANULADA") {
      setError("La venta no está anulada");
    } else {
      setError(null);
    }
  }, [venta, solicitud]);

  /* =========================
     PAYLOAD MEMOIZADO
  ========================= */
  const payload = useMemo(() => {
    return solicitud?.payloadOrigen || null;
  }, [solicitud]);

  /* =========================
     ACCIONES
  ========================= */
 const aprobarRehabilitacion = async () => {
  setError(null);
  setLoading(true);

  console.log("🟢 CLICK REHABILITAR EN MODAL", {
    ventaId: venta?._id,
    solicitudId: solicitud?._id,
    local: (solicitud as any)?.local,
  });

  try {
    // 🟢 ADMIN DESDE TABLA → REHABILITACIÓN DIRECTA (MISMO FLUJO QUE EDITAR)
    if ((solicitud as any)?.local) {
      const res = await api.put(
        `/ventas/${venta._id}`,
        {
          estado: null, // 🔑 CLAVE: esto es EXACTAMENTE lo que hace "Editar → Rehabilitar"
        }
      );

      console.log("✅ VENTA REHABILITADA DIRECTAMENTE (ADMIN)", res.data);
    }

    // 🔵 SOLICITUD REAL (EMPLEADO)
    else {
      const res = await api.post(
        `/solicitudes/${solicitud._id}/aprobar`
      );

      console.log("✅ SOLICITUD REHABILITACIÓN APROBADA", res.data);
    }

    onConfirm();
    onClose();
  } catch (err: any) {
    console.error("❌ ERROR REHABILITAR VENTA", {
      status: err?.response?.status,
      data: err?.response?.data,
    });

    setError(
      err?.response?.data?.message ||
        "Error aprobando la rehabilitación"
    );
  } finally {
    setLoading(false);
  }
};


  const rechazarRehabilitacion = async () => {
    setError(null);
    setLoading(true);

    try {
      await api.post(`/solicitudes/${solicitud._id}/rechazar`);
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Error rechazando la rehabilitación"
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-6">

        {/* CERRAR */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-xl font-bold"
        >
          ×
        </button>

        {/* CABECERA */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Rehabilitar venta
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Estás a punto de rehabilitar una venta previamente anulada.
          </p>
        </div>

        {/* INFO VENTA */}
        <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm space-y-1">
          <div>
            <span className="text-slate-500">Póliza:</span>{" "}
            <strong>{venta.numeroPoliza || "-"}</strong>
          </div>
          <div>
            <span className="text-slate-500">Tomador:</span>{" "}
            {venta.tomador || "-"}
          </div>
        </div>

        {/* SOLICITANTE */}
        {venta?.solicitadoPor && (
          <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm">
            <span className="text-slate-500">Solicitado por:</span>{" "}
            <strong>{venta.solicitadoPor.nombre}</strong>
          </div>
        )}

        {/* ANULACIÓN ORIGINAL */}
        {payload && (
          <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm space-y-1">
            <div className="font-semibold text-slate-800 mb-2">
              Anulación original
            </div>

            {payload.motivo && (
              <div>
                <span className="text-slate-500">Motivo:</span>{" "}
                {payload.motivo}
              </div>
            )}

            {payload.fechaTipo && (
              <div>
                <span className="text-slate-500">Tipo de fecha:</span>{" "}
                {payload.fechaTipo}
              </div>
            )}

            {payload.fechaAnulacion && (
              <div>
                <span className="text-slate-500">Fecha de anulación:</span>{" "}
                {payload.fechaAnulacion}
              </div>
            )}

            <div>
              <span className="text-slate-500">Derivado a Verti:</span>{" "}
              {payload.derivadoVerti ? "Sí" : "No"}
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* ACCIONES */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={rechazarRehabilitacion}
            disabled={loading}
            className="px-4 py-2 border rounded text-sm hover:bg-slate-50"
          >
            Rechazar
          </button>

          <button
            onClick={aprobarRehabilitacion}
            disabled={loading || !!error}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Procesando..." : "Rehabilitar venta"}
          </button>
        </div>

      </div>
    </div>
  );
}
