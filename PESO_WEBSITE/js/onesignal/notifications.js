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
      console.warn(
        "[OneSignal] Backend returned",
        res.status,
        await res.text()
      );
    }
  } catch (err) {
    console.warn("[OneSignal] Send failed:", err);
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
  } = options || {};

  await sendToBackend({
    event: "announcement_added",
    title,
    announcementId: id,
    isNew,
    targetIntent, // backend will use this to filter by OneSignal tag 'intent'
    message: isNew
      ? `New announcement: ${title}` // Added backticks here
      : `Announcement updated: ${title}`, // Added backticks here
  });
}

/**
 * Call when an applicant (job or scholarship) is approved.
 * @param {{ applicantName?: string, programName?: string, type?: 'job'|'scholarship', applicantId?: string }} options
 */
export async function notifyApproval(options) {
  const {
    applicantName = "",
    programName = "",
    type = "job",
    applicantId,
  } = options || {};

  await sendToBackend({
    event: "applicant_approved",
    type,
    applicantName,
    programName,
    applicantId,
    title: "Application approved",
    message: applicantName
      ? `${applicantName} has been approved.` // Added backticks here
      : "An application has been approved.",
  });
}

/**
 * Call when an applicant (job or scholarship) is declined.
 * @param {{ applicantName?: string, programName?: string, type?: 'job'|'scholarship', applicantId?: string, remarks?: string }} options
 */
export async function notifyDecline(options) {
  const {
    applicantName = "",
    programName = "",
    type = "job",
    applicantId,
    remarks = "",
  } = options || {};

  await sendToBackend({
    event: "applicant_declined",
    type,
    applicantName,
    programName,
    applicantId,
    remarks,
    title: "Application declined",
    message: applicantName
      ? `${applicantName}'s application was declined.` // Added backticks here
      : "An application was declined.",
  });
}

export default {
  notifyProgramAdded,
  notifyAnnouncementAdded,
  notifyApproval,
  notifyDecline,
};