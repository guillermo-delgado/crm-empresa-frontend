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

  /* =====================================================
     VENTA ACTUALIZADA (edición / cambios generales)
  ===================================================== */
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

  /* =====================================================
     VENTA ELIMINADA
  ===================================================== */
  const onVentaEliminada = ({ ventaId }: any) => {
    if (!ventaId) return;

    setVentas(prev =>
      prev.filter(v => v._id !== ventaId)
    );
  };

  /* =====================================================
     🔴 VENTA ANULADA (estado REAL)
  ===================================================== */
  const onVentaAnulada = ({ ventaId }: any) => {
    if (!ventaId) return;

    setVentas(prev =>
      prev.map(v =>
        v._id === ventaId
          ? { ...v, estado: "ANULADA", estadoRevision: null }
          : v
      )
    );
  };

  /* =====================================================
     🟢 VENTA REHABILITADA (estado REAL)
  ===================================================== */
  const onVentaRehabilitada = ({ ventaId }: any) => {
    if (!ventaId) return;

    setVentas(prev =>
      prev.map(v =>
        v._id === ventaId
          ? { ...v, estado: undefined, estadoRevision: null }
          : v
      )
    );
  };

  /* =====================================================
     🟡 SOLICITUD CREADA (EDITAR / ANULAR / ELIMINAR)
     👉 AQUÍ ESTABA EL BUG DEL BADGE
  ===================================================== */

// ❌ NO TOCAR EL BADGE AQUÍ
const onSolicitudCreada = ({ ventaId }: any) => {
  if (!ventaId) return;

  setVentas(prev =>
    prev.map(v =>
      v._id === ventaId
        ? { ...v, estadoRevision: "pendiente" }
        : v
    )
  );

  if (isAdmin) {
    cargarSolicitudes();
  }
};




  /* =====================================================
     🟢 SOLICITUD RESUELTA (aceptada / rechazada)
  ===================================================== */
// SOLICITUD RESUELTA
const onSolicitudResuelta = ({ ventaId, estado }: any) => {
  if (!ventaId || !estado) return;

  setVentas(prev =>
    prev.map(v =>
      v._id === ventaId
        ? { ...v, estadoRevision: estado }
        : v
    )
  );

  if (isAdmin) {
    cargarSolicitudes();
  } else {
    // 🔔 SOLO AQUÍ
    if (estado === "aceptada" || estado === "rechazada") {
      setRevisionCount(prev => prev + 1);
    }
  }
};


  /* =====================================================
     REGISTRO SOCKETS
  ===================================================== */
  socket.on("VENTA_ACTUALIZADA", onVentaActualizada);
  socket.on("VENTA_ELIMINADA", onVentaEliminada);
  socket.on("VENTA_ANULADA", onVentaAnulada);
  socket.on("VENTA_REHABILITADA", onVentaRehabilitada);
  socket.on("SOLICITUD_CREADA", onSolicitudCreada);
  socket.on("SOLICITUD_RESUELTA", onSolicitudResuelta);

  /* =====================================================
     CLEANUP
  ===================================================== */
  return () => {
    socket.off("VENTA_ACTUALIZADA", onVentaActualizada);
    socket.off("VENTA_ELIMINADA", onVentaEliminada);
    socket.off("VENTA_ANULADA", onVentaAnulada);
    socket.off("VENTA_REHABILITADA", onVentaRehabilitada);
    socket.off("SOLICITUD_CREADA", onSolicitudCreada);
    socket.off("SOLICITUD_RESUELTA", onSolicitudResuelta);
  };
}
