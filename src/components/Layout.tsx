import type { ReactNode } from "react";
import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-slate-100">
      {/* SIDEBAR DESKTOP */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* BOTÓN HAMBURGUESA (MÓVIL) */}
      <button
        onClick={() => setMobileOpen(true)}
        className="
          md:hidden
          fixed
          top-4
          left-4
          z-50
          bg-slate-900
          text-white
          p-2
          rounded-lg
          shadow
        "
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* SIDEBAR MÓVIL */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* FONDO OSCURO */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />

          {/* MENÚ */}
          <Sidebar
            mobile
            collapsed={false}
            setCollapsed={() => {}}
          />
        </div>
      )}

      {/* CONTENIDO */}
      <main
        className={`
          min-h-screen
          overflow-y-auto
          p-4
          transition-all duration-300
          ${collapsed ? "ml-16" : "ml-64"}
        `}
      >
        {children}
      </main>
    </div>
  );
}
