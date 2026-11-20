const path = location.pathname.replace(/\/$/, "");
if (path === "/room" || path === "/ffa") void import("./room-client.ts");
else void import("./main.ts");
