import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const response = await api.post("/auth/login", {
        email,
        password,
      });

      // Guardamos solo si el backend responde OK
      localStorage.setItem("token", response.data.token);
      localStorage.setItem(
        "user",
        JSON.stringify(response.data.user)
      );

      // 🚫 NO window.location.href
      navigate("/libro-ventas", { replace: true });
    } catch (err: any) {
      // Si falla, aseguramos limpieza
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      setError(
        err.response?.data?.message ||
          "Error al iniciar sesión"
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-10 rounded-xl shadow-md w-full max-w-md"
      >
        <h1 className="text-3xl font-bold text-center mb-6">
          Acceso al CRM
        </h1>

        {error && (
          <div className="mb-4 text-red-600 font-medium text-center">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-lg font-semibold mb-1">
            Email
          </label>
          <input
            type="email"
            className="w-full border border-slate-400 rounded-md px-4 py-3 text-lg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-lg font-semibold mb-1">
            Contraseña
          </label>
          <input
            type="password"
            className="w-full border border-slate-400 rounded-md px-4 py-3 text-lg"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-slate-800 text-white py-3 rounded-md text-lg font-semibold hover:bg-slate-900 transition cursor-pointer"
        >
          Entrar
        </button>
      </form>
    </div>
  );
};

export default Login;
