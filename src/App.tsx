import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LibroVentas from "./pages/LibroVentas";
import NuevaVenta from "./pages/ventas/NuevaVenta";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
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

        {/* DEFAULT */}
        <Route path="*" element={<Navigate to="/crm/libro-ventas" />} />
      </Routes>
    </BrowserRouter>
  );
}
