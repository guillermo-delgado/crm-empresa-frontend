import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Clock, CalendarDays, History } from "lucide-react";

export default function LaboralBottomNav() {
  return (
    <nav
      aria-label="Navegación laboral"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-slate-200/70 bg-white shadow-[0_-10px_30px_rgba(29,36,51,0.10)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch px-3 pt-2 pb-2">
        <NavItem
          to="/laboral/control-horario"
          label="Horario"
          icon={<Clock size={22} />}
        />

        <NavItem
          to="/laboral/calendario"
          label="Calendario"
          icon={<CalendarDays size={22} />}
        />

        <NavItem
          to="/laboral/historial"
          label="Historial"
          icon={<History size={22} />}
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
      className="group relative flex flex-1 flex-col items-center justify-center gap-1 py-1 outline-none"
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute -top-2 h-[3px] w-8 rounded-full transition-all duration-200 ${
              isActive ? "bg-[#2f5bd3] opacity-100" : "opacity-0"
            }`}
          />

          <span
            className={`flex h-9 w-16 items-center justify-center rounded-2xl transition-all duration-200 ${
              isActive
                ? "bg-[#2f5bd3]/10 text-[#2f5bd3]"
                : "text-slate-400 group-active:scale-95 group-hover:text-slate-600"
            }`}
          >
            {icon}
          </span>

          <span
            className={`text-[11px] leading-none transition-colors duration-200 ${
              isActive
                ? "font-bold text-[#2f5bd3]"
                : "font-medium text-slate-400 group-hover:text-slate-600"
            }`}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}