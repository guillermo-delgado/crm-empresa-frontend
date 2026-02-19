import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  Users,
  CalendarDays,
} from "lucide-react";

type Props = {
  revisionCount?: number;
};

export default function BottomNav({ revisionCount = 0 }: Props) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800">
      <div className="flex overflow-x-auto no-scrollbar">

        {isAdmin && (
          <NavItem to="/crm/dashboard" icon={<LayoutDashboard size={20} />} />
        )}

        <NavItem
          to="/crm/libro-ventas"
          icon={<BookOpen size={20} />}
          badge={revisionCount}
        />

        <NavItem
          to="/crm/nueva-venta"
          icon={<PlusCircle size={20} />}
        />

        {isAdmin && (
          <>
            <NavItem
              to="/crm/horario"
              icon={<CalendarDays size={20} />}
            />
            <NavItem
              to="/crm/usuarios"
              icon={<Users size={20} />}
            />
          </>
        )}
      </div>
    </div>
  );
}

function NavItem({
  to,
  icon,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative flex-shrink-0 w-16 h-16 flex items-center justify-center transition-colors duration-200 ${
          isActive
            ? "text-white"
            : "text-slate-400 hover:text-white"
        }`
      }
    >
      {icon}

      {badge && badge > 0 && (
        <span className="absolute top-2 right-3 bg-sky-500 text-slate-900 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-semibold">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
