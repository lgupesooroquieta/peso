/**
 * Vercel Serverless Function: /api/sendNotification
 *
 * Configure env vars in Vercel:
 * - ONESIGNAL_APP_ID
 * - ONESIGNAL_REST_API_KEY
 *
 * POST JSON:
 * {
 *   "event": "announcement_added",
 *   "title": "Title",
 *   "message": "New announcement: Title",
 *   "announcementId": "<firestoreDocId>",
 *   "targetIntent": "job"|"scholarship"|"both",
 *   "category": "PESO UPDATE"
 * }
 */

const ONESIGNAL_CREATE_URL = "https://api.onesignal.com/notifications";

function toStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function buildPayload({
  appId,
  title,
  message,
  announcementId,
  targetIntent,
  category,
  description,
  imageUrl,
}) {
  const intent = toStr(targetIntent).trim().toLowerCase();
  const headings = { en: toStr(category).trim() || "Official Update" };
  const subtitle = toStr(title).trim();
  const body = toStr(description).trim() || toStr(message).trim() || subtitle || "You have a new announcement.";
  const contents = {
    en: body,
  };

  const payload = {
    app_id: appId,
    target_channel: "push",
    headings,
    ...(subtitle ? { subtitle: { en: subtitle } } : {}),
    contents,
    custom_data: {
      announcementId: toStr(announcementId).trim(),
      targetIntent: intent || "both",
    },
    // Custom sound names (must exist in the mobile app build)
    android_sound: "notification_sound",
    ios_sound: "notification_sound.wav",
  };

  const img = toStr(imageUrl).trim();
  if (img) {
    // Rich notification image (Android)
    payload.big_picture = img;
    // Rich notification attachment (iOS)
    payload.ios_attachments = { id1: img };
  }

  // Target by OneSignal tag "intent" (set by Flutter app on login).
  if (intent && intent !== "both") {
    payload.filters = [
      { field: "tag", key: "intent", relation: "=", value: intent },
      { operator: "OR" },
      { field: "tag", key: "intent", relation: "=", value: "both" },
    ];
  } else {
    // OneSignal expects built-in segment name "All"
    payload.included_segments = ["All"];
  }

  return payload;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const restApiKey = toStr(process.env.ONESIGNAL_REST_API_KEY).trim();
  const appId = toStr(process.env.ONESIGNAL_APP_ID).trim();

  if (!restApiKey) {
    res
      .status(500)
      .json({ ok: false, error: "Missing env ONESIGNAL_REST_API_KEY" });
    return;
  }
  if (!appId) {
    res.status(500).json({ ok: false, error: "Missing env ONESIGNAL_APP_ID" });
    return;
  }

  try {
    const body = req.body || {};
    const event = toStr(body.event).trim();
    if (!event) {
      res.status(400).json({ ok: false, error: "Missing event" });
      return;
    }

    const payload = buildPayload({
      appId,
      title: body.title,
      message: body.message,
      announcementId: body.announcementId,
      targetIntent: body.targetIntent,
      category: body.category,
      description: body.description,
      imageUrl: body.imageUrl,
    });

    const r = await fetch(ONESIGNAL_CREATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Key ${restApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    if (!r.ok) {
      res.status(r.status).json({ ok: false, status: r.status, response: text });
      return;
    }

    res.status(200).json({ ok: true, status: r.status, response: text });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}

