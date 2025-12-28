type Props = {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  title,
  description,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">

        <h2 className="text-lg font-semibold text-red-600 mb-3">
          {title}
        </h2>

        <p className="text-sm text-slate-600">
          {description}
        </p>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 border rounded cursor-pointer"
          >
            Cancelar
          </button>

          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded cursor-pointer"
          >
            Eliminar
          </button>
        </div>

      </div>
    </div>
  );
}
