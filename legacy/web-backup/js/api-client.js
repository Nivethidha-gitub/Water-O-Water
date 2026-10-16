async function apiGet(path) {
  const res = await fetch(window.WOW_CONFIG.apiBase + path);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ? json.error.message : "API error");
  }
  return json.data;
}

async function apiPost(path, body) {
  const res = await fetch(window.WOW_CONFIG.apiBase + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ? json.error.message : "API error");
  }
  return json.data;
}

window.apiGet = apiGet;
window.apiPost = apiPost;
