/*
 * Opens the SQLite database. Uses better-sqlite3 when it is installed, and
 * falls back to Node's built-in node:sqlite (Node >= 22.5) if the native
 * module cannot be loaded.
 */
const fs = require("fs");
const path = require("path");
const config = require("../config");

const defaultPath = path.join(__dirname, "..", "..", "data", "wow-platform.db");
const dbPath = config.dbPath || defaultPath;

if (dbPath !== ":memory:") {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function open() {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    return db;
  } catch (err) {
    if (!config.quiet) {
      console.warn("better-sqlite3 unavailable (" + err.message.split("\n")[0] + "); using node:sqlite");
    }
    const { createSqliteAdapter } = require("./sqlite-adapter");
    const db = createSqliteAdapter(dbPath);
    db.pragma("journal_mode = WAL");
    return db;
  }
}

module.exports = open();
