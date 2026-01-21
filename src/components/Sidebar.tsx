import { NavLink, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  PlusCircle,
  Users,
  CalendarDays,
  LogOut,
} from "lucide-react";
import api from "../services/api";

type SidebarProps = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  mobile?: boolean;

  // 🔔 NUEVO: contador de revisiones
  revisionCount?: number;
};

export default function Sidebar({
  collapsed,
  setCollapsed,
  mobile = false,
  revisionCount = 0,
}: SidebarProps) {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  return (
    <aside
      className={`
        ${mobile ? "flex" : "hidden md:flex"}
        ${collapsed ? "w-16" : "w-64"}
        bg-slate-900 text-white
        flex-col
        transition-all duration-300
        fixed left-0 top-0 h-screen z-50
      `}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
        {!collapsed && (
          <span className="text-sm font-semibold tracking-wide">
            CRM Empresa
          </span>
        )}

        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-300 hover:text-white"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
      </div>

      {/* MENÚ */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {/* 📊 LIBRO DE VENTAS + BADGE */}
        <NavLink
          to="/crm/libro-ventas"
          className={({ isActive }) =>
            `relative flex items-center gap-3 px-3 py-2 rounded-md ${
              isActive
                ? "bg-slate-700 text-white"
                : "text-slate-300 hover:bg-slate-800"
            }`
          }
        >
          <LayoutDashboard size={20} />

          {!collapsed && <span>Libro de ventas</span>}

          {/* 🔔 BADGE */}
         {revisionCount > 0 && (
  <span
    className={`
      ${collapsed
        ? "absolute -top-1 -right-1 w-5 h-5 text-[11px]"
        : "ml-auto px-2 py-0.5 text-xs"}
      flex items-center justify-center
      bg-sky-500
      text-slate-700
      font-semibold
      rounded-full
    `}
  >
    {revisionCount}
  </span>
)}


        </NavLink>

        <NavLink
          to="/crm/nueva-venta"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md ${
              isActive
                ? "bg-slate-700 text-white"
                : "text-slate-300 hover:bg-slate-800"
            }`
          }
        >
          <PlusCircle size={20} />
          {!collapsed && <span>Nueva venta</span>}
        </NavLink>

        {/* 🔥 GESTIÓN EMPLEADOS */}
        {isAdmin && (
          <NavLink
            to="/crm/horario"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md ${
                isActive
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`
            }
          >
            <CalendarDays size={20} />
            {!collapsed && <span>G. Empleados</span>}
          </NavLink>
        )}

        {isAdmin && (
          <NavLink
            to="/crm/usuarios"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md ${
                isActive
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`
            }
          >
            <Users size={20} />
            {!collapsed && <span>Usuarios</span>}
          </NavLink>
        )}
      </nav>

      {/* LOGOUT */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800"
      >
        <LogOut size={20} />
        {!collapsed && <span>Cerrar sesión</span>}
      </button>
    </aside>
  );
}
