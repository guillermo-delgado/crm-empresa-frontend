type Props = {
  title: string;
  message: string;
  onClose: () => void;
};

export default function InfoModal({ title, message, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">

        <h2 className="text-lg font-semibold mb-3">
          {title}
        </h2>

        <p className="text-sm text-slate-600 mb-6">
          {message}
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
