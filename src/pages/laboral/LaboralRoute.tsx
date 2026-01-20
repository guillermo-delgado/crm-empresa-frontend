import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function LaboralRoute({ children }: Props) {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  try {
    const parsedUser = JSON.parse(user);

    // ❌ Admin no entra en laboral
    if (parsedUser.role === "admin") {
      return <Navigate to="/crm/libro-ventas" replace />;
    }

    return <>{children}</>;
  } catch {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }
}
