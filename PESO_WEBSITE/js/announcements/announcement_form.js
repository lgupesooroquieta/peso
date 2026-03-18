import { db } from "/js/config/firebase.js";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/js/config/firebase.js";
import { notifyAnnouncementAdded } from "/js/onesignal/notifications.js";

const ANNOUNCEMENTS_COLLECTION = "announcements";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dbjzniu96/image/upload";
const CLOUDINARY_UPLOAD_PRESET = "mobile_upload";

function formatPostedLabel(postedAt) {
  if (!postedAt) return "Posted just now";
  const date = postedAt.toDate ? postedAt.toDate() : new Date(postedAt);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Posted just now";
  if (diffMins < 60)
    return `Posted ${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `Posted ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "Posted 1 day ago";
  if (diffDays < 7) return `Posted ${diffDays} days ago`;
  return date.toLocaleDateString();
}

const form = document.getElementById("announcementForm");
const announcementIdInput = document.getElementById("announcementId");
const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");
const displayDateInput = document.getElementById("displayDate");
const categoryInput = document.getElementById("category");
const targetIntentInput = document.getElementById("targetIntent");
const formMessage = document.getElementById("formMessage");
const formPageTitle = document.getElementById("formPageTitle");
const formPageSubtitle = document.getElementById("formPageSubtitle");
const submitBtn = document.getElementById("submitBtn");
const saveChangesModal = document.getElementById("saveChangesModal");
const saveChangesConfirmBtn = document.querySelector(
  ".js-confirm-save-changes",
);
const announcementImageInput = document.getElementById("announcementImage");
const announcementBannerPreview = document.getElementById(
  "announcementBannerPreview",
);
const announcementBannerPlaceholder = document.getElementById(
  "announcementBannerPlaceholder",
);
const announcementBannerUploadArea = document.getElementById(
  "announcementBannerUploadArea",
);
const announcementBannerRemoveBtn = document.getElementById(
  "announcementBannerRemoveBtn",
);
let pendingAnnouncementFormSubmit = null;

function getEditId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || "";
}

function showMessage(text, type) {
  if (!formMessage) return;
  formMessage.textContent = text;
  formMessage.className =
    "form-message " + (type === "error" ? "error" : "success");
  formMessage.classList.remove("hidden");
}

function hideMessage() {
  if (formMessage) formMessage.classList.add("hidden");
}

function setAnnouncementImagePreview(url) {
  if (url) {
    if (announcementBannerPreview) {
      announcementBannerPreview.src = url;
      announcementBannerPreview.style.display = "block";
    }
    if (announcementBannerPlaceholder)
      announcementBannerPlaceholder.style.display = "none";
    if (announcementBannerUploadArea)
      announcementBannerUploadArea.classList.add("has-image");
    if (form) delete form.dataset.removeImage;
  } else {
    if (announcementImageInput) announcementImageInput.value = "";
    if (announcementBannerPreview) {
      announcementBannerPreview.src = "";
      announcementBannerPreview.style.display = "none";
    }
    if (announcementBannerPlaceholder)
      announcementBannerPlaceholder.style.display = "block";
    if (announcementBannerUploadArea)
      announcementBannerUploadArea.classList.remove("has-image");
    if (form) form.dataset.removeImage = "true";
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/pages/login/login.html";
    return;
  }
  document.documentElement.classList.remove("auth-pending");
  const editId = getEditId();
  if (editId) {
    if (formPageTitle) formPageTitle.textContent = "Edit Announcement";
    if (formPageSubtitle)
      formPageSubtitle.textContent = "Update the announcement details.";
    loadAnnouncement(editId);
  }
});

async function loadAnnouncement(id) {
  try {
    const ref = doc(db, ANNOUNCEMENTS_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      showMessage("Announcement not found.", "error");
      return;
    }
    const d = snap.data();
    if (announcementIdInput) announcementIdInput.value = id;
    if (titleInput) titleInput.value = d.title || "";
    if (descriptionInput) descriptionInput.value = d.description || "";
    if (displayDateInput) displayDateInput.value = d.date || "";
    if (categoryInput) categoryInput.value = d.category || "";
    if (targetIntentInput) targetIntentInput.value = d.targetIntent || "both";
    if (form) form.dataset.editImageUrl = d.imageUrl || "";
    setAnnouncementImagePreview(d.imageUrl || "");
    if (announcementImageInput) announcementImageInput.value = "";
    if (form) delete form.dataset.removeImage;
  } catch (err) {
    console.error("Error loading announcement:", err);
    showMessage("Failed to load announcement: " + err.message, "error");
  }
}

async function performAnnouncementFormSubmit() {
  hideMessage();

  const title = titleInput?.value?.trim();
  const description = descriptionInput?.value?.trim();
  const date = displayDateInput?.value?.trim();
  const category = categoryInput?.value?.trim();
  const targetIntent = targetIntentInput?.value || "both";
  const id = announcementIdInput?.value?.trim();

  if (!title || !description || !date || !category) {
    showMessage("Please fill in all required fields.", "error");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  }

  try {
    const imageFile = announcementImageInput?.files?.[0] || null;
    const existingImageUrl =
      id && form?.dataset?.editImageUrl ? form.dataset.editImageUrl : "";
    const removeImage = form?.dataset?.removeImage === "true";

    let imageUrl = "";
    if (removeImage) {
      imageUrl = "";
    } else if (imageFile) {
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(CLOUDINARY_URL, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Image upload failed.");
      const uploadData = await response.json();
      imageUrl = uploadData.secure_url;
    } else if (id && existingImageUrl) {
      imageUrl = existingImageUrl;
    }

    const now = Timestamp.now();
    const postedLabel = formatPostedLabel(now);

    const data = {
      title,
      description,
      date,
      postedLabel,
      category,
      targetIntent,
      imageUrl: imageUrl || null,
      postedAt: now,
    };

    if (id) {
      await updateDoc(doc(db, ANNOUNCEMENTS_COLLECTION, id), data);
      showMessage("Announcement updated successfully.", "success");
      // Show toast immediately after save completes
      if (typeof window.showToast === "function")
        window.showToast("Saved changes", "success");
      notifyAnnouncementAdded({
        title: data.title || "",
        id,
        isNew: false,
      }).catch(() => {});
    } else {
      const ref = await addDoc(collection(db, ANNOUNCEMENTS_COLLECTION), data);
      showMessage("Announcement created successfully.", "success");
      notifyAnnouncementAdded({
        title: data.title || "",
        id: ref.id,
        isNew: true,
      }).catch(() => {});
    }

    setTimeout(() => {
      window.location.href = "/pages/announcements/announcements.html";
    }, 1200);
  } catch (err) {
    console.error("Save failed:", err);
    showMessage("Save failed: " + err.message, "error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Announcement';
    }
  }
}

// Save changes modal handlers
if (saveChangesModal) {
  const closeBtn = saveChangesModal.querySelector(
    ".js-close-save-changes-modal",
  );
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      saveChangesModal.classList.remove("open");
    });
  }
  saveChangesModal.addEventListener("click", (e) => {
    if (e.target === saveChangesModal)
      saveChangesModal.classList.remove("open");
  });
}

if (saveChangesConfirmBtn) {
  saveChangesConfirmBtn.addEventListener("click", async () => {
    if (!pendingAnnouncementFormSubmit) return;
    const btn = saveChangesConfirmBtn;
    const icon = btn?.querySelector("i");
    const text = btn?.querySelector(".btn-text");
    btn.disabled = true;
    if (icon) icon.className = "fas fa-spinner fa-spin";
    if (text) text.textContent = "Saving...";

    try {
      await pendingAnnouncementFormSubmit();
      if (saveChangesModal) saveChangesModal.classList.remove("open");
    } finally {
      btn.disabled = false;
      if (icon) icon.className = "fas fa-save";
      if (text) text.textContent = "Save Changes";
      pendingAnnouncementFormSubmit = null;
    }
  });
}

// Photo upload: show preview when file is selected
if (announcementImageInput) {
  announcementImageInput.addEventListener("change", function (e) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (ev) {
        setAnnouncementImagePreview(ev.target?.result || "");
      };
      reader.readAsDataURL(file);
    }
  });
}
if (announcementBannerRemoveBtn) {
  announcementBannerRemoveBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    setAnnouncementImagePreview("");
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = announcementIdInput?.value?.trim();

  if (id) {
    // Show confirmation modal for updates
    if (saveChangesModal) {
      pendingAnnouncementFormSubmit = performAnnouncementFormSubmit;
      saveChangesModal.classList.add("open");
    } else {
      await performAnnouncementFormSubmit();
    }
  } else {
    // Create new - no confirmation needed
    await performAnnouncementFormSubmit();
  }
});
