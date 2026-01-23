import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import api from "../../services/api";

/* ======================================================
   📱 DETECTOR DE DISPOSITIVO MÓVIL / TABLET
====================================================== */
const isMobileDevice = () => {
  if (typeof navigator === "undefined") return false;

  return /android|iphone|ipad|ipod|mobile/i.test(
    navigator.userAgent
  );
};

type Props = {
  children: ReactNode;
  adminOnly?: boolean;
};

export default function ProtectedRoute({
  children,
  adminOnly = false,
}: Props) {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [enJornada, setEnJornada] = useState<boolean>(false);

  const isMobile = isMobileDevice();

  /* ======================================================
     🔒 BLOQUEO FRONTEND POR FIN DE JORNADA (SOCKET)
  ====================================================== */
  const jornadaCerrada =
    localStorage.getItem("jornada_cerrada") === "1";

  /* ======================================================
     🔐 NO AUTENTICADO
  ====================================================== */
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  let parsedUser: any;
  try {
    parsedUser = JSON.parse(user);
  } catch {
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  /* ======================================================
     👑 ADMIN → ACCESO TOTAL
  ====================================================== */
  useEffect(() => {
    if (parsedUser.role === "admin") {
      setEnJornada(true);
      setLoading(false);
      return;
    }

    /* ======================================================
       👤 EMPLEADO → COMPROBAR JORNADA REAL (BACKEND)
    ====================================================== */
    const checkHorario = async () => {
      try {
        const res = await api.get("/horario/hoy");

        setEnJornada(res.data?.estado === "DENTRO");
      } catch {
        setEnJornada(false);
      } finally {
        setLoading(false);
      }
    };

    checkHorario();
  }, [parsedUser.role]);

  if (loading) {
    return <div className="p-6">Cargando…</div>;
  }

  /* ======================================================
     🚫 CORTAFUEGOS CRM (EMPLEADOS)
     - MÓVIL / TABLET → SIEMPRE BLOQUEADO
     - FUERA DE JORNADA → BLOQUEADO
     - CIERRE POR SOCKET → BLOQUEADO
  ====================================================== */
  if (
    parsedUser.role === "empleado" &&
    location.pathname.startsWith("/crm") &&
    (
      isMobile ||          // 📱 móvil / tablet
      jornadaCerrada ||    // 🔌 cierre forzado
      !enJornada           // ⏱ fuera de jornada
    )
  ) {
    return (
      <Navigate
        to="/laboral/control-horario"
        replace
      />
    );
  }

  /* ======================================================
     🔐 RUTAS SOLO ADMIN
  ====================================================== */
  if (adminOnly && parsedUser.role !== "admin") {
    return (
      <Navigate
        to="/laboral/control-horario"
        replace
      />
    );
  }

  return <>{children}</>;
}
