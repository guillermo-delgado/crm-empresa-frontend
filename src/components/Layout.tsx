import type { ReactNode } from "react";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 🔔 contador global REAL
  const [revisionCount, setRevisionCount] = useState(0);

  return (
    <div className="relative min-h-screen bg-slate-100">
      {/* SIDEBAR DESKTOP */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        revisionCount={revisionCount}
      />

      {/* BOTÓN HAMBURGUESA */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 bg-slate-900 text-white p-2 rounded-lg shadow"
      >
        <Menu size={20} />
      </button>

      {/* SIDEBAR MÓVIL */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <Sidebar
            mobile
            collapsed={false}
            setCollapsed={() => {}}
            revisionCount={revisionCount}
          />
        </div>
      )}

      {/* CONTENIDO */}
      <main
        className={`min-h-screen overflow-y-auto p-4 transition-all duration-300 ${
          collapsed ? "ml-16" : "ml-64"
        }`}
      >
        {/* 👇 ESTO ES LA CLAVE */}
        <Outlet context={{ setRevisionCount }} />
      </main>
    </div>
  );
}
