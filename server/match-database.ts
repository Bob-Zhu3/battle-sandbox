import type { MatchStore } from "./online-match.ts";

export interface Database {
  prepare(query: string): {
    bind(...values: (string|number|ArrayBuffer)[]): {
      first<T>(): Promise<T|null>;
      run(): Promise<{meta:{changes:number}}>;
    };
  };
}

export function matchDatabase(db: Database): MatchStore {
  return {
    async read(key) {
      const row = await db.prepare("SELECT version,data FROM online_rooms WHERE id=?").bind(key)
        .first<{version:number;data:string|number[]|ArrayBuffer}>();
      if (!row) return null;
      if (typeof row.data === "string") return {version:row.version,data:row.data};
      const zipped = new Response(new Uint8Array(row.data)).body!;
      return {version:row.version,data:await new Response(zipped.pipeThrough(new DecompressionStream("gzip"))).text()};
    },
    async save(key,previous,data,now) {
      const expires = now + 24*60*60*1000;
      let value: string | ArrayBuffer = data;
      if (data.length > 16_384) {
        const zipped = new Response(data).body!.pipeThrough(new CompressionStream("gzip"));
        value = await new Response(zipped).arrayBuffer();
      }
      if (previous === null) {
        await db.prepare("DELETE FROM online_rooms WHERE id IN (SELECT id FROM online_rooms WHERE expires < ? LIMIT 16)").bind(now).run();
        const insert = await db.prepare("INSERT OR IGNORE INTO online_rooms (id,version,data,expires) VALUES (?,1,?,?)").bind(key,value,expires).run();
        return insert.meta.changes === 1;
      }
      const update = await db.prepare("UPDATE online_rooms SET version=version+1,data=?,expires=? WHERE id=? AND version=?")
        .bind(value,expires,key,previous).run();
      return update.meta.changes === 1;
    },
  };
}
