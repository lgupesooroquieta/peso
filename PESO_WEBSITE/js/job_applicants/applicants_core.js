import { db } from "/js/config/firebase.js";
import {
  collection,
  collectionGroup,
  query,
  getDocs,
  getDoc,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { createApplicationDecisionNotification } from "/js/notifications/notification_store.js";

// --- HELPERS ---

export function normalizeStatus(rawStatus) {
  const s = (rawStatus || "").toString().trim().toLowerCase();
  if (["accepted", "accept", "passed"].includes(s)) return "Accepted";
  if (["approved", "approve"].includes(s)) return "Approved";
  if (["disapproved", "disapprove", "not approved"].includes(s))
    return "Disapproved";
  if (
    ["declined", "decline", "rejected", "reject", "denied", "failed"].includes(
      s,
    )
  )
    return "Declined";
  return "In Progress";
}

export function statusBadgeClass(statusLabel) {
  if (statusLabel === "Accepted") return "bg-success";
  if (statusLabel === "Approved") return "bg-primary";
  if (statusLabel === "Declined") return "bg-danger";
  if (statusLabel === "Disapproved") return "bg-danger";
  return "bg-warning text-dark";
}

export function formatDisability(data) {
  const parts = [];
  if (data.disabilityFull && typeof data.disabilityFull === "object") {
    const labels = {
      Visual: "Visual",
      Speech: "Speech",
      Mental: "Mental",
      Hearing: "Hearing",
      Physical: "Physical",
    };
    Object.keys(labels).forEach((k) => {
      if (data.disabilityFull[k]) parts.push(labels[k]);
    });
    if (
      data.disabilityFull["Others (please specify)"] ||
      data.disabilityFull.Others
    ) {
      parts.push("Others");
    }
  }
  const other =
    data.disabilityOther || data.disabilitySpecify || data.disability_other;
  if (other && (other + "").trim()) parts.push(`Others: ${other}`);
  return parts.length ? parts.join(", ") : "None";
}

// --- API FUNCTIONS ---

// 1. Fetch All Applicants
export async function fetchAllApplicants() {
  if (!db) throw new Error("Database not found.");

  const q = query(
    collectionGroup(db, "JobApplied"),
    orderBy("createdAt", "desc"),
    limit(100),
  );

  const querySnapshot = await getDocs(q);
  const applicants = [];

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();

    // Name Construction
    const nameParts = [
      data.firstName,
      data.middleName,
      data.surname,
      data.suffix,
    ].filter(
      (part) => part && part.trim() !== "" && part.toLowerCase() !== "none",
    );
    const fullName = nameParts.join(" ") || "No Name";

    // Date Parsing
    let formattedDate = "N/A";
    let dateObj = null;
    if (data.createdAt && data.createdAt.toDate) {
      dateObj = data.createdAt.toDate();
      formattedDate = dateObj.toLocaleDateString();
    }

    // Program Type - keep the original label so filters can match
    const rawType =
      data.programType || data.jobProgramName || data.jobProgram || "";
    const programType = rawType || "Other";

    // Reference number (for display/search)
    const referenceNumber =
      data.spesReferenceNumber || data.referenceNumber || data.reference || "";

    applicants.push({
      id: docSnap.id,
      path: docSnap.ref.path,
      raw: data, // Store raw data for editing/modals
      name: fullName,
      email: data.email || "N/A",
      programType,
      reference: referenceNumber,
      // Applied service text shown in table & modal
      // Include programType as a fallback so it never shows N/A
      serviceApplied:
        data.serviceApplied ||
        data.jobServiceApplied ||
        data.jobProgramName ||
        data.jobProgram ||
        data.programType ||
        "N/A",
      reason: data.whyChooseProgram || data.reason || "N/A",
      dateObj,
      dateStr: formattedDate,
      status: normalizeStatus(data.applicationStatus || data.status),
    });
  });

  return applicants;
}

// 2. Fetch distinct program types from jobPrograms + otherPrograms
export async function fetchProgramTypeOptions() {
  if (!db) throw new Error("Database not found.");

  const coreTypes = ["SPES", "GIP", "TUPAD", "JobStart"];
  const typeSet = new Set(coreTypes);

  // Pull types from jobPrograms
  try {
    const jobProgramsSnap = await getDocs(
      query(collection(db, "jobPrograms"), orderBy("createdAt", "desc")),
    );
    jobProgramsSnap.forEach((snapshotDoc) => {
      const data = snapshotDoc.data() || {};
      const t = (data.programType || "").trim();
      if (t && t !== "N/A") typeSet.add(t);
    });
  } catch (e) {
    console.warn("Error fetching jobPrograms for type options:", e);
  }

  // Pull custom program names from otherPrograms (matches add_program.js)
  try {
    const otherSnap = await getDocs(collection(db, "otherPrograms"));
    otherSnap.forEach((d) => {
      const name = (d.data().programName || "").trim();
      if (name) typeSet.add(name);
    });
  } catch (e) {
    console.warn("Error fetching otherPrograms for type options:", e);
  }

  // Build ordered list: core types, then custom sorted, then "Other"
  const allTypes = [...typeSet];
  const customTypes = allTypes
    .filter((t) => t !== "Other" && !coreTypes.includes(t))
    .sort();

  return [...coreTypes, ...customTypes, "Other"];
}

// 3. Fetch User Profile (For Image)
const userCache = new Map();

export async function fetchUserProfileImage(userId) {
  if (!userId) return null;
  if (userCache.has(userId)) return userCache.get(userId);

  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const img =
        userData.profileimageurl ||
        userData.profileImageUrl ||
        userData.photoURL;
      userCache.set(userId, img);
      return img;
    }
  } catch (e) {
    console.warn("Error fetching user profile:", e);
  }
  return null;
}

// 3. Update Operations
export async function updateApplicantStatus(
  path,
  status,
  remarks = null,
  userId = null,
  reason = null,
) {
  const s = (status || "").toString().trim().toLowerCase();
  const updates = {
    applicationStatus: status,
    status: status,
    updatedAt: serverTimestamp(),
  };
  const cleanRemarks =
    typeof remarks === "string" && remarks.trim().length
      ? remarks.trim()
      : null;
  const cleanReason =
    typeof reason === "string" && reason.trim().length ? reason.trim() : null;

  if (cleanReason) {
    updates.decisionReason = cleanReason;
    if (s === "approved") updates.approvalReason = cleanReason;
    if (s === "declined") updates.declineReason = cleanReason;
    if (s === "accepted") updates.acceptReason = cleanReason;
    if (s === "disapproved") updates.disapproveReason = cleanReason;
  }

  if (cleanRemarks) {
    updates.decisionRemarks = cleanRemarks;
    if (s === "approved") updates.approvalRemarks = cleanRemarks;
    if (s === "declined") {
      updates.denialRemarks = cleanRemarks; // legacy field
      updates.declineRemarks = cleanRemarks;
    }
    if (s === "accepted") updates.acceptRemarks = cleanRemarks;
    if (s === "disapproved") updates.disapproveRemarks = cleanRemarks;
  }

  const docRef = doc(db, ...path.split("/"));
  await updateDoc(docRef, updates);

  // Create a per-applicant notification document so only that user
  // needs to query their own notifications.
  await createApplicationDecisionNotification({
    userId,
    path,
    status,
    reason: cleanReason,
    remarks: cleanRemarks,
    type: "job",
  });
}

export async function deleteApplicant(path) {
  await deleteDoc(doc(db, ...path.split("/")));
}

export async function updateApplicantDetails(path, updates) {
  const finalUpdates = {
    ...updates,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, ...path.split("/")), finalUpdates);
  return finalUpdates;
}
