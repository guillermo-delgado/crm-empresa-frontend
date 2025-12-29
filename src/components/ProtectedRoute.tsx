import { Navigate } from "react-router-dom";

type Props = {
  children: React.ReactNode;
  adminOnly?: boolean;
};

export default function ProtectedRoute({ children, adminOnly = false }: Props) {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly) {
    const parsedUser = JSON.parse(user);

    if (parsedUser.role !== "admin") {
      return <Navigate to="/crm/libro-ventas" replace />;
    }
  }

  return <>{children}</>;
}
