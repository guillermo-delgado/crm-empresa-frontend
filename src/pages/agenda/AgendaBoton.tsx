import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Pin, X } from "lucide-react";
import api from "../../services/api";
import { getSocket } from "../../services/socket";
import { hoyISO } from "../../utils/fechasES";

type NotaMini = {
  _id: string;
  titulo: string;
  estado: "PENDIENTE" | "HECHA";
  dia?: string;
  impuesta: boolean;
  leidaEn?: string;
  asignadoA: { _id: string } | string;
  creadoPor: { _id: string; nombre?: string } | string;
};

const idDe = (p: { _id: string } | string | undefined): string =>
  !p ? "" : typeof p === "string" ? p : p._id;

const leerUsuario = (): any => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    return {};
  }
};

/**
 * Botón flotante de la Agenda (solo escritorio, solo dentro del CRM).
 * Sirve de acceso sin tocar el menú lateral y avisa cuando
 * el admin te manda algo, estés en la pantalla que estés.
 */
export default function AgendaBoton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [pendientes, setPendientes] = useState(0);
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null);
  const avisoId = useRef(0);

  const enCrm = pathname.startsWith("/crm");
  const enAgenda = pathname === "/crm/agenda";
  const activo = enCrm && !enAgenda;

  const contar = useCallback(async () => {
    try {
      const miId = String(leerUsuario()?._id || leerUsuario()?.id || "");
      const hoy = hoyISO();
      const res = await api.get("/agenda");
      const lista: NotaMini[] = Array.isArray(res.data) ? res.data : [];
      setPendientes(
        lista.filter(
          (n) =>
            n.estado === "PENDIENTE" &&
            idDe(n.asignadoA) === miId &&
            ((n.dia && n.dia <= hoy) || (n.impuesta && !n.leidaEn))
        ).length
      );
    } catch {
      /* sin contador */
    }
  }, []);

  /* Al entrar en otra pantalla del CRM se refresca el contador */
  useEffect(() => {
    if (activo) contar();
  }, [activo, pathname, contar]);

  /* Avisos en tiempo real, en cualquier pantalla del CRM */
  useEffect(() => {
    if (!activo) return;

    const socket = getSocket();
    if (!socket) return;

    const miId = String(leerUsuario()?._id || leerUsuario()?.id || "");

    const onAsignada = (n: NotaMini) => {
      contar();
      if (idDe(n.asignadoA) === miId && idDe(n.creadoPor) !== miId) {
        const id = ++avisoId.current;
        const quien =
          typeof n.creadoPor === "string" ? "Admin" : n.creadoPor.nombre || "Admin";
        setAviso({ id, texto: `${quien} te ha mandado: ${n.titulo}` });
        setTimeout(
          () => setAviso((a) => (a && a.id === id ? null : a)),
          9000
        );
      }
    };

    socket.on("AGENDA_ASIGNADA", onAsignada);
    socket.on("AGENDA_ACTUALIZADA", contar);
    socket.on("AGENDA_ELIMINADA", contar);

    return () => {
      socket.off("AGENDA_ASIGNADA", onAsignada);
      socket.off("AGENDA_ACTUALIZADA", contar);
      socket.off("AGENDA_ELIMINADA", contar);
    };
  }, [activo, contar]);

  if (!activo) return null;

  return (
    <div className="hidden md:block">
      {aviso && (
        <div
          role="status"
          className="fixed right-4 top-24 z-[100] flex w-full max-w-sm items-start gap-3 rounded-2xl border border-[#cfd9fb] bg-white p-4 shadow-lg"
        >
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#2f5bd3]" />
          <button
            type="button"
            onClick={() => {
              setAviso(null);
              navigate("/crm/agenda");
            }}
            className="flex-1 cursor-pointer text-left text-sm font-medium text-slate-700"
          >
            {aviso.texto}
          </button>
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/crm/agenda")}
        aria-label="Abrir agenda"
        title="Agenda"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-[#2f5bd3] text-white shadow-[0_16px_26px_-10px_#2f5bd3] transition-transform hover:scale-105"
      >
        <Pin size={22} />
        {pendientes > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {pendientes}
          </span>
        )}
      </button>
    </div>
  );
}