if (location.pathname.replace(/\/$/, "") === "/room") void import("./room-client.ts");
else void import("./main.ts");
