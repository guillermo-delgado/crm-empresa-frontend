import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";

/* ===== CRM ===== */
import LibroVentas from "./pages/crm/LibroVentas";
import NuevaVenta from "./pages/crm/NuevaVenta";
import CrearUsuario from "./pages/admin/CrearUsuario";
import HorarioCRM from "./pages/crm/horario/HorarioCRM";

/* ===== AUTH ===== */
import Login from "./pages/auth/Login";
import ProtectedRoute from "./components/auth/ProtectedRoute";

/* ===== LAYOUTS ===== */
import Layout from "./components/Layout";
import LaboralLayout from "./components/Laboral/LaboralLayout";

/* ===== ZONA LABORAL ===== */
import ControlHorario from "./pages/laboral/ControlHorario";
import HistorialHorario from "./components/Laboral/HistorialHorario";
import CalendarioLaboral from "./components/Laboral/CalendarioLaboral";

/* 🔔 SOCKET */
import { getSocket } from "./services/socket";

/* ======================================================
   🔔 SOCKET + NAVEGACIÓN
====================================================== */
function AppInner() {
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getSocket();

    socket.on("connect", () => {
      console.log("🟢 SOCKET CONECTADO:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("🔴 SOCKET ERROR:", err.message);
    });

    socket.on("SOLICITUD_RESUELTA", (data: any) => {
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

    socket.on("FORCE_LOGOUT", () => {
      localStorage.setItem("jornada_cerrada", "1");
      navigate("/laboral/control-horario", { replace: true });
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("SOLICITUD_RESUELTA");
      socket.off("FORCE_LOGOUT");
    };
  }, [navigate]);

  return (
    <Routes>
      {/* ================= LOGIN ================= */}
      <Route path="/login" element={<Login />} />

      {/* ================= ZONA LABORAL ================= */}
      <Route
        path="/laboral/control-horario"
        element={
          <ProtectedRoute>
            <LaboralLayout>
              <ControlHorario />
            </LaboralLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/laboral/historial"
        element={
          <ProtectedRoute>
            <LaboralLayout>
              <HistorialHorario />
            </LaboralLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/laboral/calendario"
        element={
          <ProtectedRoute>
            <LaboralLayout>
              <CalendarioLaboral />
            </LaboralLayout>
          </ProtectedRoute>
        }
      />

      {/* ================= CRM ================= */}
      <Route
        path="/crm/libro-ventas"
        element={
          <ProtectedRoute>
            <Layout>
              <LibroVentas />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/crm/nueva-venta"
        element={
          <ProtectedRoute>
            <Layout>
              <NuevaVenta />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
  path="/crm/horario"
  element={
    <ProtectedRoute adminOnly>
      <Layout>
        <HorarioCRM />
      </Layout>
    </ProtectedRoute>
  }
/>


      {/* ================= ADMIN ================= */}
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

      {/* ================= DEFAULT ================= */}
      <Route
        path="*"
        element={<Navigate to="/laboral/control-horario" replace />}
      />
    </Routes>
  );
}

/* ======================================================
   🌍 APP ROOT
====================================================== */
export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
