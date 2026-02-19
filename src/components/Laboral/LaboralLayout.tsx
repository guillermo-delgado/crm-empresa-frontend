import { useState, type ReactNode } from "react";
import LaboralSidebar from "./LaboralSidebar";
import LaboralBottomNav from "./LaboralBottomNav";

type Props = {
  children: ReactNode;
};

export default function LaboralLayout({ children }: Props) {
  // Sidebar escritorio (colapsado)
  const [collapsed, setCollapsed] = useState<boolean>(true);

  return (
    <div className="relative min-h-screen bg-slate-50">

      {/* SIDEBAR DESKTOP */}
      <LaboralSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      {/* CONTENIDO */}
      <main
        className={`
          min-h-screen
          px-4
          pb-24              /* espacio para bottom nav móvil */
          md:pb-4            /* normal en escritorio */
          transition-all duration-300
          ${collapsed ? "md:ml-16" : "md:ml-64"}
        `}
      >
        {children}
      </main>

      {/* BOTTOM NAV SOLO MÓVIL */}
      <LaboralBottomNav />

    </div>
  );
}
