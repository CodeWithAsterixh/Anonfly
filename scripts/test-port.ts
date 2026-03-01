import * as net from "net";

const host = "db.llqtydunkbdjlqangevn.supabase.co";
const port = 6543;

const socket = new net.Socket();
socket.setTimeout(5000);

console.log(`Testing TCP connection to ${host}:${port}...`);

socket.connect(port, host, () => {
    console.log(`SUCCESS: Connected to ${host}:${port}`);
    socket.destroy();
    process.exit(0);
});

socket.on("timeout", () => {
    console.error(`TIMEOUT: Could not connect to ${host}:${port} within 5s`);
    socket.destroy();
    process.exit(1);
});

socket.on("error", (err) => {
    console.error(`ERROR: ${err.message}`);
    socket.destroy();
    process.exit(1);
});
