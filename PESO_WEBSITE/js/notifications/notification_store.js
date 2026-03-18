import { db } from "/js/config/firebase.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Create a notification document for an application decision
 * (accept / decline) that is visible only to the specific user.
 *
 * The document is stored in the top-level `notifications` collection.
 *
 * @param {Object} params
 * @param {string} [params.userId] - UID of the applicant (optional if path starts with "users/{uid}/")
 * @param {string} [params.path] - Firestore document path of the application
 * @param {string} [params.status] - Raw status string, e.g. "approved" or "declined"
 * @param {string} [params.reason] - Selected reason (radio option)
 * @param {string} [params.remarks] - Additional remarks text
 * @param {string} [params.type] - "job" | "scholarship" | etc.
 */
export async function createApplicationDecisionNotification({
  userId,
  path,
  status,
  reason,
  remarks,
  type = "job",
} = {}) {
  if (!db) return;

  let resolvedUserId = userId || null;
  let programName = null;

  // Derive userId from path like "users/{uid}/JobApplied/..."
  if (!resolvedUserId && typeof path === "string" && path) {
    const segments = path.split("/").filter(Boolean);
    if (segments[0] === "users" && segments.length >= 2) {
      resolvedUserId = segments[1];
    }
  }

  // Fallback: read the document to get missing userId or programName (don't overwrite existing resolvedUserId)
  if ((!resolvedUserId || !programName) && typeof path === "string" && path) {
    try {
      const ref = doc(db, ...path.split("/").filter(Boolean));
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() || {};
        if (!resolvedUserId) {
          resolvedUserId =
            data.userId ||
            data.uid ||
            data.userUID ||
            data.applicantUserId ||
            data.applicantId ||
            null;
        }
        if (!programName) {
          programName =
            data.programType ||
            data.serviceApplied ||
            data.jobServiceApplied ||
            data.jobProgramName ||
            data.jobProgram ||
            null;
        }
      }
    } catch (err) {
      console.warn("Failed to resolve userId from path for notification:", err);
    }
  }

  if (!resolvedUserId) return;

  const s = (status || "").toString().trim().toLowerCase();
  let decision = s;
  if (["approved", "declined", "accepted", "disapproved"].includes(s)) {
    decision = s;
  }

  const decisionVerb =
    decision === "accepted"
      ? "accepted"
      : decision === "approved"
        ? "approved"
        : decision === "disapproved"
          ? "disapproved"
          : decision === "declined"
            ? "declined"
            : "updated";

  const cleanProgram =
    typeof programName === "string" && programName.trim()
      ? programName.trim()
      : "";
  const programPart = cleanProgram ? ` for ${cleanProgram}` : "";

  const title = `Application ${decisionVerb}`;
  const message = `Your application${programPart} has been ${decisionVerb}.`;

  const cleanReason =
    typeof reason === "string" && reason.trim().length ? reason.trim() : "";
  const cleanRemarks =
    typeof remarks === "string" && remarks.trim().length ? remarks.trim() : "";

  try {
    await addDoc(collection(db, "notifications"), {
      userId: resolvedUserId,
      applicationPath: path || null,
      decision,
      title,
      message,
      programName: cleanProgram || null,
      reason: cleanReason,
      remarks: cleanRemarks,
      type,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Failed to write notification document:", err);
  }
}
