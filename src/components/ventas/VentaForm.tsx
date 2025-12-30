import { useEffect, useState } from "react";

type Props = {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

// 🔑 conversión REAL para input date
function toInputDate(value?: string) {
  if (!value) return "";

  // acepta dd/mm/yyyy
  if (value.includes("/")) {
    const [dd, mm, yyyy] = value.split("/");
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // acepta ISO
  if (value.includes("T")) {
    return value.substring(0, 10);
  }

  return "";
}

export default function VentaForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Guardar cambios",
}: Props) {
  const [form, setForm] = useState({
    fechaEfecto: "",
    aseguradora: "",
    ramo: "",
    numeroPoliza: "",
    tomador: "",
    primaNeta: "",
    formaPago: "",
  });

  // ✅ AQUÍ estaba el fallo real
  useEffect(() => {
    if (!initialData) return;

    setForm({
      fechaEfecto: toInputDate(initialData.fechaEfecto),
      aseguradora: initialData.aseguradora || "",
      ramo: initialData.ramo || "",
      numeroPoliza: initialData.numeroPoliza || "",
      tomador: initialData.tomador || "",
      primaNeta: initialData.primaNeta?.toString() || "",
      formaPago: initialData.formaPago || "",
    });
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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
            <option value="Accidentes">Accidentes</option>
            <option value="Salud">Salud</option>
            <option value="DecesosPP">Decesos Prima Periodica</option>
            <option value="DecesosPU">Decesos Prima única</option>
            <option value="RC">Empresa sin multirriesgo</option>
            <option value="Empresas">Empresas (074 o 078)</option>
            <option value="Comunidades">Comunidades</option>
            <option value="Patinetes">Patinetes</option>
            <option value="Viajesida">Viajes</option>
            <option value="Resto">Resto</option>
          </select>
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
