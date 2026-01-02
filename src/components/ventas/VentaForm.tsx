import { useEffect, useRef, useState } from "react";
import api from "../../services/api";

type Props = {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

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
  "Auto",
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

export default function VentaForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Guardar cambios",
}: Props) {
  const dateRef = useRef<HTMLInputElement>(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [form, setForm] = useState({
    fechaEfecto: "",
    createdBy: "", // ← NUEVO (solo admin)
    aseguradora: "",
    ramo: "",
    numeroPoliza: "",
    tomador: "",
    primaNeta: "",
    formaPago: "",
    actividad: "",
    observaciones: "",
  });

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
    createdBy: initialData.usuario || "",
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




  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
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
              placeholder="Numma, nombre o email"
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
