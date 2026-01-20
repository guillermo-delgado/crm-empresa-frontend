import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const user = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    const parsedUser = user ? JSON.parse(user) : null;

    socket = io(import.meta.env.VITE_API_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: {
        userId: parsedUser?.id, // legacy / compatibilidad
        token,                  // 🔑 CLAVE: necesario para backend
      },
    });
  }

  return socket;
};

export const resetSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
