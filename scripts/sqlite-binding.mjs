// Run the match server's D1 queries against Node's SQLite in local checks.
export function sqliteBinding(database, aroundWrite) {
  return {
    prepare(sql) {
      const statement = database.prepare(sql);
      return {
        bind(...args) {
          const values = args.map(arg => arg instanceof ArrayBuffer ? new Uint8Array(arg) : arg);
          return {
            async first() { return statement.get(...values) ?? null; },
            async run() {
              const write = () => ({meta: statement.run(...values)});
              return aroundWrite ? aroundWrite(sql, write) : write();
            },
          };
        },
      };
    },
  };
}
