"use client";

import { io, Socket } from "socket.io-client";
import { getToken } from "./auth";
import { API_URL } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  socket = io(API_URL, {
    transports: ["websocket"],
    autoConnect: true,
    auth: { token: getToken() ?? "" },
  });

  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}
