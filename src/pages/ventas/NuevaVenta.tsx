import { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";

const ramosDisponibles = [
  "Autos",
  "Hogar",
  "Vida",
  "Accidentes",
  "Salud",
  "Decesos Prima Periodica",
  "Decesos Prima única",
  "Empresa sin multirriesgo",
  "Empresas (074 o 078)",
  "Comunidades",
  "Patinetes",
  "Viajes",
  "Resto",
];

type Usuario = {
  _id: string;
  nombre: string;
  email: string;
  numma?: string;
};

const NuevaVenta = () => {
  const navigate = useNavigate();
  const dateRef = useRef<HTMLInputElement>(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [form, setForm] = useState({
    fechaEfecto: "",
    aseguradora: "",
    ramo: "",
    numeroPoliza: "",
    tomador: "",
    primaNeta: "",
    formaPago: "",
    actividad: "",
    observaciones: "",
    createdBy: "", // ← NUEVO (solo admin)
  });

 // const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* =========================
     CARGAR USUARIOS (solo admin)
  ========================= */
  useEffect(() => {
    if (!isAdmin) return;

   api
  .get("/users/asignables")
  .then((res) => setUsuarios(res.data))
  .catch(() => {});

  }, [isAdmin]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
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
        ...(isAdmin && form.createdBy
          ? { createdBy: form.createdBy }
          : {}),
      });

     // setSuccess(true);

      setForm({
        fechaEfecto: "",
        aseguradora: "",
        ramo: "",
        numeroPoliza: "",
        tomador: "",
        primaNeta: "",
        formaPago: "",
        actividad: "",
        observaciones: "",
        createdBy: "",
      });
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Error inesperado al guardar la venta"
      );
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

            {/* FECHA */}
            <Field label="Fecha de efecto">
              <input
                ref={dateRef}
                type="date"
                name="fechaEfecto"
                value={form.fechaEfecto}
                onChange={handleChange}
                onClick={() => dateRef.current?.showPicker()}
                className="input cursor-pointer"
              />
            </Field>

            {/* USUARIO (SOLO ADMIN) */}
            {isAdmin && (
              <Field label="Usuario">
                <input
                  list="usuarios-list"
                  name="createdBy"
                  value={form.createdBy}
                  onChange={handleChange}
                  className="input cursor-pointer"
                  placeholder="Escribe para buscar usuario"
                />

                <datalist id="usuarios-list">
                  {usuarios.map((u) => (
                    <option
  key={u._id}
  value={u.numma || u.nombre || u.email}
>
  {u.nombre} ({u.email})
</option>

                  ))}
                </datalist>
              </Field>
            )}

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
              </select>
            </Field>

            {/* RAMO */}
            <Field label="Ramo">
              <input
                list="ramos-list"
                name="ramo"
                value={form.ramo}
                onChange={handleChange}
                className="input cursor-pointer"
                placeholder="Escribe o selecciona ramo"
                required
              />
              <datalist id="ramos-list">
                {ramosDisponibles.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Field>

            <Field label="Número de póliza">
              <input
                name="numeroPoliza"
                value={form.numeroPoliza}
                onChange={handleChange}
                className="input cursor-pointer"
              />
            </Field>

            <Field label="Tomador">
              <input
                name="tomador"
                value={form.tomador}
                onChange={handleChange}
                className="input cursor-pointer"
              />
            </Field>

            <Field label="Prima neta (€)">
              <input
                type="number"
                name="primaNeta"
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

            <Field label="Actividad">
              <select
                name="actividad"
                value={form.actividad}
                onChange={handleChange}
                className="input cursor-pointer"
                required
              >
                <option value="">Selecciona actividad</option>
                <option value="SGC">SGC</option>
                <option value="OFICINA">OFICINA</option>
                <option value="TELEFONICO">TELEFONICO</option>
                <option value="INTERNET">INTERNET</option>
                <option value="RED PERSONAL">RED PERSONAL</option>
              </select>
            </Field>

            <Field label="Observaciones">
              <textarea
                name="observaciones"
                value={form.observaciones}
                onChange={handleChange}
                rows={3}
                className="input resize-none"
              />
            </Field>

          </div>

          {error && (
            <div className="px-10 pb-4">
              <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md font-semibold">
                {error}
              </div>
            </div>
          )}

          <div className="px-10 py-6 bg-slate-50 border-t border-slate-300 flex justify-end">
            <button
              type="submit"
              className="px-10 py-3 text-lg rounded-md bg-slate-800 text-white font-semibold cursor-pointer"
            >
              Guardar venta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* CAMPO AUX */
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
