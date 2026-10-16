/*
 * Route guard. Wraps a handler so that it only runs for an authenticated
 * user (valid, unexpired session) and, optionally, only for given roles.
 * The check happens on the server for every request - frontend role checks
 * are only a convenience.
 *
 *   router.add("GET", "/v1/orders", guard(auth, ["CUSTOMER", "SUPPLIER"], handler));
 */
const { sendError } = require("./send");

function bearerToken(req) {
  const header = req.headers["authorization"] || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

function createGuard(authService) {
  return function guard(roles, handler) {
    return async function guarded(req, res) {
      const token = bearerToken(req);
      const session = token ? authService.authenticate(token) : null;

      if (!session) {
        sendError(res, 401, "UNAUTHORIZED", "Please sign in to continue");
        return;
      }

      if (roles && roles.length > 0 && !roles.includes(session.user.role)) {
        sendError(res, 403, "FORBIDDEN", "Your account cannot access this resource");
        return;
      }

      req.user = session.user;
      req.token = token;
      return handler(req, res);
    };
  };
}

module.exports = { createGuard, bearerToken };
