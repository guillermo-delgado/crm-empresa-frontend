import { NavLink } from "react-router-dom";
import {
  Clock,
  CalendarDays,
  History,
} from "lucide-react";

export default function LaboralBottomNav() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 shadow-lg">
      <div className="flex overflow-x-auto no-scrollbar">

        <NavItem
          to="/laboral/control-horario"
          icon={<Clock size={22} />}
        />

        <NavItem
          to="/laboral/calendario"
          icon={<CalendarDays size={22} />}
        />

        <NavItem
          to="/laboral/historial"
          icon={<History size={22} />}
        />

      </div>
    </div>
  );
}

function NavItem({
  to,
  icon,
}: {
  to: string;
  icon: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
        flex-shrink-0 w-20 h-16
        flex items-center justify-center
        transition
        ${
          isActive
            ? "text-sky-400"
            : "text-slate-400"
        }
      `
      }
    >
      {icon}
    </NavLink>
  );
}
