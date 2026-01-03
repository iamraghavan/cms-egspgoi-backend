const { io } = require("socket.io-client");

const URL = "http://localhost:3000";
const socket = io(URL, {
    auth: {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci1pZCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGVfaWQiOiJ0ZXN0LXJvbGUtaWQiLCJpYXQiOjE3Njc0MTU4NjgsImV4cCI6MTc2NzQxNjc2OH0.jALv47Bgq9mDF3f0qsqbJFk3xUdtXP3v0HYGhIKQTrQ" // Needs a valid token to work
    }
});

socket.on("connect", () => {
    console.log("Connected to server:", socket.id);
});

socket.on("disconnect", () => {
    console.log("Disconnected from server");
});

socket.on("lead_assigned", (data) => {
    console.log("[EVENT] lead_assigned:", data);
});

socket.on("call_status", (data) => {
    console.log("[EVENT] call_status:", data);
});

socket.on("connect_error", (err) => {
    console.log("Connection Error:", err.message);
});
