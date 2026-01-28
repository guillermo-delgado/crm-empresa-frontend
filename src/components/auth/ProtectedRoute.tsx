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
     👑 ADMIN → NUNCA PASA POR LÓGICA LABORAL
  ====================================================== */
  if (parsedUser.role === "admin") {
    // Si intenta entrar en laboral, lo mandamos al CRM
    if (location.pathname.startsWith("/laboral")) {
      return (
        <Navigate
          to="/crm/libro-ventas"
          replace
        />
      );
    }

    // Rutas solo admin
    if (adminOnly && parsedUser.role !== "admin") {
      return (
        <Navigate
          to="/crm/libro-ventas"
          replace
        />
      );
    }

    return <>{children}</>;
  }

  /* ======================================================
     👤 EMPLEADO → COMPROBAR JORNADA REAL (BACKEND)
  ====================================================== */
  useEffect(() => {
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
  }, []);

 if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-32 h-[2px] bg-slate-300 rounded animate-pulse" />
    </div>
  );
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
