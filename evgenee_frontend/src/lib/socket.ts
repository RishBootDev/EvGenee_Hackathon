import { io, Socket } from "socket.io-client";
import { API_BASE_URL, tokenStore } from "./api";

let socketUrl = "http://localhost:5000";
try {
  const url = new URL(API_BASE_URL);
  socketUrl = url.origin;
} catch (e) {
  // keep default
}

// Single socket instance — we reuse it and update auth on reconnect
// Note: withCredentials is intentionally omitted; we authenticate via token in auth{}
export const socket: Socket = io(socketUrl, {
  autoConnect: false,
  auth: { token: tokenStore.get() ?? "" },
});

/** Update the socket's JWT and reconnect.
 *  Mutates auth on the existing instance so all registered listeners stay valid. */
export function reconnectSocket() {
  socket.auth = { token: tokenStore.get() ?? "" };
  if (socket.connected) {
    socket.disconnect();
  }
}
