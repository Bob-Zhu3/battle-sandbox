import type { MatchMode } from "./battlefield.ts";

export const isMatchId = (value: string) => /^[a-f0-9]{20}$/.test(value);

export function newMatchId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(16).padStart(2,"0")).join("");
}

export function matchLink(origin: string, mode: MatchMode, id: string | null) {
  const url = new URL(mode === "duel" ? "/room" : "/ffa",origin);
  if (id !== null) url.searchParams.set("match",id);
  return url;
}
