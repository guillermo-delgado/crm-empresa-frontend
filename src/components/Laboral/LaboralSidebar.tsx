import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Clock,
  History,
  CalendarDays,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import api from "../../services/api";

type Props = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
};

function leerUsuario(): any {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    return {};
  }
}

export default function LaboralSidebar({
  collapsed,
  setCollapsed,
}: Props) {
  const navigate = useNavigate();

  const user = leerUsuario();
  const isAdmin = user?.role === "admin";
  const nombre: string = user?.nombre || user?.name || user?.email || "Usuario";
  const inicial = nombre.trim().charAt(0).toUpperCase() || "U";

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  return (
    <aside
      className={`
        hidden md:flex
        fixed left-0 top-0 h-screen
        ${collapsed ? "w-16" : "w-64"}
        flex-col overflow-hidden
        bg-[#d5ddf0] text-slate-600
        shadow-[10px_0_30px_-14px_rgba(29,36,51,0.22)]
        transition-all duration-300
        z-30
      `}
    >
      {/* Resplandor suave superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.7),transparent_70%)]" />

      {/* CABECERA */}
      <div
        className={`relative flex h-[76px] items-center px-4 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white font-serif text-lg italic text-[#2f5bd3] shadow-[0_2px_6px_rgba(29,36,51,0.12)]">
              C
            </span>
            <div className="leading-none">
              <p className="font-serif text-[19px] tracking-tight text-slate-900">CRM</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-slate-500">
                Zona laboral
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-900"
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      {/* MENÚ */}
      <nav className="relative flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {collapsed ? (
          <div className="mx-auto mb-2 h-px w-6 bg-slate-400/40" />
        ) : (
          <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
            Mi jornada
          </p>
        )}

        <div className="space-y-1">
          <Item
            to="/laboral/control-horario"
            label="Control horario"
            icon={<Clock size={19} strokeWidth={1.6} />}
            collapsed={collapsed}
          />

          <Item
            to="/laboral/calendario"
            label="Calendario"
            icon={<CalendarDays size={19} strokeWidth={1.6} />}
            collapsed={collapsed}
          />

          <Item
            to="/laboral/historial"
            label="Historial"
            icon={<History size={19} strokeWidth={1.6} />}
            collapsed={collapsed}
          />
        </div>
      </nav>

      {/* USUARIO + CERRAR SESIÓN */}
      <div className="relative p-3">
        <div
          className={`flex items-center rounded-2xl bg-white/70 ring-1 ring-white ${
            collapsed ? "justify-center p-2" : "gap-3 p-2.5"
          }`}
        >
          <span
            title={collapsed ? nombre : undefined}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2f5bd3] to-[#5b8def] font-serif text-base font-semibold text-white"
          >
            {inicial}
          </span>

          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-medium text-slate-900">{nombre}</p>
                <p className="text-[11px] text-slate-500">
                  {isAdmin ? "Administrador" : "Empleado"}
                </p>
              </div>

              <button
                onClick={handleLogout}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut size={17} strokeWidth={1.7} />
              </button>
            </>
          )}
        </div>

        {collapsed && (
          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="mx-auto mt-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-900"
          >
            <LogOut size={17} strokeWidth={1.7} />
          </button>
        )}
      </div>
    </aside>
  );
}

function Item({
  to,
  label,
  icon,
  collapsed,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `group relative flex items-center rounded-2xl text-[14px] transition-all duration-200 ${
          collapsed ? "justify-center py-3" : "gap-3 px-3.5 py-2.5"
        } ${
          isActive
            ? "bg-white text-slate-900 shadow-[0_4px_14px_-6px_rgba(29,36,51,0.28)]"
            : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`relative shrink-0 transition-colors ${
              isActive ? "text-[#2f5bd3]" : "text-slate-500 group-hover:text-slate-700"
            }`}
          >
            {icon}
          </span>

          {!collapsed && (
            <span className={`truncate ${isActive ? "font-medium" : ""}`}>{label}</span>
          )}

          {!collapsed && isActive && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#2f5bd3]" />
          )}
        </>
      )}
    </NavLink>
  );
}