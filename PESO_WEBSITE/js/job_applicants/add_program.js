import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "/js/config/firebase.js";
import { notifyProgramAdded } from "/js/onesignal/notifications.js";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dbjzniu96/image/upload";
const CLOUDINARY_UPLOAD_PRESET = "mobile_upload";
const JOB_PROGRAMS_COLLECTION = "jobPrograms";
const OTHER_PROGRAMS_COLLECTION = "otherPrograms";
const STANDARD_PROGRAM_TYPES = ["SPES", "GIP", "TUPAD", "JobStart"];

// --- DOM Elements ---
const addJobModal = document.getElementById("addJobModal");
const openAddJobModalBtn = document.getElementById("openAddJobModalBtn");
const addJobModalClose = document.getElementById("addJobModalClose");
const addJobForm = document.getElementById("addJobForm");
const addJobFormMessage = document.getElementById("addJobFormMessage");
const addJobSubmitBtn = document.getElementById("addJobSubmitBtn");
const clearBtn = document.getElementById("addJobClearBtn");

// Custom Program Type Elements
const programTypeSelect = document.getElementById("modalProgramType");
const customProgramContainer = document.getElementById(
  "customProgramTypeContainer",
);
const customProgramInput = document.getElementById("modalCustomProgramType");
const editProgramIdInput = document.getElementById("editProgramId");
const addJobModalTitle = document.querySelector(
  "#addJobModal .add-job-modal-header h2",
);
const saveChangesModal = document.getElementById("saveChangesModal");
const saveChangesConfirmBtn = document.querySelector(
  ".js-confirm-save-changes",
);

// --- Modal Functions ---
async function openAddJobModal(skipRefresh = false) {
  if (!skipRefresh) await refreshProgramTypeOptions();
  if (addJobModal) {
    addJobModal.classList.add("open");
    addJobModal.setAttribute("aria-hidden", "false");
  }
  if (addJobFormMessage) addJobFormMessage.classList.add("hidden");
}

function closeAddJobModal() {
  if (addJobModal) {
    addJobModal.classList.remove("open");
    addJobModal.setAttribute("aria-hidden", "true");
  }
  // Delay reset until after the close animation completes (0.25s transition)
  setTimeout(() => {
    if (editProgramIdInput) editProgramIdInput.value = "";
    resetAddJobModalToAddMode();
  }, 300);
}

function resetAddJobModalToAddMode() {
  if (addJobModalTitle)
    addJobModalTitle.innerHTML =
      '<i class="fas fa-briefcase"></i> Add Services';
  if (addJobSubmitBtn)
    addJobSubmitBtn.innerHTML =
      '<i class="fas fa-paper-plane"></i> Publish Program';
  if (addJobForm) {
    delete addJobForm.dataset.editImageUrl;
    delete addJobForm.dataset.removeImage;
  }
}

function parseDeadlineToInput(deadlineStr) {
  if (!deadlineStr || deadlineStr === "No deadline") return "";
  const d = new Date(deadlineStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

/** Fetches otherPrograms from Firestore and repopulates the program type dropdown so saved custom names appear as choices. */
async function refreshProgramTypeOptions() {
  if (!programTypeSelect) return;
  const standardSet = new Set(STANDARD_PROGRAM_TYPES);
  const customNames = new Set();

  try {
    const snapshot = await getDocs(collection(db, OTHER_PROGRAMS_COLLECTION));
    snapshot.forEach((d) => {
      const name = d.data().programName;
      if (name && typeof name === "string" && !standardSet.has(name.trim())) {
        customNames.add(name.trim());
      }
    });
  } catch (err) {
    console.warn("Could not load otherPrograms for dropdown:", err);
  }

  programTypeSelect.innerHTML = "";
  STANDARD_PROGRAM_TYPES.forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    programTypeSelect.appendChild(opt);
  });
  [...customNames]
    .sort((a, b) => a.localeCompare(b))
    .forEach((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      programTypeSelect.appendChild(opt);
    });
  const otherOpt = document.createElement("option");
  otherOpt.value = "Other";
  otherOpt.textContent = "Other";
  programTypeSelect.appendChild(otherOpt);
}

async function openAddJobModalForEdit(program) {
  if (!addJobForm || !editProgramIdInput) return;

  await refreshProgramTypeOptions();

  editProgramIdInput.value = program.id || "";
  addJobForm.dataset.editImageUrl = program.imageUrl || "";

  // Set program type - check if it's a standard option or a custom (otherPrograms) option
  const standardTypes = [...STANDARD_PROGRAM_TYPES, "Other"];
  const programType = program.programType || "";

  if (programTypeSelect) {
    const optionExists = [...programTypeSelect.options].some(
      (opt) => opt.value === programType,
    );
    if (optionExists) {
      programTypeSelect.value = programType;
      if (customProgramContainer) customProgramContainer.style.display = "none";
      if (customProgramInput) {
        customProgramInput.removeAttribute("required");
        customProgramInput.value = "";
      }
    } else {
      programTypeSelect.value = "Other";
      if (customProgramContainer)
        customProgramContainer.style.display = "block";
      if (customProgramInput) {
        customProgramInput.value = programType;
        customProgramInput.setAttribute("required", "true");
      }
    }
  }

  document.getElementById("modalDescription").value = program.description || "";
  document.getElementById("modalContactInfo").value = program.contactInfo || "";
  document.getElementById("modalDeadline").value = parseDeadlineToInput(
    program.deadline,
  );
  document.getElementById("modalContactPerson").value =
    program.contactPerson || "";

  if (typeof window.setProgramFormImagePreview === "function") {
    window.setProgramFormImagePreview(program.imageUrl || "");
  } else {
    const bannerPreview = document.getElementById("bannerPreview");
    const bannerPlaceholder = document.getElementById("bannerPlaceholder");
    const bannerUploadArea = document.getElementById("bannerUploadArea");
    if (program.imageUrl) {
      if (bannerPreview) {
        bannerPreview.src = program.imageUrl;
        bannerPreview.style.display = "block";
      }
      if (bannerPlaceholder) bannerPlaceholder.style.display = "none";
      if (bannerUploadArea) bannerUploadArea.classList.add("has-image");
    } else {
      if (bannerPreview) bannerPreview.style.display = "none";
      if (bannerPlaceholder) bannerPlaceholder.style.display = "block";
      if (bannerUploadArea) bannerUploadArea.classList.remove("has-image");
    }
  }

  const imageInput = document.getElementById("modalProgramImage");
  if (imageInput) imageInput.value = "";
  if (addJobForm) delete addJobForm.dataset.removeImage;

  if (addJobModalTitle)
    addJobModalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Program';
  if (addJobSubmitBtn)
    addJobSubmitBtn.innerHTML = '<i class="fas fa-save"></i> Update Program';

  await openAddJobModal(true);
}

window.openEditProgramModal = openAddJobModalForEdit;

function showAddJobMessage(text, type) {
  if (!addJobFormMessage) {
    console.error(text);
    return;
  }
  addJobFormMessage.textContent = text;
  addJobFormMessage.className = "add-job-form-message " + type;
  addJobFormMessage.classList.remove("hidden");
}

function getValue(id) {
  const el = document.getElementById(id);
  if (!el) {
    return "";
  }
  return el.value.trim();
}

// --- Event Listeners ---
if (openAddJobModalBtn)
  openAddJobModalBtn.addEventListener("click", openAddJobModal);
if (addJobModalClose)
  addJobModalClose.addEventListener("click", closeAddJobModal);
if (addJobModal) {
  addJobModal.addEventListener("click", (e) => {
    if (e.target === addJobModal) closeAddJobModal();
  });
}

// Toggle 'Other' Input
if (programTypeSelect) {
  programTypeSelect.addEventListener("change", (e) => {
    if (e.target.value === "Other") {
      if (customProgramContainer)
        customProgramContainer.style.display = "block";
      if (customProgramInput) {
        customProgramInput.setAttribute("required", "true");
        customProgramInput.focus();
      }
    } else {
      if (customProgramContainer) customProgramContainer.style.display = "none";
      if (customProgramInput) {
        customProgramInput.removeAttribute("required");
        customProgramInput.value = "";
      }
    }
  });
}

// Clear Logic
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    addJobForm.reset();
    if (customProgramContainer) customProgramContainer.style.display = "none";
    if (customProgramInput) customProgramInput.removeAttribute("required");
    if (editProgramIdInput) editProgramIdInput.value = "";
    delete addJobForm?.dataset?.editImageUrl;
    delete addJobForm?.dataset?.removeImage;
    if (typeof window.setProgramFormImagePreview === "function") {
      window.setProgramFormImagePreview("");
    }
    resetAddJobModalToAddMode();
  });
}

// --- MAIN SUBMIT LOGIC ---
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

// Store form submission function
let pendingFormSubmit = null;

async function performFormSubmit() {
  const editId = editProgramIdInput ? editProgramIdInput.value.trim() : "";

  if (addJobFormMessage) addJobFormMessage.classList.add("hidden");

  if (addJobSubmitBtn) {
    addJobSubmitBtn.disabled = true;
    const isEdit = editProgramIdInput && editProgramIdInput.value.trim();
    addJobSubmitBtn.innerHTML = isEdit
      ? '<span class="spinner-inline"></span> Updating...'
      : '<span class="spinner-inline"></span> Publishing...';
  }

  try {
    // 1. Get Image File
    const imageInput = document.getElementById("modalProgramImage");
    const imageFile =
      imageInput && imageInput.files ? imageInput.files[0] : null;

    // 2. Get Form Values
    let programType = getValue("modalProgramType");
    const description = getValue("modalDescription");
    const contactInfo = getValue("modalContactInfo");
    const rawDeadline = getValue("modalDeadline"); // This is yyyy-mm-dd
    const contactPerson = getValue("modalContactPerson");

    // 3. Validation
    if (!programType) throw new Error("Please select a program type.");

    // Logic for 'Other' Program Type (only add to otherPrograms when creating new)
    if (programType === "Other") {
      const customType = getValue("modalCustomProgramType");
      if (!customType)
        throw new Error("Please specify the custom program name.");

      programType = customType;

      // Save custom program to 'otherPrograms' collection only when adding new (not editing)
      if (!editId) {
        await addDoc(collection(db, OTHER_PROGRAMS_COLLECTION), {
          programName: customType,
          createdAt: serverTimestamp(),
          createdBy: "admin",
        });
      }
    }

    if (!description) throw new Error("Please enter program description.");
    if (!contactInfo) throw new Error("Please enter contact info.");

    let imageUrl = "";
    const existingImageUrl =
      editId && addJobForm.dataset.editImageUrl
        ? addJobForm.dataset.editImageUrl
        : "";
    const removeImage = addJobForm.dataset.removeImage === "true";

    // 4. Cloudinary Upload (or keep existing image when editing, or clear if removed)
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
      const data = await response.json();
      imageUrl = data.secure_url;
    } else if (editId && existingImageUrl) {
      imageUrl = existingImageUrl;
    }

    // 5. Format Date (YYYY-MM-DD -> Month DD, YYYY)
    let formattedDeadline = null;
    if (rawDeadline) {
      const dateObj = new Date(rawDeadline);
      // Check if date is valid
      if (!isNaN(dateObj)) {
        // Options: "February 2, 2026"
        const options = { year: "numeric", month: "long", day: "numeric" };
        formattedDeadline = dateObj.toLocaleDateString("en-US", options);
      } else {
        formattedDeadline = rawDeadline; // Fallback if invalid
      }
    }

    // 6. Create Data Object
    const programData = {
      programType,
      description,
      contactInfo,
      deadline: formattedDeadline, // Storing "February 2, 2026"
      contactPerson: contactPerson || null,
      status: "active",
      applicantsCount: 0,
      jobProgramImage: imageUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (editId) {
      // Update existing program (exclude createdAt and applicantsCount to preserve)
      const { createdAt: _, applicantsCount: __, ...updateData } = programData;
      await updateDoc(doc(db, JOB_PROGRAMS_COLLECTION, editId), {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
      showAddJobMessage("Program updated successfully!", "success");
      // Show toast immediately after save completes
      if (typeof window.showToast === "function") {
        window.showToast("Saved changes", "success");
      }
    } else {
      // Create new program
      const ref = await addDoc(
        collection(db, JOB_PROGRAMS_COLLECTION),
        programData,
      );
      showAddJobMessage("Service published successfully!", "success");
      // Show toast immediately after save completes
      if (typeof window.showToast === "function") {
        window.showToast("Program added successfully!", "success");
      }
      notifyProgramAdded({
        type: "job",
        name: programData.programType,
        id: ref.id,
      }).catch(() => {});
    }

    if (clearBtn) clearBtn.click();
    else addJobForm.reset();
    if (editProgramIdInput) editProgramIdInput.value = "";
    resetAddJobModalToAddMode();

    setTimeout(closeAddJobModal, 1200);

    // Refresh programs list silently (no loading overlay - toast acts as the indicator)
    if (typeof window.fetchPrograms === "function") {
      setTimeout(() => {
        window.fetchPrograms(true); // Pass true to skip loading overlay
      }, 500);
    }
  } catch (err) {
    console.error("Submission Error:", err);
    showAddJobMessage(err.message || "An unknown error occurred", "error");
  } finally {
    if (addJobSubmitBtn) {
      addJobSubmitBtn.disabled = false;
      addJobSubmitBtn.innerHTML =
        '<i class="fas fa-paper-plane"></i> Publish Program';
    }
  }
}

if (addJobForm) {
  addJobForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Submit button clicked...");

    const editId = editProgramIdInput ? editProgramIdInput.value.trim() : "";

    // Show confirmation modal for updates
    if (editId) {
      if (saveChangesModal) {
        pendingFormSubmit = performFormSubmit;
        saveChangesModal.classList.add("open");
      } else {
        // Fallback to confirm if modal not found
        const confirmed = confirm("Save changes to this program?");
        if (!confirmed) return;
        await performFormSubmit();
      }
    } else {
      // Create new - no confirmation needed
      await performFormSubmit();
    }
  });
}

if (saveChangesConfirmBtn) {
  saveChangesConfirmBtn.addEventListener("click", async () => {
    if (!pendingFormSubmit) return;
    const btn = saveChangesConfirmBtn;
    const icon = btn?.querySelector("i");
    const text = btn?.querySelector(".btn-text");
    btn.disabled = true;
    if (icon) icon.className = "fas fa-spinner fa-spin";
    if (text) text.textContent = "Saving...";

    try {
      await pendingFormSubmit();
      if (saveChangesModal) saveChangesModal.classList.remove("open");
    } finally {
      btn.disabled = false;
      if (icon) icon.className = "fas fa-save";
      if (text) text.textContent = "Save Changes";
      pendingFormSubmit = null;
    }
  });
}
