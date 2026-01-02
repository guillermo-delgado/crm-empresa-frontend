import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";

import LibroVentas from "./pages/LibroVentas";
import NuevaVenta from "./pages/ventas/NuevaVenta";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import CrearUsuario from "./pages/admin/CrearUsuario";

/* 🔔 SOCKET */
import { getSocket } from "./services/socket";

export default function App() {

  /* =========================
     SOCKET DIAGNÓSTICO
     ⚠️ PROVISIONAL (BORRAR)
  ========================= */
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

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("test_event");
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route path="/login" element={<Login />} />

        {/* RUTAS PROTEGIDAS */}
        <Route
          path="/crm/libro-ventas"
          element={
            <ProtectedRoute>
              <LibroVentas />
            </ProtectedRoute>
          }
        />

        <Route
          path="/crm/nueva-venta"
          element={
            <ProtectedRoute>
              <NuevaVenta />
            </ProtectedRoute>
          }
        />

        {/* NUEVA SECCIÓN ADMIN */}
        <Route
          path="/crm/usuarios"
          element={
            <ProtectedRoute adminOnly>
              <CrearUsuario />
            </ProtectedRoute>
          }
        />

        {/* DEFAULT */}
        <Route path="*" element={<Navigate to="/crm/libro-ventas" />} />
      </Routes>
    </BrowserRouter>
  );
}
