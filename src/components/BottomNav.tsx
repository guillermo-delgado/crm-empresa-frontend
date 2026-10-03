import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  Gift,
  Users,
  CalendarDays,
} from "lucide-react";

type Props = {
  revisionCount?: number;
};

function leerUsuario(): { role?: string } {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    return {};
  }
}

export default function BottomNav({ revisionCount = 0 }: Props) {
  const isAdmin = leerUsuario().role === "admin";

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-300/60 bg-[#d5ddf0]/95 backdrop-blur-xl shadow-[0_-8px_24px_rgba(29,36,51,0.12)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex overflow-x-auto no-scrollbar px-1.5 py-1.5">
        {isAdmin && (
          <NavItem
            to="/crm/dashboard"
            label="Panel"
            icon={<LayoutDashboard size={20} />}
          />
        )}

        <NavItem
          to="/crm/libro-ventas"
          label="Ventas"
          icon={<BookOpen size={20} />}
          badge={revisionCount}
        />

        <NavItem
          to="/crm/nueva-venta"
          label="Nueva"
          icon={<PlusCircle size={20} />}
        />

        {/* Sorteos: lo ven todos (el empleado en modo lectura) */}
        <NavItem
          to="/crm/sorteos"
          label="Sorteos"
          icon={<Gift size={20} />}
        />

        {isAdmin && (
          <>
            <NavItem
              to="/crm/horario"
              label="Horario"
              icon={<CalendarDays size={20} />}
            />
            <NavItem
              to="/crm/usuarios"
              label="Usuarios"
              icon={<Users size={20} />}
            />
          </>
        )}
      </div>
    </nav>
  );
}

function NavItem({
  to,
  icon,
  label,
  badge,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className="group relative flex min-w-[64px] flex-1 flex-shrink-0 flex-col items-center justify-center gap-0.5 py-1 outline-none"
    >
      {({ isActive }) => (
        <>
          <span
            className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200 ${
              isActive
                ? "bg-white text-[#2f5bd3] shadow-[0_4px_12px_-4px_rgba(29,36,51,0.3)]"
                : "text-slate-500 group-hover:bg-white/60 group-hover:text-slate-900 group-active:scale-95"
            }`}
          >
            {icon}

            {(badge ?? 0) > 0 && (
              <span className="absolute -top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2f5bd3] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#d5ddf0]">
                {badge}
              </span>
            )}
          </span>

          <span
            className={`text-[10px] font-semibold leading-none transition-colors duration-200 ${
              isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"
            }`}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}