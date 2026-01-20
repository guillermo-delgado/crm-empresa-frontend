import api from "./api";

export const getHistorialEmpleado = (
  userId: string | null,
  mes: string
) =>
  api.get("/crm/horario/historial", {
    params: { userId, mes },
  });

export const editarFichaje = (
  registroId: string,
  fichajeId: string,
  hora: string
) =>
  api.put(
    `/crm/horario/${registroId}/fichaje/${fichajeId}`,
    { hora }
  );

export const eliminarFichaje = (
  registroId: string,
  fichajeId: string
) =>
  api.delete(
    `/crm/horario/${registroId}/fichaje/${fichajeId}`
  );
