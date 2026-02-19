import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import api from "../services/api";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(true);

  const [revisionCount, setRevisionCount] = useState(0);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const isAdmin = user?.role === "admin";

    if (isAdmin) return;

    const cargarRevisiones = async () => {
      try {
        const res = await api.get("/ventas/revisiones-pendientes");
        setRevisionCount(res.data?.count ?? 0);
      } catch {
        setRevisionCount(0);
      }
    };

    cargarRevisiones();
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-100">

      {/* SIDEBAR DESKTOP */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        revisionCount={revisionCount}
      />

      {/* CONTENIDO */}
      <main
        className={`
          min-h-screen 
          overflow-y-auto 
          p-4 
          pb-24
          md:pb-4
          transition-all duration-300
          ${collapsed ? "md:ml-16" : "md:ml-64"}
        `}
      >
        <Outlet context={{ setRevisionCount }} />
      </main>

      {/* BOTTOM NAV SOLO MÓVIL */}
      <BottomNav revisionCount={revisionCount} />

    </div>
  );
}
