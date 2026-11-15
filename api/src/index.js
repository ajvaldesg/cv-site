/* =========================================================
   Jonathan Valdes — CV site API
   Azure Static Web Apps managed functions (Node 20).

   Routes (all same-origin, no CORS needed):
     GET  /api/health   -> liveness + region + cold-start-safe payload
     GET  /api/visits   -> increments and returns the visit counter (Table Storage)
     POST /api/contact  -> validates and stores a contact message (Table Storage)

   Design notes:
   - No secrets in the repo: storage is reached through the
     STORAGE_CONNECTION_STRING app setting (managed identity is overkill for a CV).
   - Every failure degrades gracefully: the site must never break because
     the API is cold or storage is unreachable.
   ========================================================= */
"use strict";

const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

const STARTED_AT = Date.now();

const TABLE_COUNTERS = "counters";
const TABLE_MESSAGES = "messages";

let countersClient = null;
let messagesClient = null;

function getClient(tableName) {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) return null;
  if (tableName === TABLE_COUNTERS) {
    if (!countersClient) countersClient = TableClient.fromConnectionString(conn, TABLE_COUNTERS);
    return countersClient;
  }
  if (!messagesClient) messagesClient = TableClient.fromConnectionString(conn, TABLE_MESSAGES);
  return messagesClient;
}

async function ensureTable(client) {
  try {
    await client.createTable();
  } catch (err) {
    // 409 TableAlreadyExists is the happy path after the first call.
    if (!err || err.statusCode !== 409) throw err;
  }
}

function json(status, body) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

/* ---------------- GET /api/health ---------------- */
app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: async () => {
    return json(200, {
      status: "ok",
      service: "cv-site-api",
      runtime: `node ${process.versions.node}`,
      region: process.env.REGION_NAME || process.env.WEBSITE_REGION || "unknown",
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      storageConfigured: Boolean(process.env.STORAGE_CONNECTION_STRING),
      telemetryConfigured: Boolean(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING),
      timestamp: new Date().toISOString(),
    });
  },
});

/* ---------------- GET /api/visits ---------------- */
app.http("visits", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "visits",
  handler: async () => {
    const client = getClient(TABLE_COUNTERS);
    if (!client) return json(200, { count: null, note: "counter not configured" });

    try {
      await ensureTable(client);
      const key = { partitionKey: "site", rowKey: "visits" };
      let count = 1;
      try {
        const entity = await client.getEntity(key.partitionKey, key.rowKey);
        count = Number(entity.count || 0) + 1;
      } catch (err) {
        if (!err || err.statusCode !== 404) throw err;
      }
      await client.upsertEntity(
        {
          ...key,
          count,
          lastVisitUtc: new Date().toISOString(),
        },
        "Replace"
      );
      return json(200, { count });
    } catch (err) {
      return json(200, { count: null, note: "counter unavailable" });
    }
  },
});

/* ---------------- POST /api/contact ---------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

app.http("contact", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "contact",
  handler: async (request) => {
    let payload;
    try {
      payload = await request.json();
    } catch (err) {
      return json(400, { ok: false, error: "invalid_json" });
    }

    const name = String(payload?.name || "").trim().slice(0, 120);
    const email = String(payload?.email || "").trim().slice(0, 160);
    const message = String(payload?.message || "").trim().slice(0, 4000);

    if (name.length < 2) return json(400, { ok: false, error: "name_required" });
    if (!EMAIL_RE.test(email)) return json(400, { ok: false, error: "email_invalid" });
    if (message.length < 10) return json(400, { ok: false, error: "message_too_short" });

    const client = getClient(TABLE_MESSAGES);
    if (!client) return json(503, { ok: false, error: "storage_not_configured" });

    try {
      await ensureTable(client);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await client.createEntity({
        partitionKey: "contact",
        rowKey: id,
        name,
        email,
        message,
        ip: request.headers.get("x-forwarded-for") || "unknown",
        createdAt: new Date().toISOString(),
      });
      return json(200, { ok: true, id });
    } catch (err) {
      return json(500, { ok: false, error: "storage_error" });
    }
  },
});
