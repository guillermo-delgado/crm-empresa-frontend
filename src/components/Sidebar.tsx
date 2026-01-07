import { NavLink } from "react-router-dom";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  PlusCircle,
  Users,
} from "lucide-react";

export default function Sidebar() {
  // 🔒 Siempre colapsado por defecto
  const [collapsed, setCollapsed] = useState(true);

  // 👤 Usuario actual
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  return (
    <aside
      className={`
        hidden md:flex
        ${collapsed ? "w-16" : "w-64"}
        bg-slate-900 text-white
        flex-col
        transition-all duration-300
        shrink-0
      `}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
        {!collapsed && (
          <span className="text-sm font-semibold tracking-wide">
            CRM Empresa
          </span>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="text-slate-300 hover:text-white"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* MENÚ */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {/* 📘 Libro de ventas (admin + empleado) */}
        <NavLink
          to="/crm/libro-ventas"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              isActive
                ? "bg-slate-700 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`
          }
        >
          <LayoutDashboard size={20} />
          {!collapsed && <span className="text-sm">Libro de ventas</span>}
        </NavLink>

        {/* ➕ Nueva venta (admin + empleado) */}
        <NavLink
          to="/crm/nueva-venta"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              isActive
                ? "bg-slate-700 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`
          }
        >
          <PlusCircle size={20} />
          {!collapsed && <span className="text-sm">Nueva venta</span>}
        </NavLink>

        {/* 👥 Usuarios (SOLO admin) */}
        {isAdmin && (
          <NavLink
            to="/crm/usuarios"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <Users size={20} />
            {!collapsed && <span className="text-sm">Usuarios</span>}
          </NavLink>
        )}
      </nav>

      {/* FOOTER SOLO ADMIN */}
      {isAdmin && !collapsed && (
        <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-700">
          Panel administrador
        </div>
      )}
    </aside>
  );
}
