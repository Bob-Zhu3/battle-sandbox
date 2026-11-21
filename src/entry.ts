import { newMatchId } from "./match-link.ts";

const path = location.pathname.replace(/\/$/, "");
if (path === "/room" || path === "/ffa") {
  const url = new URL(location.href);
  if (url.searchParams.has("new") && !url.searchParams.has("match")) {
    url.searchParams.delete("new");
    url.searchParams.set("match",newMatchId());
    history.replaceState(null,"",url);
  }
  void import("./room-client.ts");
} else void import("./main.ts");
