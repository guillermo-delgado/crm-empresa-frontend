import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

/* ===== CRM ===== */
import LibroVentas from "./pages/crm/LibroVentas";
import NuevaVenta from "./pages/crm/NuevaVenta";
import CrearUsuario from "./pages/admin/CrearUsuario";
import HorarioCRM from "./pages/crm/horario/HorarioCRM";
import Dashboard from "./pages/crm/Dashboard";
import ExcelComisiones from "./pages/crm/ExcelComisiones";
import Sorteos from "./pages/crm/Sorteos";
import Agenda from "./pages/agenda/Agenda";
import AgendaBoton from "./pages/agenda/AgendaBoton";

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
   🔔 AVISO DE SOLICITUD RESUELTA (solo empleado)
====================================================== */
type AvisoSolicitud = {
  id: number;
  aceptada: boolean;
  texto: string;
};

const ACCIONES: Record<string, string> = {
  EDITAR_VENTA: "de edición",
  ANULAR_VENTA: "de anulación",
  ELIMINAR_VENTA: "de eliminación",
  REHABILITAR_VENTA: "de rehabilitación",
};

function textoAviso(data: any, aceptada: boolean) {
  const tipo = ACCIONES[data?.tipo] || "";
  const ref =
    data?.numeroPoliza || data?.poliza || data?.tomador || data?.venta?.numeroPoliza || data?.venta?.tomador;
  return `Tu solicitud ${tipo}${ref ? ` de la venta ${ref}` : ""} ha sido ${
    aceptada ? "aceptada" : "rechazada"
  }.`.replace("  ", " ");
}

/* ======================================================
   🔔 SOCKET + NAVEGACIÓN
====================================================== */
function AppInner() {
  const navigate = useNavigate();

  const [facturaProgress, setFacturaProgress] = useState<{
    porcentaje: number;
    texto: string;
  } | null>(null);

  const [avisos, setAvisos] = useState<AvisoSolicitud[]>([]);
  const avisoId = useRef(0);

  const cerrarAviso = (id: number) =>
    setAvisos((prev) => prev.filter((a) => a.id !== id));

  useEffect(() => {
    const socket = getSocket();

    if (!socket) {
      return;
    }

    socket.on("connect", () => {
      console.log("🟢 SOCKET CONECTADO:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("🔴 SOCKET ERROR:", err.message);
    });

    socket.on("SOLICITUD_RESUELTA", (data: any) => {
      // 🔔 Aviso al empleado (en cualquier pantalla), no al admin.
      try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        const estado = String(data?.estado || "").toLowerCase();
        if (
          user?.role === "empleado" &&
          (estado === "aceptada" || estado === "rechazada")
        ) {
          const id = ++avisoId.current;
          setAvisos((prev) => [
            ...prev.slice(-3),
            { id, aceptada: estado === "aceptada", texto: textoAviso(data, estado === "aceptada") },
          ]);
          setTimeout(() => cerrarAviso(id), 8000);
        }
      } catch {
        /* sin aviso */
      }

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

    socket.on(
      "factura_progreso",
      (data: { porcentaje: number; texto: string }) => {
        console.log("🔥 PROGRESO FACTURA APP:", data);
        setFacturaProgress(data);
      }
    );

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("SOLICITUD_RESUELTA");
      socket.off("FORCE_LOGOUT");
      socket.off("factura_progreso");
    };
  }, [navigate]);

  return (
    <>
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {avisos.map((a) => (
        <div
          key={a.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-lg ${
            a.aceptada ? "border-emerald-200" : "border-rose-200"
          }`}
        >
          {a.aceptada ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          )}
          <p className="flex-1 text-sm font-medium text-slate-700">{a.texto}</p>
          <button
            type="button"
            onClick={() => cerrarAviso(a.id)}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
    <AgendaBoton />
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

      {/* ================= CRM (CON LAYOUT + OUTLET) ================= */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* DASHBOARD */}
        <Route
          path="/crm/dashboard"
          element={
            <ProtectedRoute adminOnly>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* VENTAS */}
        <Route
          path="/crm/libro-ventas"
          element={<LibroVentas />}
        />

        <Route
          path="/crm/nueva-venta"
          element={<NuevaVenta />}
        />

        {/* 📌 AGENDA (empleado y admin, solo escritorio) */}
        <Route
          path="/crm/agenda"
          element={<Agenda />}
        />

        {/* HORARIO */}
        <Route
          path="/crm/horario"
          element={
            <ProtectedRoute adminOnly>
              <HorarioCRM />
            </ProtectedRoute>
          }
        />

        {/* USUARIOS */}
        <Route
          path="/crm/usuarios"
          element={
            <ProtectedRoute adminOnly>
              <CrearUsuario />
            </ProtectedRoute>
          }
        />

        {/* EXCEL COMISIONES */}
        <Route
          path="/crm/excel-comisiones"
          element={
            <ProtectedRoute adminOnly>
              <ExcelComisiones
                facturaProgress={facturaProgress}
              />
            </ProtectedRoute>
          }
        />

        {/* 🎁 SORTEOS */}
        <Route
          path="/crm/sorteos"
          element={
            
              <Sorteos />
           
          }
        />
      </Route>

      {/* ================= DEFAULT ================= */}
      <Route
        path="*"
        element={
          <Navigate
            to="/laboral/control-horario"
            replace
          />
        }
      />
    </Routes>
    </>
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