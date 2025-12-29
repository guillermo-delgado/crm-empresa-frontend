import { useState } from "react";
import api from "../../services/api";

export default function CrearUsuario() {
  const [form, setForm] = useState({
    nombre: "",
    apellidos: "",
    nif: "",
    numma: "",
    email: "",
    password: "",
    role: "empleado",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      await api.post("/users", form);
      setSuccess("Usuario creado correctamente");

      setForm({
        nombre: "",
        apellidos: "",
        nif: "",
        numma: "",
        email: "",
        password: "",
        role: "empleado",
      });
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Error al crear el usuario"
      );
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        Crear usuario
      </h1>

      {error && (
        <div className="mb-4 text-red-600 font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 text-green-600 font-medium">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <input
          name="nombre"
          placeholder="Nombre"
          value={form.nombre}
          onChange={handleChange}
          className="input"
          required
        />

        <input
          name="apellidos"
          placeholder="Apellidos"
          value={form.apellidos}
          onChange={handleChange}
          className="input"
          required
        />

        <input
          name="nif"
          placeholder="NIF"
          value={form.nif}
          onChange={handleChange}
          className="input"
          required
        />

        <input
          name="numma"
          placeholder="NUMMA"
          value={form.numma}
          onChange={handleChange}
          className="input"
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="input"
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Contraseña"
          value={form.password}
          onChange={handleChange}
          className="input"
          required
        />

        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          className="input col-span-2"
        >
          <option value="empleado">Empleado</option>
          <option value="colaborador">Colaborador</option>
          <option value="admin">Administrador</option>
        </select>

        <div className="col-span-2 flex justify-end pt-4">
          <button
            type="submit"
            className="bg-slate-800 text-white px-6 py-2 rounded"
          >
            Crear usuario
          </button>
        </div>
      </form>
    </div>
  );
}
