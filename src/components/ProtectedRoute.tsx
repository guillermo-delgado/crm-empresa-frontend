import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

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

  // 🔒 No autenticado
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // 🔐 Solo admin
  if (adminOnly) {
    try {
      const parsedUser = JSON.parse(user);

      if (parsedUser.role !== "admin") {
        return <Navigate to="/crm/libro-ventas" replace />;
      }
    } catch {
      // user corrupto → logout forzado
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}
