import { useState } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";

const NuevaVenta = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fechaEfecto: "",
    aseguradora: "",
    ramo: "",
    numeroPoliza: "",
    tomador: "",
    primaNeta: "",
    formaPago: "",
  });

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await api.post("/ventas", {
        ...form,
        primaNeta: Number(form.primaNeta),
      });

      setSuccess(true);

      setForm({
        fechaEfecto: "",
        aseguradora: "",
        ramo: "",
        numeroPoliza: "",
        tomador: "",
        primaNeta: "",
        formaPago: "",
      });
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Error inesperado al guardar la venta");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-10 py-12">
      <div className="max-w-6xl mx-auto">

        {/* CABECERA */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Nueva venta
            </h1>
            <p className="text-slate-600 mt-1">
              Registro de póliza
            </p>
          </div>

          <button
            onClick={() => navigate("/crm/libro-ventas")}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            ← Volver al libro de ventas
          </button>
        </div>

        {/* FORMULARIO */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-300 rounded-xl shadow-md"
        >
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
            <Field label="Fecha de efecto">
              <input
                type="date"
                name="fechaEfecto"
                value={form.fechaEfecto}
                onChange={handleChange}
                className="input cursor-pointer"
              />
            </Field>

            <Field label="Aseguradora">
              <select
                name="aseguradora"
                value={form.aseguradora}
                onChange={handleChange}
                className="input cursor-pointer"
              >
                <option value="">Selecciona aseguradora</option>
                <option value="Mapfre">Mapfre</option>
                <option value="Verti">Verti</option>
                <option value="AXA">AXA</option>
              </select>
            </Field>

            <Field label="Ramo">
              <select
                name="ramo"
                value={form.ramo}
                onChange={handleChange}
                className="input cursor-pointer"
              >
                <option value="">Selecciona ramo</option>
                <option value="Auto">Auto</option>
                <option value="Hogar">Hogar</option>
                <option value="Vida">Vida</option>
              </select>
            </Field>

            <Field label="Número de póliza">
              <input
                name="numeroPoliza"
                placeholder="ABC123456"
                value={form.numeroPoliza}
                onChange={handleChange}
                className="input cursor-pointer"
              />
            </Field>

            <Field label="Tomador">
              <input
                name="tomador"
                placeholder="Nombre del cliente"
                value={form.tomador}
                onChange={handleChange}
                className="input cursor-pointer"
              />
            </Field>

            <Field label="Prima neta (€)">
              <input
                type="number"
                name="primaNeta"
                placeholder="0.00"
                value={form.primaNeta}
                onChange={handleChange}
                className="input cursor-pointer"
              />
            </Field>

            <Field label="Forma de pago">
              <select
                name="formaPago"
                value={form.formaPago}
                onChange={handleChange}
                className="input cursor-pointer"
              >
                <option value="">Selecciona forma de pago</option>
                <option value="Anual">Anual</option>
                <option value="Mensual">Mensual</option>
              </select>
            </Field>
          </div>

          {/* ERROR */}
          {error && (
            <div className="px-10 pb-4">
              <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md font-semibold">
                {error}
              </div>
            </div>
          )}

          {/* FOOTER */}
          <div className="px-10 py-6 bg-slate-50 border-t border-slate-300 flex justify-end">
            <button
              type="submit"
              className="px-10 py-3 text-lg rounded-md bg-slate-800 text-white font-semibold hover:bg-slate-900 transition cursor-pointer"
            >
              Guardar venta
            </button>
          </div>
        </form>
      </div>

      {/* MODAL ÉXITO */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40"></div>

          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-slate-800">
              Venta guardada
            </h3>

            <p className="text-slate-500 mt-1">
              La póliza se ha registrado correctamente
            </p>

            <button
              onClick={() => navigate("/crm/libro-ventas")}
              className="mt-6 px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition cursor-pointer"
            >
              Volver al libro de ventas
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* CAMPO AUXILIAR */
const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col space-y-2">
    <label className="text-base font-semibold text-slate-700">
      {label}
    </label>
    {children}
  </div>
);

export default NuevaVenta;
