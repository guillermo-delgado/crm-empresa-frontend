import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LibroVentas from "./pages/LibroVentas";
import NuevaVenta from "./pages/ventas/NuevaVenta";
import Login from "./pages/Login";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/crm/libro-ventas" element={<LibroVentas />} />
        <Route path="/crm/nueva-venta" element={<NuevaVenta />} />
        <Route path="*" element={<Navigate to="/crm/libro-ventas" />} />
      </Routes>
    </BrowserRouter>
  );
}
