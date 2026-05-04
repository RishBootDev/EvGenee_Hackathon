import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

let socketUrl = "http://localhost:5000";
try {
  const url = new URL(API_BASE_URL);
  socketUrl = url.origin;
} catch (e) {
  
}

export const socket: Socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
});
