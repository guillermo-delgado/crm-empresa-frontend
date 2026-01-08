type InfoType = "edit" | "delete";

type Props = {
  type?: InfoType;
  title?: string;
  message?: string;
  onClose: () => void;
};

const DEFAULT_CONTENT: Record<InfoType, { title: string; message: string }> = {
  edit: {
    title: "Solicitud enviada",
    message:
      "Tu solicitud de modificación ha sido enviada correctamente y queda pendiente de aprobación.",
  },
  delete: {
    title: "Solicitud enviada",
    message:
      "Tu solicitud de eliminación ha sido enviada correctamente y queda pendiente de aprobación.",
  },
};

export default function InfoModal({
  type = "edit",
  title,
  message,
  onClose,
}: Props) {
  const content = DEFAULT_CONTENT[type];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold mb-3">
          {title ?? content.title}
        </h2>

        <p className="text-sm text-slate-600 mb-6">
          {message ?? content.message}
        </p>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-800 text-white cursor-pointer"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
