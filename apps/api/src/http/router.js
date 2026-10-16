const { corsHeaders } = require("./send");

function createRouter() {
  const routes = [];

  function add(method, pattern, handler) {
    routes.push({ method, pattern, handler });
  }

  async function handle(req, res) {
    const url = new URL(req.url, "http://127.0.0.1");

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return true;
    }

    for (const route of routes) {
      if (route.method !== req.method) {
        continue;
      }

      const params = matchPath(
        route.pattern,
        url.pathname
      );

      if (!params) {
        continue;
      }

      req.params = params;
      req.query = Object.fromEntries(
        url.searchParams.entries()
      );

      await route.handler(req, res);
      return true;
    }

    return false;
  }

  return { add, handle };
}

function matchPath(pattern, pathname) {
  const patternParts = pattern
    .split("/")
    .filter(Boolean);

  const pathParts = pathname
    .split("/")
    .filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(":")) {
      const paramName = patternPart.slice(1);
      params[paramName] = decodeURIComponent(pathPart);
      continue;
    }

    if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

module.exports = { createRouter };

