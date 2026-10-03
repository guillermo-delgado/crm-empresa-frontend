import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  Clock,
  CalendarDays,
  History,
} from "lucide-react";

export default function LaboralBottomNav() {
  return (
    <nav
      aria-label="Navegación laboral"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-300/60 bg-[#d5ddf0]/95 backdrop-blur-xl shadow-[0_-8px_24px_rgba(29,36,51,0.12)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex overflow-x-auto no-scrollbar px-1.5 py-1.5">
        <NavItem
          to="/laboral/control-horario"
          label="Horario"
          icon={<Clock size={20} />}
        />

        <NavItem
          to="/laboral/calendario"
          label="Calendario"
          icon={<CalendarDays size={20} />}
        />

        <NavItem
          to="/laboral/historial"
          label="Historial"
          icon={<History size={20} />}
        />
      </div>
    </nav>
  );
}

function NavItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className="group relative flex min-w-[72px] flex-1 flex-shrink-0 flex-col items-center justify-center gap-0.5 py-1 outline-none"
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${
              isActive
                ? "bg-white text-[#2f5bd3] shadow-[0_4px_12px_-4px_rgba(29,36,51,0.3)]"
                : "text-slate-500 group-hover:bg-white/60 group-hover:text-slate-900 group-active:scale-95"
            }`}
          >
            {icon}
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