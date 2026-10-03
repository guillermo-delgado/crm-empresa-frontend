import { Socket } from "socket.io-client";

type HandlersParams = {
  socket: Socket;
  isAdmin: boolean;
  setVentas: React.Dispatch<React.SetStateAction<any[]>>;
  setRevisionCount: React.Dispatch<React.SetStateAction<number>>;
  cargarSolicitudes: () => void;
  /**
   * Recarga el libro en segundo plano (ventas del periodo, producción semanal
   * y búsqueda activa). Se usa cuando el evento no se puede aplicar a mano:
   * venta nueva, o venta editada que todavía no estaba en la lista.
   */
  refrescar?: () => void;
};

export function registerVentasSocketHandlers({
  socket,
  isAdmin,
  setVentas,
  setRevisionCount,
  cargarSolicitudes,
  refrescar,
}: HandlersParams) {
  /* =====================================================
     🆕 VENTA CREADA
     Una venta nueva puede o no pertenecer al periodo/filtros
     que está viendo cada usuario, así que se deja que el
     backend decida recargando el libro.
  ===================================================== */
  const onVentaCreada = () => {
    refrescar?.();
  };

  /* =====================================================
     VENTA ACTUALIZADA (edición / cambios generales)
  ===================================================== */
  const onVentaActualizada = (venta: any) => {
    if (!venta?._id) return;

    // Si el payload trae createdBy como id (sin popular), no se pisa el
    // objeto { _id, nombre } que ya tiene la fila.
    const { createdBy, ...resto } = venta;
    const parche =
      createdBy && typeof createdBy === "object" ? venta : resto;

    // Cambio inmediato en pantalla...
    setVentas((prev) =>
      prev.map((v) => (v._id === venta._id ? { ...v, ...parche } : v))
    );

    // ...y recarga en segundo plano (con debounce) por si la edición ha movido
    // la venta dentro o fuera del periodo/filtros que se están viendo.
    refrescar?.();
  };

  /* =====================================================
     VENTA ELIMINADA
  ===================================================== */
  const onVentaEliminada = ({ ventaId }: any) => {
    if (!ventaId) return;

    setVentas((prev) => prev.filter((v) => v._id !== ventaId));
    refrescar?.(); // producción semanal y actividad diaria
  };

  /* =====================================================
     🔴 VENTA ANULADA (estado REAL)
  ===================================================== */
  const onVentaAnulada = ({ ventaId }: any) => {
    if (!ventaId) return;

    setVentas((prev) =>
      prev.map((v) =>
        v._id === ventaId
          ? { ...v, estado: "ANULADA", anulada: true, estadoRevision: null }
          : v
      )
    );
    refrescar?.();
  };

  /* =====================================================
     🟢 VENTA REHABILITADA (estado REAL)
  ===================================================== */
  const onVentaRehabilitada = ({ ventaId }: any) => {
    if (!ventaId) return;

    setVentas((prev) =>
      prev.map((v) =>
        v._id === ventaId
          ? { ...v, estado: undefined, anulada: false, estadoRevision: null }
          : v
      )
    );
    refrescar?.();
  };

  /* =====================================================
     🟡 SOLICITUD CREADA (EDITAR / ANULAR / ELIMINAR)
  ===================================================== */
  const onSolicitudCreada = ({ ventaId }: any) => {
    if (!ventaId) return;

    setVentas((prev) =>
      prev.map((v) =>
        v._id === ventaId ? { ...v, estadoRevision: "pendiente" } : v
      )
    );

    if (isAdmin) {
      cargarSolicitudes();
    }
  };

  /* =====================================================
     🟢 SOLICITUD RESUELTA (aceptada / rechazada)
  ===================================================== */
  const onSolicitudResuelta = ({ ventaId, estado }: any) => {
    if (!ventaId || !estado) return;

    setVentas((prev) =>
      prev.map((v) =>
        v._id === ventaId ? { ...v, estadoRevision: estado } : v
      )
    );

    if (isAdmin) {
      cargarSolicitudes();
    } else if (estado === "aceptada" || estado === "rechazada") {
      // 🔔 El aviso solo debe llegar al empleado afectado
      // (el backend emite SOLICITUD_RESUELTA a su sala).
      setRevisionCount((prev) => prev + 1);
    }
  };

  /* =====================================================
     🔄 RECONEXIÓN
     Los eventos emitidos mientras el socket estaba caído
     se pierden; al volver se recarga el libro.
  ===================================================== */
  const onReconectado = () => {
    refrescar?.();
    if (isAdmin) cargarSolicitudes();
  };

  /* =====================================================
     REGISTRO SOCKETS
  ===================================================== */
  socket.on("VENTA_CREADA", onVentaCreada);
  socket.on("VENTA_ACTUALIZADA", onVentaActualizada);
  socket.on("VENTA_ELIMINADA", onVentaEliminada);
  socket.on("VENTA_ANULADA", onVentaAnulada);
  socket.on("VENTA_REHABILITADA", onVentaRehabilitada);
  socket.on("SOLICITUD_CREADA", onSolicitudCreada);
  socket.on("SOLICITUD_RESUELTA", onSolicitudResuelta);
  socket.io.on("reconnect", onReconectado);

  /* =====================================================
     CLEANUP
  ===================================================== */
  return () => {
    socket.off("VENTA_CREADA", onVentaCreada);
    socket.off("VENTA_ACTUALIZADA", onVentaActualizada);
    socket.off("VENTA_ELIMINADA", onVentaEliminada);
    socket.off("VENTA_ANULADA", onVentaAnulada);
    socket.off("VENTA_REHABILITADA", onVentaRehabilitada);
    socket.off("SOLICITUD_CREADA", onSolicitudCreada);
    socket.off("SOLICITUD_RESUELTA", onSolicitudResuelta);
    socket.io.off("reconnect", onReconectado);
  };
}