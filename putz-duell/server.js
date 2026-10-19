// Putz-Duell – kleiner Server fürs Heimnetz. Keine Abhängigkeiten, Node 18 oder neuer.
// Liefert die App aus public/ aus und hält den gemeinsamen Spielstand in data/state.json.
// API:  GET /api/state            -> { done: {id: eintrag}, weeks: {kw: eintrag} }
//       PUT /api/done/<id>        -> Eintrag anlegen/ersetzen (JSON-Body)
//       DELETE /api/done/<id>     -> Eintrag löschen
//       PUT /api/weeks/<kw>       -> Einsatz der Woche setzen
//       GET /api/events           -> Server-Sent Events, bei jeder Änderung der komplette Stand
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 8470;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const COLLECTIONS = new Set(["done", "weeks"]);
const ID_RE = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;

fs.mkdirSync(DATA_DIR, { recursive: true });

let state = { done: {}, weeks: {} };
try {
  const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  state = { done: raw.done || {}, weeks: raw.weeks || {} };
} catch (e) {
  if (e.code !== "ENOENT") console.error("state.json nicht lesbar, starte leer:", e.message);
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = STATE_FILE + ".tmp";
    fs.writeFile(tmp, JSON.stringify(state, null, 2), err => {
      if (err) return console.error("Speichern fehlgeschlagen:", err.message);
      fs.rename(tmp, STATE_FILE, e2 => e2 && console.error("Speichern fehlgeschlagen:", e2.message));
    });
  }, 50);
}

const clients = new Set();
function broadcast() {
  const msg = "data: " + JSON.stringify(state) + "\n\n";
  for (const res of clients) res.write(msg);
}

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > 64 * 1024) { reject(new Error("zu groß")); req.destroy(); } });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function serveStatic(req, res, urlPath) {
  let file = decodeURIComponent(urlPath === "/" ? "/index.html" : urlPath);
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
  const abs = path.join(PUBLIC_DIR, file);
  if (!abs.startsWith(PUBLIC_DIR)) return json(res, 403, { error: "verboten" });
  fs.readFile(abs, (err, buf) => {
    if (err) return json(res, 404, { error: "nicht gefunden" });
    res.writeHead(200, { "content-type": MIME[path.extname(abs)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  if (p === "/api/state" && req.method === "GET") return json(res, 200, state);

  if (p === "/api/events" && req.method === "GET") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
    res.write("retry: 3000\n\n");
    res.write("data: " + JSON.stringify(state) + "\n\n");
    clients.add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => { clearInterval(ping); clients.delete(res); });
    return;
  }

  const m = p.match(/^\/api\/([a-z]+)\/([^/]+)$/);
  if (m) {
    const [, col, rawId] = m;
    const id = decodeURIComponent(rawId);
    if (!COLLECTIONS.has(col) || !ID_RE.test(id)) return json(res, 400, { error: "ungültiger Pfad" });
    if (req.method === "PUT") {
      let body;
      try { body = await readBody(req); } catch (e) { return json(res, 400, { error: "ungültiger Body" }); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return json(res, 400, { error: "Body muss ein Objekt sein" });
      state[col][id] = body;
      save(); broadcast();
      return json(res, 200, state);
    }
    if (req.method === "DELETE") {
      delete state[col][id];
      save(); broadcast();
      return json(res, 200, state);
    }
    return json(res, 405, { error: "Methode nicht erlaubt" });
  }

  if (p.startsWith("/api/")) return json(res, 404, { error: "nicht gefunden" });
  if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Methode nicht erlaubt" });
  serveStatic(req, res, p);
});

server.listen(PORT, HOST, () => {
  console.log(`Putz-Duell läuft auf http://${HOST}:${PORT}  (Daten: ${STATE_FILE})`);
});
