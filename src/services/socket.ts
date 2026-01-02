import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL, {
      withCredentials: true,
    });
  }
  return socket;
};
