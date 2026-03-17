document.addEventListener("DOMContentLoaded", function () {
  const modalProgramImage = document.getElementById("modalProgramImage");
  const bannerPreview = document.getElementById("bannerPreview");
  const bannerPlaceholder = document.getElementById("bannerPlaceholder");
  const bannerUploadArea = document.getElementById("bannerUploadArea");
  const addJobClearBtn = document.getElementById("addJobClearBtn");
  const bannerRemoveImgBtn = document.getElementById("bannerRemoveImgBtn");
  const addJobForm = document.getElementById("addJobForm");

  function showPreview(src) {
    if (bannerPreview) {
      bannerPreview.src = src;
      bannerPreview.style.display = "block";
      bannerPreview.dataset.loaded = "1";
    }
    if (bannerPlaceholder) bannerPlaceholder.style.display = "none";
    if (bannerUploadArea) bannerUploadArea.classList.add("has-image");
    if (addJobForm) delete addJobForm.dataset.removeImage;
  }

  function hidePreview() {
    if (modalProgramImage) modalProgramImage.value = "";
    if (bannerPreview) {
      bannerPreview.src = "";
      bannerPreview.style.display = "none";
      delete bannerPreview.dataset.loaded;
    }
    if (bannerPlaceholder) bannerPlaceholder.style.display = "block";
    if (bannerUploadArea) bannerUploadArea.classList.remove("has-image");
    if (addJobForm) addJobForm.dataset.removeImage = "true";
  }

  // Show image when file is selected
  if (modalProgramImage) {
    modalProgramImage.addEventListener("change", function (event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          showPreview(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Remove image button (edit or after adding a file)
  if (bannerRemoveImgBtn) {
    bannerRemoveImgBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      hidePreview();
    });
  }

  // Reset preview when Clear button is clicked
  if (addJobClearBtn) {
    addJobClearBtn.addEventListener("click", function () {
      hidePreview();
    });
  }

  // Expose for add_program.js when opening edit (clear remove flag when setting image)
  window.setProgramFormImagePreview = function (url) {
    if (url) showPreview(url);
    else hidePreview();
  };
});
