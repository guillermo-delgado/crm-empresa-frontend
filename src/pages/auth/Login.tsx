import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import api from "../../services/api";
import { resetSocket, getSocket } from "../../services/socket";

const Login = () => {
  const navigate = useNavigate();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      const response = await api.post("/auth/login", {
        login: login.toLowerCase().trim(),
        password,
      });

      // 🔐 Guardar sesión
      localStorage.setItem("token", response.data.token);
      localStorage.setItem(
        "user",
        JSON.stringify(response.data.user)
      );

      // 🔥 MUY IMPORTANTE: recrear socket con userId
      resetSocket();
      getSocket();

      // ➡️ Redirección normal
      navigate("/crm/libro-ventas", { replace: true });
    } catch (err: any) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      setError(
        err.response?.data?.message ||
          "Error al iniciar sesión"
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f1f3f8]">
      {/* PANEL DE MARCA (solo escritorio) */}
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-[#d5ddf0] p-12 lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/60 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#2f5bd3]/15 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white font-serif text-xl italic text-[#2f5bd3] shadow-[0_2px_8px_rgba(29,36,51,0.12)]">
            C
          </span>
          <div className="leading-none">
            <p className="font-serif text-xl tracking-tight text-slate-900">CRM</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Empresa
            </p>
          </div>
        </div>

        <div className="relative">
          <h2 className="font-serif text-4xl leading-tight tracking-tight text-slate-900">
            Todo tu trabajo
            <br />
            en un solo lugar.
          </h2>
        </div>

        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} CRM Empresa
        </p>
      </aside>

      {/* FORMULARIO */}
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-[0_20px_50px_-24px_rgba(29,36,51,0.25)] sm:p-10"
        >
          {/* Marca en móvil */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d5ddf0] font-serif text-lg italic text-[#2f5bd3]">
              C
            </span>
            <p className="font-serif text-lg tracking-tight text-slate-900">
              CRM Empresa
            </p>
          </div>

          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Acceso al CRM
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Introduce tus datos para continuar.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-7">
            <label
              htmlFor="login"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Usuario (email o NUMMA)
            </label>
            <div className="relative">
              <User
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="login"
                type="text"
                autoComplete="username"
                autoFocus
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2f5bd3] focus:ring-4 focus:ring-[#2f5bd3]/15"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Contraseña
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="password"
                type={verPassword ? "text" : "password"}
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2f5bd3] focus:ring-4 focus:ring-[#2f5bd3]/15"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="mt-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#2f5bd3] py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_-10px_rgba(47,91,211,0.7)] transition hover:bg-[#2548b3] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {cargando ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </main>
    </div>
  );
};

export default Login;