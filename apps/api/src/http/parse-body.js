const { ApiError } = require("./errors");

const MAX_BYTES = 256 * 1024;

function parseBody(req, maxBytes = MAX_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
      } catch {
        reject(new ApiError(400, "INVALID_JSON", "Request body must be valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

module.exports = { parseBody };
