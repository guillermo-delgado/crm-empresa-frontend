type Props = {
  onClose: () => void;
  children: React.ReactNode;
};

export default function SolicitudesPendientesModal({ onClose, children }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* HEADER */}
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-slate-800">
            Solicitudes pendientes
          </h2>
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-md bg-slate-800 text-white hover:bg-slate-900 transition"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
