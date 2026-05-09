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

    console.log(
      "🔌 SOCKET URL:",
      import.meta.env.VITE_API_URL
    );

    socket = io(import.meta.env.VITE_API_URL, {
      withCredentials: true,
      path: "/socket.io",

      // 🔥 SOLO POLLING TEMPORALMENTE
      transports: ["polling"],

      auth: {
        userId: parsedUser.id,
        token,
      },
    });

    // 🔍 DEBUG
    socket.on("connect", () => {
      console.log(
        "🟢 SOCKET CONECTADO",
        socket?.id,
        parsedUser.id
      );
    });

    socket.on("connect_error", (error) => {
      console.error(
        "🔴 SOCKET CONNECT ERROR:",
        error.message
      );
    });

    socket.on("disconnect", (reason) => {
      console.log(
        "🔴 SOCKET DESCONECTADO",
        reason
      );
    });

  } else {

    // 🔥 REINYECTAR AUTH
    socket.auth = {
      userId: parsedUser.id,
      token,
    };

    // 🔥 RECONECTAR SI ESTÁ CAÍDO
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