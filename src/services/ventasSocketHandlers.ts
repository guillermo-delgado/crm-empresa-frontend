import { Socket } from "socket.io-client";

type HandlersParams = {
  socket: Socket;
  isAdmin: boolean;
  setVentas: React.Dispatch<React.SetStateAction<any[]>>;
  setRevisionCount: React.Dispatch<React.SetStateAction<number>>;
  cargarSolicitudes: () => void;
};

export function registerVentasSocketHandlers({
  socket,
  isAdmin,
  setVentas,
  setRevisionCount,
  cargarSolicitudes,
}: HandlersParams) {
  /* =========================
     VENTA ACTUALIZADA
  ========================= */
  const onVentaActualizada = (venta: any) => {
    if (!venta?._id) return;

    setVentas(prev =>
      prev.map(v =>
        v._id === venta._id
          ? { ...v, ...venta }
          : v
      )
    );
  };

  /* =========================
     VENTA ELIMINADA
  ========================= */
  const onVentaEliminada = ({ ventaId }: any) => {
    if (!ventaId) return;

    setVentas(prev =>
      prev.filter(v => v._id !== ventaId)
    );
  };

  /* =========================
     SOLICITUD CREADA
     (SIEMPRE actualizar ventas)
  ========================= */
  const onSolicitudCreada = ({ ventaId }: any) => {
    if (!ventaId) return;

    // 🔥 ACTUALIZAR TABLA SIEMPRE
    setVentas(prev =>
      prev.map(v =>
        v._id === ventaId
          ? { ...v, estadoRevision: "pendiente" }
          : v
      )
    );

    // 🔔 ADMIN → refrescar contador/modal
    if (isAdmin) {
      cargarSolicitudes();
    }
  };

  /* =========================
     SOLICITUD RESUELTA
     (aceptada / rechazada)
  ========================= */
  const onSolicitudResuelta = ({ ventaId, estado }: any) => {
    if (!ventaId || !estado) return;

    // 🔥 ACTUALIZAR TABLA SIEMPRE
    setVentas(prev =>
      prev.map(v =>
        v._id === ventaId
          ? { ...v, estadoRevision: estado }
          : v
      )
    );

    // 🔔 ADMIN → refrescar solicitudes
    if (isAdmin) {
      cargarSolicitudes();
    } else {
      // empleado: marcar que hay cambio
      setRevisionCount(prev => prev + 1);
    }
  };

  /* =========================
     REGISTRO SOCKETS
  ========================= */
  socket.on("VENTA_ACTUALIZADA", onVentaActualizada);
  socket.on("VENTA_ELIMINADA", onVentaEliminada);
  socket.on("SOLICITUD_CREADA", onSolicitudCreada);
  socket.on("SOLICITUD_RESUELTA", onSolicitudResuelta);

  /* =========================
     CLEANUP
  ========================= */
  return () => {
    socket.off("VENTA_ACTUALIZADA", onVentaActualizada);
    socket.off("VENTA_ELIMINADA", onVentaEliminada);
    socket.off("SOLICITUD_CREADA", onSolicitudCreada);
    socket.off("SOLICITUD_RESUELTA", onSolicitudResuelta);
  };
}
