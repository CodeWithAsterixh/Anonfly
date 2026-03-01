import axios from "axios";
import WebSocket from "ws";
import { EventSource } from "eventsource";

const API_BASE = "http://localhost:5001/api/v1";
const WS_URL = "ws://localhost:5001";
const API_KEY = "test-api-key-123";

async function test() {
    console.log("--- Phase 3 Verification ---");

    try {
        // 1. Check REST /chatrooms
        console.log("Testing GET /chatrooms...");
        const roomsRes = await axios.get(`${API_BASE}/chatrooms`, {
            headers: { "Authorization": `ApiKey ${API_KEY}` }
        });
        console.log("REST Rooms count:", roomsRes.data.length);

        // 2. Test SSE /chatrooms
        console.log("Testing SSE /chatrooms...");
        const es = new EventSource(`${API_BASE}/chatrooms`, {
            headers: { "Authorization": `ApiKey ${API_KEY}` }
        } as any);

        const ssePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                es.close();
                reject(new Error("SSE Room List timeout"));
            }, 5000);

            es.onmessage = (event: any) => {
                const data = JSON.parse(event.data);
                console.log("SSE Room List received:", data.length, "rooms");
                clearTimeout(timeout);
                es.close();
                resolve(data);
            };
            es.onerror = (err: any) => {
                es.close();
                reject(err);
            };
        });

        await ssePromise;

        // 3. Test WebSocket Protocol Expansion
        console.log("Testing WebSocket (Edit, Reaction)...");
        // We need a session first
        // Simple handshake skip for test or use existing logic
        // Let's create a room and join
        const roomRes = await axios.post(`${API_BASE}/chatrooms`, {
            roomName: `Test Room Phase 3 - ${Date.now()}`,
            hostAid: "test-host"
        }, { headers: { "Authorization": `ApiKey ${API_KEY}` } });

        const chatroomId = roomRes.data.id;
        console.log("Created room:", chatroomId);

        const ws = new WebSocket(WS_URL);

        const wsTestPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error("WebSocket timeout"));
            }, 10000);

            ws.on("open", () => {
                console.log("WS Opened");
                ws.send(JSON.stringify({
                    type: "joinChatroom",
                    chatroomId: chatroomId,
                    userAid: "test-host",
                    username: "Tester"
                }));
            });

            let messageId: string;

            ws.on("message", (data) => {
                const msg = JSON.parse(data.toString());
                console.log("WS Received:", msg.type);

                if (msg.type === "joined") {
                    console.log("Joined room. Sending message...");
                    ws.send(JSON.stringify({
                        type: "message",
                        chatroomId: chatroomId,
                        userAid: "test-host",
                        username: "Tester",
                        content: "Hello Phase 3"
                    }));
                } else if (msg.type === "message" && msg.content === "Hello Phase 3") {
                    messageId = msg.id;
                    console.log("Message received. ID:", messageId, ". Sending edit...");
                    ws.send(JSON.stringify({
                        type: "editMessage",
                        messageId: messageId,
                        content: "Hello Phase 3 (Edited)"
                    }));
                } else if (msg.type === "editMessage") {
                    console.log("Edit confirmed:", msg.content);
                    console.log("Sending reaction...");
                    ws.send(JSON.stringify({
                        type: "reaction",
                        messageId: messageId,
                        userAid: "test-host",
                        emojiId: "heart",
                        emojiValue: "❤️",
                        emojiType: "unicode"
                    }));
                } else if (msg.type === "reaction") {
                    console.log("Reaction confirmed:", msg.emojiValue);
                    ws.close();
                    resolve(true);
                }
            });

            ws.onerror = (err) => reject(err);
        });

        await wsTestPromise;
        console.log("--- All Phase 3 Tests Passed! ---");

    } catch (error: any) {
        console.error("Test failed:", error);
        if (error.response) console.error("Response:", error.response.data);
    }
}

test();
