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
  "Multirriesgo (074 o 078)",
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
    documentoFiscal: "",
    tomador: "",
    primaNeta: "",
    formaPago: "",
    actividad: "",
    observaciones: "",
    createdBy: "", // ← NUEVO (solo admin)
   createdAt: "",
  }); 


  
 // const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const [ventaHistorica, setVentaHistorica] = useState(false);
  useEffect(() => {
  if (!ventaHistorica) {
    setForm(f => ({ ...f, createdAt: "" }));
  }
}, [ventaHistorica]);



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
    const payload: any = {
      fechaEfecto: form.fechaEfecto,
      aseguradora: form.aseguradora,
      ramo: form.ramo,
      numeroPoliza: form.numeroPoliza,
      documentoFiscal: form.documentoFiscal,
      tomador: form.tomador,
      primaNeta: Number(form.primaNeta),
      formaPago: form.formaPago,
      actividad: form.actividad,
      observaciones: form.observaciones,
    };

    // Usuario asignado (admin)
    if (isAdmin && form.createdBy) {
      payload.createdBy = form.createdBy;
    }

    // 🔥 SOLO si es venta histórica
    if (isAdmin && ventaHistorica && form.createdAt) {
      payload.createdAt = form.createdAt;
    }

    await api.post("/ventas", payload);
    setShowSuccess(true);

  } catch (err: any) {
    setError(
      err.response?.data?.message ||
      "Error inesperado al guardar la venta"
    );
  }
};


  return (
  <div className="bg-slate-100 px-6 py-6">  
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
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">


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
            {isAdmin && (
  <div className="flex items-center gap-3">
    <span className="text-sm font-semibold text-slate-700">
      Venta histórica
    </span>

    <button
      type="button"
      onClick={() => setVentaHistorica(v => !v)}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        ventaHistorica ? "bg-slate-800" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          ventaHistorica ? "translate-x-6" : ""
        }`}
      />
    </button>
  </div>
)}

           {isAdmin && ventaHistorica && (
  <Field label="Fecha de creación (venta histórica)">
    <input
      type="date"
      name="createdAt"
      value={form.createdAt}
      onChange={handleChange}
      className="input cursor-pointer"
    />
  </Field>
)}



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

 <Field label="N.I.F / N.I.E / C.I.F">
  <input
    name="documentoFiscal"
    value={form.documentoFiscal}
    onChange={handleChange}
    className="input cursor-pointer"
    placeholder="12345678Z / B12345678"
    required
  />
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
<option value="Semestral">Semestral</option>
<option value="Trimestral">Trimestral</option>
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

    {/* Para todos los usuarios */}
    <option value="RECOMENDADO">RECOMENDADO</option>
    <option value="SGC">SGC</option>
    <option value="OFICINA">OFICINA</option>
    <option value="TELEFONICO">TELEFONICO</option>
    <option value="INTERNET">INTERNET</option>
    <option value="RED PERSONAL">RED PERSONAL</option>

    {/* Solo Admin */}
    {isAdmin && (
      <>
        <option value="FINCAS">ADMINISTRADOR DE FINCAS</option>
        <option value="COLABORADORES">COLABORADORES</option>
      </>
    )}
  </select>
</Field>


           <Field label="Observaciones">
  <textarea
    name="observaciones"
    value={form.observaciones}
    onChange={(e) => {
      setForm({ ...form, observaciones: e.target.value });

      // auto resize
      e.target.style.height = "auto";
      e.target.style.height = e.target.scrollHeight + "px";
    }}
    rows={3}
    className="input w-full resize-none overflow-hidden"
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

          <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-300 flex justify-end">

            <button
  type="submit"
  disabled={showSuccess}
  className="px-10 py-3 text-lg rounded-md bg-slate-800 text-white font-semibold cursor-pointer disabled:opacity-50"
>
  Guardar venta
</button>

          </div>
        </form>
      </div>
      {showSuccess && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">
        Venta guardada correctamente
      </h2>

      <p className="text-slate-600">
        La venta se ha registrado en el libro de ventas.
      </p>

      <div className="flex justify-end mt-6">
        <button
          onClick={() => {
            setShowSuccess(false);
            navigate("/crm/libro-ventas");
          }}
          className="px-6 py-2 bg-slate-800 text-white rounded-md font-semibold"
        >
          OK
        </button>
      </div>
    </div>
  </div>
)}

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
