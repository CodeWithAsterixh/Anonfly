import axios from "axios";

const API_URL = "http://127.0.0.1:5001/api/v1";
const API_KEY = "test-api-key-123";

const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        "Authorization": `ApiKey ${API_KEY}`,
        "Content-Type": "application/json"
    }
});

async function runTests() {
    try {
        console.log("--- Testing Endpoints ---");

        // 1. List Public Rooms
        console.log("1. GET /rooms");
        const roomsRes = await axiosInstance.get("/rooms");
        console.log("Rooms found:", roomsRes.data.length);

        // 2. Create Room
        console.log("2. POST /rooms");
        const createRoomRes = await axiosInstance.post("/rooms", {
            roomName: "Test Room " + Date.now(),
            hostAid: "aid_host_123",
            username: "HostUser",
            description: "Automated test room",
            isPrivate: false
        });
        const roomId = createRoomRes.data.id;
        const roomName = createRoomRes.data.roomName;
        console.log("Room created:", roomName, "ID:", roomId);

        // 3. Join Room
        console.log("3. POST /rooms/join");
        const joinRes = await axiosInstance.post("/rooms/join", {
            roomName: roomName,
            userAid: "aid_user_456",
            username: "JoiningUser"
        });
        console.log("Joined successfully:", joinRes.data.conversationId);

        // 4. Send Message
        console.log("4. POST /rooms/:id/messages");
        const msgRes = await axiosInstance.post(`/rooms/${roomId}/messages`, {
            senderAid: "aid_user_456",
            username: "JoiningUser",
            content: "Hello from automated test!"
        });
        console.log("Message sent sequence:", msgRes.data.sequenceId);

        // 5. Get Messages
        console.log("5. GET /rooms/:id/messages");
        const msgsRes = await axiosInstance.get(`/rooms/${roomId}/messages`);
        console.log("Messages history count:", msgsRes.data.length);
        console.log("Latest message:", msgsRes.data[0].content);

        console.log("--- ALL TESTS PASSED! ---");
    } catch (error: any) {
        console.error("Test failed!");
        if (error.response) {
            console.error("Response data:", error.response.data);
            console.error("Status:", error.response.status);
        } else {
            console.error("Error message:", error.message);
        }
        process.exit(1);
    }
}

runTests();
