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
  const rawUser = localStorage.getItem("user");
  const location = useLocation();

  let parsedUser: any = null;
  try {
    parsedUser = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    parsedUser = null;
  }

  const esAdmin = parsedUser?.role === "admin";
  const esEmpleado = parsedUser?.role === "empleado";
  const esCrm = location.pathname.startsWith("/crm");
  const isMobile = isMobileDevice();

  /* ======================================================
     ⏱ JORNADA REAL (BACKEND) — SOLO EMPLEADOS DENTRO DEL CRM

     Se comprueba CADA VEZ que el empleado entra en el CRM
     (antes se comprobaba una sola vez al montar y se quedaba
     con el resultado antiguo: si cargaba la página fuera de
     jornada y luego fichaba, el CRM seguía bloqueado).

     Los hooks van ANTES de cualquier return (reglas de React).
  ====================================================== */
  const [chequeo, setChequeo] = useState<{ enJornada: boolean } | null>(null);

  useEffect(() => {
    // Fuera del CRM no hace falta comprobar nada; se limpia para
    // forzar una comprobación nueva la próxima vez que entre.
    if (!token || !esEmpleado || !esCrm) {
      setChequeo(null);
      return;
    }

    let vivo = true;

    api
      .get("/horario/hoy")
      .then((res) => {
        if (!vivo) return;

        const dentro = res.data?.estado === "DENTRO";

        // El backend manda: si está dentro de jornada, cualquier marca de
        // "jornada cerrada" que quedara en el navegador está caducada.
        if (dentro) localStorage.removeItem("jornada_cerrada");

        setChequeo({ enJornada: dentro });
      })
      .catch(() => {
        if (vivo) setChequeo({ enJornada: false });
      });

    return () => {
      vivo = false;
    };
  }, [token, esEmpleado, esCrm]);

  /* ======================================================
     🔐 NO AUTENTICADO
  ====================================================== */
  if (!token || !rawUser || !parsedUser) {
    if (rawUser && !parsedUser) localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  /* ======================================================
     👑 ADMIN → NUNCA PASA POR LÓGICA LABORAL
  ====================================================== */
  if (esAdmin) {
    // Si intenta entrar en laboral, lo mandamos al CRM
    if (location.pathname.startsWith("/laboral")) {
      return <Navigate to="/crm/libro-ventas" replace />;
    }

    return <>{children}</>;
  }

  /* ======================================================
     👤 EMPLEADO → CORTAFUEGOS CRM
     - MÓVIL / TABLET → SIEMPRE BLOQUEADO
     - FUERA DE JORNADA (o en pausa) → BLOQUEADO
  ====================================================== */
  if (esEmpleado && esCrm) {
    if (isMobile) {
      return <Navigate to="/laboral/control-horario" replace />;
    }

    // Comprobando la jornada en el backend
    if (chequeo === null) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-32 h-[2px] bg-slate-300 rounded animate-pulse" />
        </div>
      );
    }

    if (!chequeo.enJornada) {
      return <Navigate to="/laboral/control-horario" replace />;
    }
  }

  /* ======================================================
     🔐 RUTAS SOLO ADMIN
  ====================================================== */
  if (adminOnly && !esAdmin) {
    return <Navigate to="/laboral/control-horario" replace />;
  }

  return <>{children}</>;
}