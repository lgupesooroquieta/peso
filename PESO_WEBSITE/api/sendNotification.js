/**
 * Vercel Serverless Function: /api/sendNotification
 *
 * Configure env vars in Vercel:
 * - ONESIGNAL_APP_ID
 * - ONESIGNAL_REST_API_KEY
 *
 * POST JSON examples:
 *
 * Announcement:
 * {
 *   "event": "announcement_added",
 *   "title": "Title",
 *   "message": "New announcement: Title",
 *   "announcementId": "<firestoreDocId>",
 *   "targetIntent": "job"|"scholarship"|"both",
 *   "category": "PESO UPDATE"
 * }
 *
 * Applicant decision (push to one Firebase user via External User ID):
 * {
 *   "event": "applicant_approved" | "applicant_declined",
 *   "userId": "<firebaseUid>",
 *   "type": "job"|"scholarship",
 *   "title": "...",
 *   "message": "...",
 *   "programName": "...",
 *   "decision": "approved"|"declined"|...
 * }
 *
 * New program (segment by intent tag):
 * {
 *   "event": "program_added",
 *   "type": "job"|"scholarship",
 *   "title": "...",
 *   "message": "...",
 *   "programName": "...",
 *   "programId": "..."
 * }
 */

const ONESIGNAL_CREATE_URL = "https://api.onesignal.com/notifications";

function toStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function buildAnnouncementPayload({
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
  const body =
    toStr(description).trim() ||
    toStr(message).trim() ||
    subtitle ||
    "You have a new announcement.";
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
      event: "announcement_added",
      announcementId: toStr(announcementId).trim(),
      targetIntent: intent || "both",
    },
    android_sound: "notification",
    ios_sound: "notification.wav",
    android_channel_id: "003eb09d-c3e9-4b48-aee6-cb6076aba831",
  };

  const img = toStr(imageUrl).trim();
  if (img) {
    payload.big_picture = img;
    payload.ios_attachments = { id1: img };
  }

  if (intent && intent !== "both") {
    payload.filters = [
      { field: "tag", key: "intent", relation: "=", value: intent },
      { operator: "OR" },
      { field: "tag", key: "intent", relation: "=", value: "both" },
    ];
  } else {
    payload.included_segments = ["All"];
  }

  return payload;
}

/**
 * Push to a single user (Flutter calls OneSignal.login(firebaseUid)).
 */
function buildApplicantPayload({
  appId,
  title,
  message,
  userId,
  type,
  event,
  decision,
  programName,
}) {
  const uid = toStr(userId).trim();
  if (!uid) return null;

  const heading = toStr(title).trim() || "Application update";
  const body = toStr(message).trim() || "Your application status was updated.";

  return {
    app_id: appId,
    target_channel: "push",
    headings: { en: heading },
    contents: { en: body },
    include_external_user_ids: [uid],
    custom_data: {
      event: toStr(event).trim(),
      type: toStr(type).trim().toLowerCase(),
      decision: toStr(decision).trim(),
      programName: toStr(programName).trim(),
    },
    android_sound: "notification",
    ios_sound: "notification.wav",
    android_channel_id: "003eb09d-c3e9-4b48-aee6-cb6076aba831",
  };
}

function buildProgramAddedPayload({
  appId,
  title,
  message,
  type,
  programName,
  programId,
}) {
  const intent = toStr(type).trim().toLowerCase();
  const headings = { en: toStr(title).trim() || "New program" };
  const body = toStr(message).trim() || "A new program is available.";
  const payload = {
    app_id: appId,
    target_channel: "push",
    headings,
    contents: { en: body },
    custom_data: {
      event: "program_added",
      type: intent,
      programName: toStr(programName).trim(),
      programId: toStr(programId).trim(),
    },
    android_sound: "notification",
    ios_sound: "notification.wav",
    android_channel_id: "003eb09d-c3e9-4b48-aee6-cb6076aba831",
  };

  if (intent === "job" || intent === "scholarship") {
    payload.filters = [
      { field: "tag", key: "intent", relation: "=", value: intent },
      { operator: "OR" },
      { field: "tag", key: "intent", relation: "=", value: "both" },
    ];
  } else {
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

    let payload;

    if (event === "announcement_added") {
      payload = buildAnnouncementPayload({
        appId,
        title: body.title,
        message: body.message,
        announcementId: body.announcementId,
        targetIntent: body.targetIntent,
        category: body.category,
        description: body.description,
        imageUrl: body.imageUrl,
      });
    } else if (
      event === "applicant_approved" ||
      event === "applicant_declined"
    ) {
      const userId = toStr(body.userId || body.applicantId).trim();
      if (!userId) {
        res.status(400).json({
          ok: false,
          error: "Missing userId (Firebase UID) for applicant notification",
        });
        return;
      }
      payload = buildApplicantPayload({
        appId,
        title: body.title,
        message: body.message,
        userId,
        type: body.type,
        event,
        decision: body.decision,
        programName: body.programName,
      });
      if (!payload) {
        res.status(400).json({ ok: false, error: "Could not build payload" });
        return;
      }
    } else if (event === "program_added") {
      payload = buildProgramAddedPayload({
        appId,
        title: body.title,
        message: body.message,
        type: body.type,
        programName: body.programName,
        programId: body.programId,
      });
    } else {
      res.status(400).json({ ok: false, error: `Unsupported event: ${event}` });
      return;
    }

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
      res
        .status(r.status)
        .json({ ok: false, status: r.status, response: text });
      return;
    }

    res.status(200).json({ ok: true, status: r.status, response: text });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
