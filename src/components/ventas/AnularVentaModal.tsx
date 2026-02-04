import { useEffect, useState } from "react";
import api from "../../services/api";

/* =========================
   TIPOS
========================= */
type Props =
  | {
      venta: {
        _id: string;
        numeroPoliza?: string;
        tomador?: string;
        solicitudId: string;
        solicitadoPor?: { nombre: string };
        estadoRevision?: "pendiente" | "aceptada" | "rechazada" | null;
      };

      solicitud: {
        _id: string;
        tipo: "ANULAR_VENTA";
        estado: "PENDIENTE";
        payload?: {
          fechaTipo?: "VENCIMIENTO" | "FECHA";
          fechaAnulacion?: string;
          motivo?: string;
          derivadoVerti?: boolean;
        };
      };

      onClose: () => void;
      onConfirm: () => void;
    }
  | {
      venta: {
        _id: string;
        numeroPoliza?: string;
        tomador?: string;
        estadoRevision?: "pendiente" | "aceptada" | "rechazada" | null;
      };

      solicitud?: undefined;

      onClose: () => void;
      onConfirm: () => void;
    };

/* =========================
   COMPONENTE
========================= */
export default function AnularVentaModal({
  venta,
  solicitud,
  onClose,
  onConfirm,
}: Props) {
  /* =========================
     ESTADO
  ========================= */
  const [fechaTipo, setFechaTipo] =
    useState<"VENCIMIENTO" | "FECHA">("VENCIMIENTO");
  const [fechaAnulacion, setFechaAnulacion] = useState("");
  const [motivo, setMotivo] = useState("");
  const [derivadoVerti, setDerivadoVerti] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* =========================
     FLAGS
  ========================= */
  const esRevision = "solicitudId" in venta && !!venta.solicitudId;

  const haySolicitudPendiente =
    !esRevision && venta.estadoRevision === "pendiente";

  /* =========================
     CARGAR PAYLOAD SI EXISTE
  ========================= */
  useEffect(() => {
    if (!solicitud?.payload) return;

    setMotivo(solicitud.payload.motivo || "");
    setFechaTipo(solicitud.payload.fechaTipo || "VENCIMIENTO");
    setFechaAnulacion(solicitud.payload.fechaAnulacion || "");
    setDerivadoVerti(!!solicitud.payload.derivadoVerti);
  }, [solicitud]);

  /* =========================
     VALIDACIÓN
  ========================= */
  const validar = () => {
    if (!motivo.trim()) {
      setError("El motivo es obligatorio.");
      return false;
    }

    if (fechaTipo === "FECHA" && !fechaAnulacion) {
      setError("Debes seleccionar la fecha.");
      return false;
    }

    return true;
  };

  /* =========================
     ENVÍO
  ========================= */
  const enviarAnulacion = async () => {
    setError(null);
    if (!validar()) return;

    setLoading(true);

    try {
      await api.post(`/ventas/${venta._id}/anular`, {
        fechaTipo,
        fechaAnulacion:
          fechaTipo === "FECHA" ? fechaAnulacion : undefined,
        motivo: motivo.trim(),
        derivadoVerti,
      });

      onConfirm();
      onClose();
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || "";

      if (status === 403) {
        onConfirm();
        onClose();
        return;
      }

      setError(message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-6">

        {/* CERRAR */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
        >
          ×
        </button>

        {/* CABECERA */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Anular venta
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Esta acción generará una solicitud de anulación para revisión.
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

        {/* SOLICITADO POR */}
        {"solicitadoPor" in venta && venta.solicitadoPor && (
          <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm">
            <span className="text-slate-500">Solicitado por:</span>{" "}
            <strong>{venta.solicitadoPor.nombre}</strong>
          </div>
        )}

        {/* FECHA */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700">
            Fecha
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setFechaTipo("VENCIMIENTO");
                setFechaAnulacion("");
              }}
              className={`flex-1 px-3 py-2 rounded border cursor-pointer ${
                fechaTipo === "VENCIMIENTO"
                  ? "bg-slate-900 text-white"
                  : "bg-white"
              }`}
            >
              Vencimiento
            </button>

            <button
              type="button"
              onClick={() => setFechaTipo("FECHA")}
              className={`flex-1 px-3 py-2 rounded border cursor-pointer ${
                fechaTipo === "FECHA"
                  ? "bg-slate-900 text-white"
                  : "bg-white"
              }`}
            >
              A fecha
            </button>
          </div>

          {fechaTipo === "FECHA" && (
            <input
              type="date"
              value={fechaAnulacion}
              onChange={(e) => setFechaAnulacion(e.target.value)}
              onClick={(e) =>
                (e.target as HTMLInputElement).showPicker?.()
              }
              className="w-full border rounded px-3 py-2 text-sm cursor-pointer"
            />
          )}
        </div>

        {/* MOTIVO + VERTI */}
        {!esRevision && (
          <>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Describe el motivo…"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-slate-700">
                Derivado a Verti
              </span>

              <button
                type="button"
                onClick={() => setDerivadoVerti(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer
                  ${derivadoVerti ? "bg-green-600" : "bg-slate-300"}`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white transform
                    ${derivadoVerti ? "translate-x-5" : "translate-x-1"}`}
                />
              </button>
            </div>
          </>
        )}

        {/* ERROR */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* ACCIONES */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          {esRevision ? (
            <>
              <button
                onClick={async () => {
                  await api.post(
                    `/solicitudes/${venta.solicitudId}/rechazar`
                  );
                  onClose();
                }}
                className="px-4 py-2 border rounded text-sm cursor-pointer"
              >
                Rechazar
              </button>

              <button
                onClick={async () => {
                  await api.post(
                    `/solicitudes/${venta.solicitudId}/aprobar`
                  );
                  onConfirm();
                }}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm cursor-pointer"
              >
                Aprobar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded text-sm cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={enviarAnulacion}
                disabled={loading || haySolicitudPendiente}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm cursor-pointer disabled:opacity-50"
              >
                {haySolicitudPendiente
                  ? "Solicitud enviada"
                  : loading
                  ? "Enviando..."
                  : "Enviar anulación"}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
