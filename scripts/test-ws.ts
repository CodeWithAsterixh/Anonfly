import WebSocket from "ws";
import axios from "axios";

const API_URL = "http://127.0.0.1:5001/api/v1";
const WS_URL = "ws://127.0.0.1:5001";
const ROOM_NAME = "ws-test-room-" + Date.now();
const USER_AID = "test-user-aid-ws";
const USERNAME = "WS Tester";
const API_KEY = "test-api-key-123";

async function testWebSocket() {
    console.log("--- Testing WebSocket ---");

    try {
        // 0. Create Room first
        console.log("Creating room via REST API...");
        const roomRes = await axios.post(`${API_URL}/rooms`, {
            roomName: ROOM_NAME,
            hostAid: USER_AID,
            username: USERNAME,
            region: "TEST"
        }, {
            headers: {
                "Authorization": `ApiKey ${API_KEY}`
            }
        });
        const chatroomId = roomRes.data.id;
        console.log(`Room created with ID: ${chatroomId}`);

        const ws = new WebSocket(WS_URL);

        ws.on("open", () => {
            console.log("Connected to WS");

            // 1. Join Room
            console.log("Sending joinChatroom...");
            ws.send(JSON.stringify({
                type: "joinChatroom",
                chatroomId: chatroomId,
                userAid: USER_AID,
                username: USERNAME
            }));
        });

        ws.on("message", (data) => {
            const message = JSON.parse(data.toString());
            console.log("Received:", message);

            if (message.type === "joined") {
                console.log("Successfully joined room");

                // 2. Send Message
                console.log("Sending chat message...");
                ws.send(JSON.stringify({
                    type: "message",
                    chatroomId: chatroomId,
                    userAid: USER_AID,
                    username: USERNAME,
                    content: "Hello from WebSocket test!"
                }));
            }

            if (message.type === "message" && message.content === "Hello from WebSocket test!") {
                console.log("Message broadcast received successfully!");
                ws.close();
                process.exit(0);
            }
        });

        ws.on("error", (err) => {
            console.error("WS error:", err);
            process.exit(1);
        });

    } catch (error: any) {
        console.error("Test failed:", error.response?.data || error.message);
        process.exit(1);
    }

    // Timeout
    setTimeout(() => {
        console.error("Test timed out!");
        process.exit(1);
    }, 15000);
}

testWebSocket();
