import { io } from "socket.io-client";
import axios from "axios";

async function testAgent() {
  console.log("1. Registering a test user to get a token...");
  const timestamp = Date.now();
  const user = {
    name: "Test User",
    email: `testuser_${timestamp}@example.com`,
    password: "Password123!",
    role: "user",
  };

  try {
    const res = await axios.post("http://localhost:5000/api/v1/users/register", user);
    const token = res.data.token;
    console.log("=> Token acquired!");

    console.log("2. Connecting to Socket.IO...");
    const socket = io("http://localhost:5000", {
      auth: { token },
    });

    socket.on("connect", () => {
      console.log("=> Socket connected!", socket.id);

      console.log("3. Sending AI Voice Chat request...");
      socket.emit("ai:voice_chat", {
        message:
          "Hi EvGenee, can you find a station for me in Bhopal tomorrow at 10:00 for CCS2? My vehicle number is MP04AB1234",
        threadId: "test-thread-123",
      });
    });

    socket.on("connect_error", (err) => {
      console.error("Socket Connection Error:", err.message);
      process.exit(1);
    });

    socket.on("ai:voice_response", (data) => {
      console.log("\n====== AI RESPONSE ======");
      console.dir(data, { depth: null, colors: true });
      console.log("=========================\n");

      socket.disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

testAgent();
