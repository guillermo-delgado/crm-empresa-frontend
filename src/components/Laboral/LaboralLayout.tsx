import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import LaboralSidebar from "./LaboralSidebar";

type Props = {
  children: ReactNode;
};

export default function LaboralLayout({ children }: Props) {
  // Sidebar móvil
  const [open, setOpen] = useState<boolean>(false);

  // Sidebar escritorio (colapsado)
  const [collapsed, setCollapsed] = useState<boolean>(true);

  const closeSidebar = () => {
    setOpen(false);
  };

  return (
    <div className="relative min-h-screen bg-slate-50">
      {/* BOTÓN HAMBURGUESA (MÓVIL) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          fixed top-4 left-4 z-50
          bg-slate-900 text-white
          p-2 rounded-lg shadow
          md:hidden
        "
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* SIDEBAR */}
      <LaboralSidebar
        open={open}
        onClose={closeSidebar}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      {/* CONTENIDO */}
      <main
        className={`
          min-h-screen
          pt-16 md:pt-6
          px-4
          transition-all duration-300
          ${collapsed ? "md:ml-16" : "md:ml-64"}
        `}
      >
        {children}
      </main>
    </div>
  );
}
