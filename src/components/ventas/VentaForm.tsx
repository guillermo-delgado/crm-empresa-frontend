import { useEffect, useRef, useState } from "react";
import api from "../../services/api";

type Props = {
  initialData: any;
  originalData?: any;
  changedFields?: string[];
  hideActions?: boolean;
  submitLabel?: string;
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
};

type FormState = {
  fechaEfecto: string;
  createdBy: string;
  aseguradora: string;
  ramo: string;
  numeroPoliza: string;
  tomador: string;
  primaNeta: string;
  formaPago: string;
  actividad: string;
  observaciones: string;
};




type FormField = keyof FormState;




type Usuario = {
  _id: string;
  nombre: string;
  email: string;
  numma?: string;
};

function toInputDate(value?: string) {
  if (!value) return "";

  // yyyy-mm-dd → OK directo
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // dd/mm/yyyy
  if (value.includes("/")) {
    const [dd, mm, yyyy] = value.split("/");
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // ISO completo
  if (value.includes("T")) {
    return value.substring(0, 10);
  }

  return "";
}


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

export default function VentaForm({
  initialData,
  originalData = null,   // ✅ ← ESTA LÍNEA ES LA CLAVE
  submitLabel,
  onSubmit,
  onCancel,
  changedFields = [],
  hideActions = false,
}: Props) {


const observacionesRef = useRef<HTMLTextAreaElement>(null);

  const dateRef = useRef<HTMLInputElement>(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

const [form, setForm] = useState<FormState & {
  createdByLabel: string;
}>({
  fechaEfecto: "",
  createdBy: "",          // ← ID REAL
  createdByLabel: "",     // ← TEXTO VISIBLE
  aseguradora: "",
  ramo: "",
  numeroPoliza: "",
  tomador: "",
  primaNeta: "",
  formaPago: "",
  actividad: "",
  observaciones: "",
});




const normalizeValue = (field: FormField, value: any) => {
  if (value === undefined || value === null) return "";

  if (field === "fechaEfecto") {
    return String(value).slice(0, 10);
  }

  if (field === "primaNeta") {
    return Number(value);
  }

  return String(value).trim();
};




const isChanged = (field: FormField) => {
  // 🟢 Caso 1: viene de solicitud (empleado)
  if (changedFields.length > 0) {
    return changedFields.includes(field);
  }

  // 🟢 Caso 2: edición normal (admin)
  if (!originalData) return false;

  const original = normalizeValue(field, originalData[field]);
  const current = normalizeValue(field, form[field]);

  return original !== current;
};







  /* =========================
     CARGAR USUARIOS (ADMIN)
  ========================= */
  useEffect(() => {
    if (!isAdmin) return;

    api
      .get("/users/asignables")
      .then((res) => setUsuarios(res.data))
      .catch(() => {});
  }, [isAdmin]);

useEffect(() => {
  if (!initialData) return;

  setForm({
    fechaEfecto: toInputDate(initialData.fechaEfecto),

    // 🔑 NO viene createdBy → viene "usuario"
    createdBy: "",
    createdByLabel: initialData.usuario || "",

    aseguradora: initialData.aseguradora || "",
    ramo: initialData.ramo || "",
    numeroPoliza: initialData.numeroPoliza || "",
    tomador: initialData.tomador || "",
    primaNeta: initialData.primaNeta?.toString() || "",
    formaPago: initialData.formaPago || "",
    actividad: initialData.actividad || "",
    observaciones: initialData.observaciones || "",
  });
}, [initialData]);




useEffect(() => {
  if (!observacionesRef.current) return;

  const el = observacionesRef.current;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}, [form.observaciones]);



  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  if (!onSubmit) return;

  const { createdByLabel, ...data } = form;

  onSubmit({
    ...data,
    // solo enviamos createdBy si existe
    createdBy: data.createdBy || undefined,
  });
};



  return (
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
  className={`input cursor-pointer ${
    isChanged("fechaEfecto" as FormField)
      ? "border-red-500 ring-1 ring-red-400"
      : ""
  }`}
/>

 

 {isChanged("fechaEfecto" as FormField) && originalData && (
  <p className="text-red-600 text-xs mt-1">
    Antes: {originalData.fechaEfecto ?? "-"} 
  </p>
)}



        </Field>

        {/* USUARIO (SOLO ADMIN) */}
       {isAdmin && (
  <Field label="Usuario">
    <input
  list="usuarios-list"
  value={form.createdByLabel}
 onChange={(e) => {
  const value = e.target.value;

  setForm((prev) => ({
    ...prev,
    createdByLabel: value,
    createdBy: "",
  }));

  const u = usuarios.find(
    (u) =>
      u.nombre === value ||
      u.numma === value ||
      u.email === value
  );

  if (u) {
    setForm((prev) => ({
      ...prev,
      createdBy: u._id,
    }));
  }
}}

  className="input cursor-pointer"
  placeholder="Empieza a escribir nombre, email o numma"
/>


<datalist id="usuarios-list">
  {usuarios.map((u) => (
    <option key={u._id} value={u.numma}>
      {u.nombre}
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



   {isChanged("aseguradora" as FormField) && originalData && (
  <p className="text-red-600 text-xs mt-1">
    Antes: {originalData.aseguradora ?? "-"} 
  </p>
)}
        </Field>

        <Field label="Ramo">
          <input
            list="ramos-list"
            name="ramo"
            value={form.ramo}
            onChange={handleChange}
            className="input cursor-pointer"
            required
          />
          <datalist id="ramos-list">
            {ramosDisponibles.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>

          

  {isChanged("ramo" as FormField) && originalData && (
  <p className="text-red-600 text-xs mt-1">
    Antes: {originalData.ramo ?? "-"} 
  </p>
)}
        </Field>

        <Field label="Número de póliza">
          <input
            name="numeroPoliza"
            value={form.numeroPoliza}
            onChange={handleChange}
            className="input cursor-pointer"
          />
    

  {isChanged("numeroPoliza" as FormField) && originalData && (
  <p className="text-red-600 text-xs mt-1">
    Antes: {originalData.numeroPoliza ?? "-"} 
  </p>
)}
        </Field>

        <Field label="Tomador">
          <input
            name="tomador"
            value={form.tomador}
            onChange={handleChange}
            className="input cursor-pointer"
          />

          

  {isChanged("tomador" as FormField) && originalData && (
  <p className="text-red-600 text-xs mt-1">
    Antes: {originalData.tomador ?? "-"} 
  </p>
)}
        </Field>

        <Field label="Prima neta (€)">
          <input
  type="number"
  name="primaNeta"
  value={form.primaNeta}
  onChange={handleChange}
  className={`input cursor-pointer ${
    isChanged("primaNeta" as FormField)
      ? "border-red-500 ring-1 ring-red-400"
      : ""
  }`}
/>

{/* Prueba */}
{isChanged("primaNeta" as FormField) && originalData && (
  <p className="text-red-600 text-xs mt-1">
    Antes: {originalData.primaNeta ?? "-"} €
  </p>
)}




{/* fin prueba */}
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
      ref={observacionesRef}
      name="observaciones"
      value={form.observaciones}
      onChange={(e) => {
        setForm({ ...form, observaciones: e.target.value });

        e.target.style.height = "auto";
        e.target.style.height = e.target.scrollHeight + "px";
      }}
      rows={3}
      className="input w-full resize-none overflow-hidden"
    />
  </Field>

      </div>

      {!hideActions && (
  <div className="px-10 py-6 bg-slate-50 border-t border-slate-300 flex justify-end gap-4">
    {onCancel && (
      <button
        type="button"
        onClick={onCancel}
        className="px-6 py-2 border rounded cursor-pointer"
      >
        Cancelar
      </button>
    )}

    <button
      type="submit"
      className="px-8 py-3 rounded-md bg-slate-800 text-white font-semibold cursor-pointer"
    >
      {submitLabel}
    </button>
  </div>
)}

    </form>
  );
}

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
