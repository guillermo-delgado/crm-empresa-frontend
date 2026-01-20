import { NavLink, useNavigate } from "react-router-dom";
import {
  Clock,
  History,
  CalendarDays,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import api from "../../services/api";

type Props = {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
};

export default function LaboralSidebar({
  open,
  onClose,
  collapsed,
  setCollapsed,
}: Props) {
  const navigate = useNavigate();

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
    <>
      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside
        className={`
          hidden md:flex
          fixed left-0 top-0 h-screen
          ${collapsed ? "w-16" : "w-64"}
          bg-slate-900 text-white
          flex-col
          transition-all duration-300
          z-30
        `}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
          {!collapsed && (
            <span className="font-semibold">Zona laboral</span>
          )}

          <button
  onClick={() => setCollapsed(!collapsed)}
  className="text-slate-300 hover:text-white cursor-pointer transition"
  aria-label="Colapsar sidebar"
>

            {collapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
          </button>
        </div>

        {/* MENÚ */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          <NavLink
            to="/laboral/control-horario"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md ${
                isActive
                  ? "bg-slate-700"
                  : "text-slate-300 hover:bg-slate-800"
              }`
            }
          >
            <Clock size={20} />
            {!collapsed && <span>Control horario</span>}
          </NavLink>

          <NavLink
            to="/laboral/calendario"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md ${
                isActive
                  ? "bg-slate-700"
                  : "text-slate-300 hover:bg-slate-800"
              }`
            }
          >
            <CalendarDays size={20} />
            {!collapsed && <span>Calendario</span>}
          </NavLink>

          <NavLink
            to="/laboral/historial"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md ${
                isActive
                  ? "bg-slate-700"
                  : "text-slate-300 hover:bg-slate-800"
              }`
            }
          >
            <History size={20} />
            {!collapsed && <span>Historial</span>}
          </NavLink>
        </nav>

        {/* LOGOUT */}
        <div className="border-t border-slate-700">
          <button
  onClick={handleLogout}
  className="
    w-full flex items-center gap-3
    px-4 py-3
    text-slate-300
    cursor-pointer
    hover:bg-slate-800 hover:text-white
    transition
  "
>

            <LogOut size={20} />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ===== MOBILE OVERLAY ===== */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />

          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-900 text-white flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
              <span className="font-semibold">Zona laboral</span>
              <button
  onClick={onClose}
  className="cursor-pointer hover:text-white transition"
  aria-label="Cerrar menú"
>
  <X size={20} />
</button>

            </div>

            <nav className="flex-1 px-2 py-4 space-y-1">
              <NavLink
                to="/laboral/control-horario"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-300 hover:bg-slate-800"
              >
                <Clock size={20} />
                <span>Control horario</span>
              </NavLink>

              <NavLink
                to="/laboral/calendario"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-300 hover:bg-slate-800"
              >
                <CalendarDays size={20} />
                <span>Calendario</span>
              </NavLink>

              <NavLink
                to="/laboral/historial"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-300 hover:bg-slate-800"
              >
                <History size={20} />
                <span>Historial</span>
              </NavLink>
            </nav>

            <div className="border-t border-slate-700">
              <button
  onClick={handleLogout}
  className="
    w-full flex items-center gap-3
    px-4 py-3
    text-slate-300
    cursor-pointer
    hover:bg-slate-800 hover:text-white
    transition
  "
>

                <LogOut size={20} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
