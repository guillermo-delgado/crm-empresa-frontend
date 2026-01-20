import { useState } from "react";

type Props = {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
};

export default function ConfirmModal({
  title,
  description,
  onCancel,
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError(null);

      await onConfirm();
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setError(
          "No tienes permisos para realizar esta acción. Requiere aprobación de un administrador."
        );
      } else {
        setError("No se pudo completar la acción.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">

        <h2 className="text-lg font-semibold text-red-600 mb-3">
          {title}
        </h2>

        <p className="text-sm text-slate-600">
          {description}
        </p>

        {error && (
          <p className="text-sm text-red-500 mt-3">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border rounded cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded cursor-pointer disabled:opacity-50"
          >
            {loading ? "Procesando..." : "Eliminar"}
          </button>
        </div>

      </div>
    </div>
  );
}
