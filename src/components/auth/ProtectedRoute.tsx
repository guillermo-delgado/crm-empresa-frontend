import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import api from "../../services/api";

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

  /* ======================================================
     🔒 BLOQUEO FRONTEND POR FIN DE JORNADA (SOCKET)
  ====================================================== */
  const jornadaCerrada =
    localStorage.getItem("jornada_cerrada") === "1";

  // 🔒 No autenticado
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
     👑 ADMIN → acceso total
  ====================================================== */
  useEffect(() => {
    if (parsedUser.role === "admin") {
      setEnJornada(true);
      setLoading(false);
      return;
    }

    /* ======================================================
       👤 EMPLEADO → comprobar jornada real (backend)
    ====================================================== */
    const checkHorario = async () => {
      try {
        const res = await api.get("/horario/hoy");

        if (res.data?.estado === "DENTRO") {
          setEnJornada(true);
        } else {
          setEnJornada(false);
        }
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
     🚫 BLOQUEO CRM (DOBLE GARANTÍA)
     - jornada cerrada por socket (instantáneo)
     - o jornada fuera según backend
  ====================================================== */
  if (
    parsedUser.role === "empleado" &&
    (jornadaCerrada || !enJornada) &&
    location.pathname.startsWith("/crm")
  ) {
    return <Navigate to="/laboral/control-horario" replace />;
  }

  /* ======================================================
     🔐 Rutas solo admin
  ====================================================== */
  if (adminOnly && parsedUser.role !== "admin") {
    return <Navigate to="/laboral/control-horario" replace />;
  }

  return <>{children}</>;
}
