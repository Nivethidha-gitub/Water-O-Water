/*
 * Minimal better-sqlite3 compatible wrapper around the built-in node:sqlite
 * module (Node >= 22.5). It is only used when the native better-sqlite3
 * package cannot be loaded (for example when node-gyp cannot build it).
 */
const { DatabaseSync } = require("node:sqlite");

function createSqliteAdapter(file) {
  const raw = new DatabaseSync(file);

  const api = {
    raw,
    exec(sql) {
      raw.exec(sql);
    },
    pragma(text) {
      const rows = raw.prepare("PRAGMA " + text).all();
      return rows;
    },
    prepare(sql) {
      const stmt = raw.prepare(sql);
      return {
        get: (...args) => stmt.get(...args),
        all: (...args) => stmt.all(...args),
        run: (...args) => stmt.run(...args),
      };
    },
    transaction(fn) {
      return (...args) => {
        raw.exec("BEGIN");
        try {
          const result = fn(...args);
          raw.exec("COMMIT");
          return result;
        } catch (err) {
          raw.exec("ROLLBACK");
          throw err;
        }
      };
    },
    close() {
      raw.close();
    },
  };

  return api;
}

module.exports = { createSqliteAdapter };
