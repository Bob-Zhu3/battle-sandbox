import type { MatchMode } from "./battlefield.ts";

export const isMatchId = (value: string) => /^[a-f0-9]{20}$/.test(value);

export function newMatchId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(16).padStart(2,"0")).join("");
}

export function matchMode(pathname: string): MatchMode | undefined {
  const route = pathname.replace(/\/(?:index\.html)?$/, "").split("/").pop();
  if (route === "room") return "duel";
  if (route === "ffa") return "ffa";
}

export function matchLink(address: string) {
  const url = new URL(address);
  const id = url.searchParams.get("match");
  url.search = "";
  url.hash = "";
  if (id !== null) url.searchParams.set("match",id);
  return url;
}
