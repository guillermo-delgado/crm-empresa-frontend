import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  const user = localStorage.getItem("user");
  const token = localStorage.getItem("token");
  const parsedUser = user ? JSON.parse(user) : null;

  if (!parsedUser || !token) {
    return null;
  }

  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: {
        userId: parsedUser.id,
        token,
      },
    });

    // 🔍 DEBUG TEMPORAL (NO MOLESTA)
    socket.on("connect", () => {
      console.log("🟢 SOCKET CONECTADO", socket?.id, parsedUser.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔴 SOCKET DESCONECTADO", reason);
    });
  } else {
    // 🔥 CLAVE ABSOLUTA: reinyectar auth SIEMPRE
    socket.auth = {
      userId: parsedUser.id,
      token,
    };

    // 🔥 y reconectar si estaba zombie
    if (!socket.connected) {
      socket.connect();
    }
  }

  return socket;
};

export const resetSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
