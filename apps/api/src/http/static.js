/*
 * Serves the built web app (apps/web/dist) so one `npm start` runs the whole
 * product. Unknown paths fall back to index.html for client-side routing.
 * Only active when the build exists.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "../../../web/dist");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

function createStaticHandler() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) return null;

  return function serve(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(DIST, path.normalize(pathname));
    if (!file.startsWith(DIST)) return false; // path traversal guard
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, "index.html");
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": file.includes(path.sep + "assets" + path.sep)
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(file).pipe(res);
    return true;
  };
}

module.exports = { createStaticHandler };
