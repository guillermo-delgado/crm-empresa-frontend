import api from "../../services/api";
import VentaForm from "./VentaForm";

type Props = {
  venta: any;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditVentaModal({ venta, onClose, onSaved }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">
          Editar venta
        </h2>

        <VentaForm
          initialData={{
            fechaEfecto: venta.fechaEfecto?.split("T")[0],
            numeroPoliza: venta.numeroPoliza || venta.poliza,
            tomador: venta.tomador,
            aseguradora: venta.aseguradora,
            ramo: venta.ramo,
            primaNeta: venta.primaNeta || venta.prima,
            formaPago: venta.formaPago,
          }}
          submitLabel="Guardar cambios"
          onCancel={onClose}
          onSubmit={async (data) => {
            try {
              await api.put(`/ventas/${venta._id}`, {
                ...data,
                primaNeta: Number(data.primaNeta),
              });

              onSaved();
              onClose();
            } catch (error: any) {
              if (error.response?.status === 403) {
                alert(
                  "No tienes permisos para editar esta venta. La acción requiere aprobación de un administrador."
                );
              } else {
                alert("Error al guardar los cambios");
              }
            }
          }}
        />
      </div>
    </div>
  );
}
