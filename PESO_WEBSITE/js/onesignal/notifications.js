/**
 * OneSignal notification helpers for PESO Website.
 * Call these after adding programs/announcements or on approval/decline.
 * Sending is done via your backend (notificationBackendUrl in config);
 * the REST API Key must stay server-side.
 */

import { OneSignalConfig } from "/js/config/onesignal.js";

const { enabled, notificationBackendUrl } = OneSignalConfig;

async function sendToBackend(payload) {
  if (!enabled || !notificationBackendUrl || !payload) return;
  try {
    const res = await fetch(notificationBackendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(
        "[OneSignal] Backend returned",
        res.status,
        errText,
      );
      if (typeof window.showToast === "function") {
        window.showToast(
          `OneSignal push failed (${res.status})`,
          "error",
        );
      }
    }
  } catch (err) {
    console.warn("[OneSignal] Send failed:", err);
    if (typeof window.showToast === "function") {
      window.showToast("OneSignal push failed (network error)", "error");
    }
  }
}

/**
 * Call when a job or scholarship program is added.
 * @param {{ type: 'job'|'scholarship', name: string, id?: string }} options
 */
export async function notifyProgramAdded(options) {
  const { type = "job", name = "", id } = options || {};
  await sendToBackend({
    event: "program_added",
    type,
    programName: name,
    programId: id,
    title: "New program",
    message: `New ${type} program: ${name}`, // Added backticks here
  });
}

/**
 * Call when an announcement is added or updated (use isNew to differentiate).
 * targetIntent should match the Firestore field: 'job' | 'scholarship' | 'both'.
 *
 * @param {{
 * title: string,
 * id?: string,
 * isNew?: boolean,
 * targetIntent?: 'job'|'scholarship'|'both'
 * }} options
 */
export async function notifyAnnouncementAdded(options) {
  const {
    title = "",
    id,
    isNew = true,
    targetIntent = "both",
    category = "",
    description = "",
    imageUrl = "",
  } = options || {};

  await sendToBackend({
    event: "announcement_added",
    title,
    announcementId: id,
    isNew,
    targetIntent, // backend will use this to filter by OneSignal tag 'intent'
    category,
    description,
    imageUrl,
    message: isNew
      ? `New announcement: ${title}` // Added backticks here
      : `Announcement updated: ${title}`, // Added backticks here
  });
}

/**
 * Call when an applicant (job or scholarship) is approved.
 * @param {{
 *  applicantName?: string,
 *  programName?: string,
 *  type?: 'job'|'scholarship',
 *  applicantId?: string,
 *  decision?: 'approved'|'accepted',
 *  remarks?: string
 * }} options
 */
export async function notifyApproval(options) {
  const {
    applicantName = "",
    programName = "",
    type = "job",
    applicantId,
    decision = "approved",
    remarks = "",
  } = options || {};

  const d = (decision || "approved").toString().trim().toLowerCase();
  const verb = d === "accepted" ? "accepted" : "approved";
  const programPart = programName ? ` for ${programName}` : "";
  const reasonPart = remarks ? ` Reason: ${remarks}` : "";

  await sendToBackend({
    event: "applicant_approved",
    type,
    applicantName,
    programName,
    applicantId,
    decision: verb,
    remarks,
    title: `Application ${verb}`,
    message: `Your application${programPart} has been ${verb}.${reasonPart}`,
  });
}

/**
 * Call when an applicant (job or scholarship) is declined.
 * @param {{
 *  applicantName?: string,
 *  programName?: string,
 *  type?: 'job'|'scholarship',
 *  applicantId?: string,
 *  remarks?: string,
 *  decision?: 'declined'|'disapproved'
 * }} options
 */
export async function notifyDecline(options) {
  const {
    applicantName = "",
    programName = "",
    type = "job",
    applicantId,
    userId,
    remarks = "",
    decision = "declined",
  } = options || {};

  const d = (decision || "declined").toString().trim().toLowerCase();
  const verb = d === "disapproved" ? "disapproved" : "declined";
  const programPart = programName ? ` for ${programName}` : "";
  const reasonPart = remarks ? ` Reason: ${remarks}` : "";

  await sendToBackend({
    event: "applicant_declined",
    type,
    applicantName,
    programName,
    applicantId,
    userId: userId || applicantId,
    decision: verb,
    remarks,
    title: `Application ${verb}`,
    message: `Your application${programPart} has been ${verb}.${reasonPart}`,
  });
}

export default {
  notifyProgramAdded,
  notifyAnnouncementAdded,
  notifyApproval,
  notifyDecline,
};
