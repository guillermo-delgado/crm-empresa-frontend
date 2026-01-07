import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";

import LibroVentas from "./pages/LibroVentas";
import NuevaVenta from "./pages/ventas/NuevaVenta";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import CrearUsuario from "./pages/admin/CrearUsuario";
import Layout from "./components/Layout";

/* 🔔 SOCKET */
import { getSocket } from "./services/socket";

export default function App() {
  useEffect(() => {
    const socket = getSocket();

    console.log("🧪 [PROVISIONAL] Intentando conectar socket...");

    socket.on("connect", () => {
      console.log("🟢 [PROVISIONAL] SOCKET CONECTADO:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("🔴 [PROVISIONAL] SOCKET ERROR:", err.message);
    });

    socket.on("test_event", (msg) => {
      console.log("🔥 [PROVISIONAL] TEST EVENT RECIBIDO:", msg);
    });

    socket.on("SOLICITUD_RESUELTA", (data: any) => {
      console.log("🧹 Solicitud resuelta:", data);

      if (data?.ventaId) {
        localStorage.removeItem(`venta_pending_${data.ventaId}`);
        return;
      }

      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("venta_pending_")) {
          localStorage.removeItem(key);
        }
      });
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("test_event");
      socket.off("SOLICITUD_RESUELTA");
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route path="/login" element={<Login />} />

        {/* ===== RUTAS ADMIN CON LAYOUT ===== */}
        <Route
          path="/crm/libro-ventas"
          element={
            <ProtectedRoute adminOnly>
              <Layout>
                <LibroVentas />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/crm/nueva-venta"
          element={
            <ProtectedRoute adminOnly>
              <Layout>
                <NuevaVenta />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/crm/usuarios"
          element={
            <ProtectedRoute adminOnly>
              <Layout>
                <CrearUsuario />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* DEFAULT */}
        <Route path="*" element={<Navigate to="/crm/libro-ventas" />} />
      </Routes>
    </BrowserRouter>
  );
}
