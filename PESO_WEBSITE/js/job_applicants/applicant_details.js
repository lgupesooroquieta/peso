import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth, db } from "/js/config/firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Auth guard ───────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "/pages/login/login.html"; return; }
  document.documentElement.classList.remove("auth-pending");
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadApplicantDetails);
  } else {
    loadApplicantDetails();
  }
});

// ── Load from Firestore ──────────────────────────────────────
function loadApplicantDetails() {
  const docPath = new URLSearchParams(window.location.search).get("ref");
  if (!docPath) { alert("Error: No document reference found. Please open this from the applicants list."); return; }
  (async () => {
    try {
      const segs = docPath.split("/").filter(Boolean);
      const docRef = segs.length ? doc(db, ...segs) : null;
      if (!docRef) { alert("Invalid document path."); return; }
      const snap = await getDoc(docRef);
      if (snap.exists()) { populateForm(snap.data()); }
      else { alert("Applicant document not found!"); }
    } catch (e) { console.error("Error fetching applicant:", e); }
  })();
}

// ── Populate ─────────────────────────────────────────────────
function populateForm(data) {
  // Unlock all checkboxes except PESO-only section
  const PESO_IDS = new Set([
    "checkPesoSpes","checkPesoDileep","checkPesoGip",
    "checkPesoTesda","checkPesoTupad","checkPesoJobStart","checkPesoOther",
  ]);
  document.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    if (cb.id && PESO_IDS.has(cb.id)) { cb.disabled = true; cb.checked = false; }
    else { cb.disabled = false; cb.style.pointerEvents = "none"; cb.style.accentColor = "#333"; }
  });

  // Helpers
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v || ""; };
  const chk = (id, v) => { const e = document.getElementById(id); if (e) e.checked = !!v; };

  // ── Service ──────────────────────────────────────────────
  const svc = data.serviceApplied || data.jobServiceApplied || data.jobProgramName || data.jobProgram || "";
  set("viewServiceApplied", svc);

  // ── I. Personal info ─────────────────────────────────────
  set("viewSurname",    data.surname);
  set("viewFirstName",  data.firstName);
  set("viewMiddleName", data.middleName);
  set("viewSuffix",     data.suffix !== "None" ? data.suffix : "");
  set("viewDob",        data.dateOfBirth);
  set("viewReligion",   data.religion);
  chk("checkMale",      data.sex === "Male");
  chk("checkFemale",    data.sex === "Female");
  chk("checkSingle",    data.civilStatus === "Single");
  chk("checkMarried",   data.civilStatus === "Married");
  chk("checkWidowed",   data.civilStatus === "Widowed");
  chk("checkSeparated", data.civilStatus === "Separated");
  set("viewHouse",    data.addressHouse);
  set("viewBarangay", data.addressCity);
  set("viewCity",     data.addressProvince);
  set("viewProvince", "Misamis Occidental");
  set("viewTin",      data.tin);
  set("viewHeight",   data.height);
  set("viewContact",  data.contactNumber);
  set("viewEmail",    data.email);

  // Disability
  if (data.disabilityFull) {
    chk("checkDisVisual",   data.disabilityFull.Visual);
    chk("checkDisSpeech",   data.disabilityFull.Speech);
    chk("checkDisMental",   data.disabilityFull.Mental);
    chk("checkDisHearing",  data.disabilityFull.Hearing);
    chk("checkDisPhysical", data.disabilityFull.Physical);
  }
  const disOther = data.disabilityOther || data.disabilitySpecify || data.disability_other ||
    (data.disabilityFull && typeof data.disabilityFull.Others === "string" ? data.disabilityFull.Others : null);
  set("viewDisOther", disOther);
  if (disOther && String(disOther).trim()) chk("checkDisOther", true);

  // ── Employment ───────────────────────────────────────────
  const isEmployed = data.employed === true;
  chk("checkEmployed",   isEmployed);
  chk("checkUnemployed", !isEmployed);
  set("viewMonthsLooking", data.monthsLooking);

  if (data.employedTypeFull) {
    const e = data.employedTypeFull;
    chk("checkEmpWage",      e["Wage employed"]);
    chk("checkEmpSelf",      e["Self-employed (please specify)"]);
    chk("checkEmpFish",      e["Fisherman/Fisherfolk"]);
    chk("checkEmpVendor",    e["Vendor/Retailer"]);
    chk("checkEmpHome",      e["Home-based worker"]);
    chk("checkEmpTransport", e["Transport"]);
    chk("checkEmpDomestic",  e["Domestic Worker"]);
    chk("checkEmpFreelance", e["Freelancer"]);
    chk("checkEmpArtisan",   e["Artisan/Craft Worker"]);
    chk("checkEmpOther",     e["Others (please specify)"]);
  }
  set("viewEmpOther", data.employedOther);

  if (data.unemployedTypeFull) {
    const u = data.unemployedTypeFull;
    chk("checkUnempNew",        u["New entrant/Fresh graduate"]);
    chk("checkUnempTermLocal",  u["Terminated/laid off (local)"]);
    chk("checkUnempContract",   u["Finished contract"]);
    chk("checkUnempTermAbroad", u["Terminated/laid off (abroad)"]);
    chk("checkUnempResigned",   u["Resigned"]);
    chk("checkUnempRetired",    u["Retired"]);
    chk("checkUnempCalamity",   u["Terminated/laid off due to calamity"]);
    chk("checkUnempOther",      u["Others (please specify)"]);
  }
  set("viewUnempOther",   data.unemployedOther);
  set("viewUnempCountry", data.terminatedAbroadCountry || data.unempTermAbroadCountry);

  // ── OFW / 4Ps ────────────────────────────────────────────
  chk("checkOfwYes",       data.isOfw === true);
  chk("checkOfwNo",        data.isOfw === false);
  set("viewOfwCountry",    data.ofwCountry);
  set("viewLatestCountry", data.ofwCountry);
  chk("checkFormerOfwYes", data.isFormerOfw === true);
  chk("checkFormerOfwNo",  data.isFormerOfw === false);
  set("viewOfwReturn",     data.formerOfwReturnDate);
  chk("check4psYes",       data.is4Ps === true);
  chk("check4psNo",        data.is4Ps === false);
  set("view4psId",         data.fourPsHouseholdId);

  // ── Job preference ───────────────────────────────────────
  chk("checkJobFullTime",  data.fullTime === true);
  chk("checkJobPartTime",  data.partTime === true);
  chk("checkLocLocal",     data.preferredLocal === true);
  chk("checkLocOverseas",  data.preferredOverseas === true);
  if (Array.isArray(data.preferredOccupations)) {
    set("viewPrefOcc1", data.preferredOccupations[0]);
    set("viewPrefOcc2", data.preferredOccupations[1]);
    set("viewPrefOcc3", data.preferredOccupations[2]);
  }
  if (Array.isArray(data.preferredLocations)) {
    set("viewPrefLoc1", data.preferredLocations[0]);
    set("viewPrefLoc2", data.preferredLocations[1]);
    set("viewPrefLoc3", data.preferredLocations[2]);
  }

  // ── Language ─────────────────────────────────────────────
  if (data.languageProficiency) {
    const lp = data.languageProficiency;
    const ml = (key, px) => {
      if (!lp[key]) return;
      chk(`${px}Read`, lp[key].read); chk(`${px}Write`, lp[key].write);
      chk(`${px}Speak`, lp[key].speak); chk(`${px}Understand`, lp[key].understand);
    };
    ml("English", "checkLangEng"); ml("Filipino", "checkLangFil"); ml("Mandarin", "checkLangMan");
    if (lp.Others) {
      set("viewLangOther", lp.Others.specify);
      chk("checkLangOtherRead", lp.Others.read); chk("checkLangOtherWrite", lp.Others.write);
      chk("checkLangOtherSpeak", lp.Others.speak); chk("checkLangOtherUnderstand", lp.Others.understand);
    }
  }

  // ── Education ────────────────────────────────────────────
  chk("checkSchoolYes", data.currentlyInSchool === true);
  chk("checkSchoolNo",  data.currentlyInSchool === false);
  const edu = data.education || [];
  const setEdu = (px, row) => {
    if (!row) return;
    set(`view${px}Course`,   row.course);
    set(`view${px}Year`,     row.yearGraduated);
    set(`view${px}Level`,    row.levelReached);
    set(`view${px}LastYear`, row.yearLastAttended);
  };
  setEdu("Elem", edu.find(e => e.level === "Elementary"));
  const secNK = edu.find(e => e.level && e.level.includes("Non-K12"));
  if (secNK) { chk("checkSecNonK12", true); setEdu("Sec", secNK); }
  const secK = edu.find(e => e.level && e.level.includes("K-12"));
  if (secK)  { chk("checkSecK12", true); set("viewSeniorHighStrand", secK.course); setEdu("Sec", secK); }
  setEdu("Tert", edu.find(e => e.level === "Tertiary"));
  setEdu("Grad", edu.find(e => e.level && e.level.includes("Graduate")));

  // ── Training ─────────────────────────────────────────────
  (data.training || []).slice(0, 3).forEach((t, i) => {
    const n = i + 1;
    set(`viewTrainCourse${n}`, t.course); set(`viewTrainHours${n}`, t.hours);
    set(`viewTrainInst${n}`,   t.institution); set(`viewTrainSkill${n}`, t.skills);
    set(`viewTrainCert${n}`,   t.certificates);
  });

  // ── Eligibility ──────────────────────────────────────────
  (data.eligibility || []).slice(0, 2).forEach((e, i) => {
    const n = i + 1;
    set(`viewElig${n}`,     e.eligibility); set(`viewEligDate${n}`, e.dateTaken);
    set(`viewPrc${n}`,      e.professionalLicense); set(`viewPrcValid${n}`, e.validUntil);
  });

  // ── Work experience ──────────────────────────────────────
  (data.workExperience || []).slice(0, 4).forEach((w, i) => {
    const n = i + 1;
    set(`viewWorkComp${n}`,   w.company); set(`viewWorkAddr${n}`, w.address);
    set(`viewWorkPos${n}`,    w.position); set(`viewWorkMonths${n}`, w.months);
    set(`viewWorkStat${n}`,   w.status);
  });

  // ── Other skills ─────────────────────────────────────────
  if (data.otherSkillsFull) {
    const s = data.otherSkillsFull;
    chk("checkSkillAuto",        s["AUTO MECHANIC"]);
    chk("checkSkillBeautician",  s["BEAUTICIAN"]);
    chk("checkSkillCarpentry",   s["CARPENTRY WORK"]);
    chk("checkSkillComputer",    s["COMPUTER LITERATE"]);
    chk("checkSkillDomestic",    s["DOMESTIC CHORES"]);
    chk("checkSkillDriver",      s["DRIVER"]);
    chk("checkSkillElectrician", s["ELECTRICIAN"]);
    chk("checkSkillEmbroidery",  s["EMBROIDERY"]);
    chk("checkSkillGardening",   s["GARDENING"]);
    chk("checkSkillMasonry",     s["MASONRY"]);
    chk("checkSkillPainter",     s["PAINTER/ARTIST"]);
    chk("checkSkillPaintingJobs",s["PAINTING JOBS"]);
    chk("checkSkillPhotography", s["PHOTOGRAPHY"]);
    chk("checkSkillPlumbing",    s["PLUMBING"]);
    chk("checkSkillSewing",      s["SEWING DRESSES"]);
    chk("checkSkillStenography", s["STENOGRAPHY"]);
    chk("checkSkillTailoring",   s["TAILORING"]);
    if (data.otherSkillsSpecify) { chk("checkSkillOther", true); set("viewSkillOther", data.otherSkillsSpecify); }
  }

  // ── Signature ────────────────────────────────────────────
  let sig = data.signatureBase64 || data.applicantSignature || data.signature ||
    (typeof data.signatureImage === "string" ? data.signatureImage : null) ||
    (data.signature && typeof data.signature === "object"
      ? data.signature.base64 || data.signature.url || data.signature.image : null);
  if (sig && typeof sig !== "string") sig = null;
  if (sig) {
    const s = sig.trim();
    if (!s.startsWith("data:") && !s.startsWith("http")) sig = "data:image/png;base64," + s;
  }
  const sigEl = document.getElementById("viewSigApp");
  if (sigEl) {
    sigEl.innerHTML = "";
    if (sig) {
      const img = document.createElement("img");
      img.src = sig; img.alt = "Applicant signature";
      img.style.cssText = "max-height:34px;height:auto;max-width:100%;object-fit:contain;display:block;margin:0 auto;";
      img.onerror = () => { img.style.display = "none"; };
      sigEl.appendChild(img);
    }
  }
  set("viewSigDate",   data.certificationDate);
  set("viewPesoOther", ""); set("viewAssessor", ""); set("viewAssessDate", "");

  // ── Collapse empty sections ──────────────────────────────
  collapseEmpty();
}

// ── Smart collapsing ─────────────────────────────────────────
function collapseEmpty() {
  const PESO_IDS = new Set([
    "checkPesoSpes","checkPesoDileep","checkPesoGip",
    "checkPesoTesda","checkPesoTupad","checkPesoJobStart","checkPesoOther",
  ]);

  const el   = (id) => document.getElementById(id);
  const txt  = (id) => { const e = el(id); return !!(e && e.textContent.trim()); };
  const on   = (id) => { const e = el(id); return !!(e && e.checked); };
  const hide = (id, cls = "empty-row") => { const e = el(id); if (e) e.classList.add(cls); };
  const hideEl = (e, cls = "empty-row") => { if (e) e.classList.add(cls); };

  // 1. Service badge
  if (!txt("viewServiceApplied")) hide("sectionServiceType", "empty-block");

  // 2. Disability block — hide if nothing checked and no text
  const hasDis = on("checkDisVisual") || on("checkDisSpeech") || on("checkDisMental") ||
                 on("checkDisHearing") || on("checkDisPhysical") || on("checkDisOther") || txt("viewDisOther");
  if (!hasDis) hide("sectionDisability", "empty-block");

  // 3. Employment columns
  //    When one column gets empty-col (display:none), the flex sibling fills 100% automatically
  if (!on("checkEmployed"))   hide("colEmployed",   "empty-col");
  if (!on("checkUnemployed")) hide("colUnemployed", "empty-col");

  // Hide sub-items inside unemployment column
  if (!on("checkUnempTermAbroad")) { const w = el("wrapperUnempCountry"); if (w) w.style.display = "none"; }
  if (!txt("viewUnempOther"))      { const w = el("wrapperUnempOther");   if (w) w.style.display = "none"; }

  // Hide unchecked employed-type labels
  if (on("checkEmployed")) {
    el("colEmployed")?.querySelectorAll(".emp-types label").forEach((lbl) => {
      const cb = lbl.querySelector("input");
      if (cb && !cb.checked) hideEl(lbl);
    });
  }

  // Hide unchecked unemployed-type labels/divs
  if (on("checkUnemployed")) {
    el("colUnemployed")?.querySelectorAll(".unemp-types label, .unemp-types > div").forEach((node) => {
      const cb = node.querySelector("input[type='checkbox']");
      if (!cb) return;
      if (!cb.checked && cb.id !== "checkUnempTermAbroad") hideEl(node);
    });
  }

  // 4. OFW row
  const hasOfw = on("checkOfwYes") || on("checkFormerOfwYes") ||
    txt("viewOfwCountry") || txt("viewLatestCountry") || txt("viewOfwReturn");
  if (!hasOfw) hide("sectionOfw", "empty-block");

  // 5. 4Ps row
  if (!on("check4psYes")) hide("section4ps", "empty-block");

  // 6. Job preference rows
  if (!txt("viewPrefOcc1") && !txt("viewPrefLoc1")) hide("rowPref1");
  if (!txt("viewPrefOcc2") && !txt("viewPrefLoc2")) hide("rowPref2");
  if (!txt("viewPrefOcc3") && !txt("viewPrefLoc3")) hide("rowPref3");

  // 7. Language rows
  const langOn = (px) => on(`${px}Read`) || on(`${px}Write`) || on(`${px}Speak`) || on(`${px}Understand`);
  if (!langOn("checkLangEng"))   hide("rowLangEng");
  if (!langOn("checkLangFil"))   hide("rowLangFil");
  if (!langOn("checkLangMan"))   hide("rowLangMan");
  if (!txt("viewLangOther") && !langOn("checkLangOther")) hide("rowLangOther");

  // 8. Currently in school row
  if (!on("checkSchoolYes") && !on("checkSchoolNo")) hide("rowCurrentlyInSchool");

  // 9. Education rows
  const hasElem = txt("viewElemCourse") || txt("viewElemYear") || txt("viewElemLevel") || txt("viewElemLastYear");
  const hasSec  = on("checkSecNonK12") || on("checkSecK12") || txt("viewSecYear") || txt("viewSeniorHighStrand");
  const hasTert = txt("viewTertCourse") || txt("viewTertYear") || txt("viewTertLevel") || txt("viewTertLastYear");
  const hasGrad = txt("viewGradCourse") || txt("viewGradYear") || txt("viewGradLevel") || txt("viewGradLastYear");
  if (!hasElem) hide("rowElem");
  if (!hasSec)  hide("rowSec");
  if (!hasTert) hide("rowTert");
  if (!hasGrad) hide("rowGrad");
  if (!hasElem && !hasSec && !hasTert && !hasGrad && !on("checkSchoolYes") && !on("checkSchoolNo")) {
    hide("sectionEducationHeader", "empty-block"); hide("sectionEducation", "empty-block");
  }

  // 10. Training rows
  const trainOn = (n) => txt(`viewTrainCourse${n}`) || txt(`viewTrainHours${n}`) ||
    txt(`viewTrainInst${n}`) || txt(`viewTrainSkill${n}`) || txt(`viewTrainCert${n}`);
  if (!trainOn(1)) hide("rowTrain1");
  if (!trainOn(2)) hide("rowTrain2");
  if (!trainOn(3)) hide("rowTrain3");
  if (!trainOn(1) && !trainOn(2) && !trainOn(3)) {
    hide("sectionTrainingHeader", "empty-block"); hide("sectionTraining", "empty-block");
  }

  // 11. Eligibility rows
  const eligOn = (n) => txt(`viewElig${n}`) || txt(`viewEligDate${n}`) || txt(`viewPrc${n}`) || txt(`viewPrcValid${n}`);
  if (!eligOn(1)) hide("rowElig1");
  if (!eligOn(2)) hide("rowElig2");
  if (!eligOn(1) && !eligOn(2)) {
    hide("sectionEligibilityHeader", "empty-block"); hide("sectionEligibility", "empty-block");
  }

  // 12. Work experience rows
  const workOn = (n) => txt(`viewWorkComp${n}`) || txt(`viewWorkAddr${n}`) ||
    txt(`viewWorkPos${n}`) || txt(`viewWorkMonths${n}`) || txt(`viewWorkStat${n}`);
  if (!workOn(1)) hide("rowWork1");
  if (!workOn(2)) hide("rowWork2");
  if (!workOn(3)) hide("rowWork3");
  if (!workOn(4)) hide("rowWork4");
  if (!workOn(1) && !workOn(2) && !workOn(3) && !workOn(4)) {
    hide("sectionWorkHeader", "empty-block"); hide("sectionWork", "empty-block");
  }

  // 13. Other skills — hide unchecked labels; hide whole section if nothing checked
  const SKILL_IDS = [
    "checkSkillAuto","checkSkillBeautician","checkSkillCarpentry","checkSkillComputer",
    "checkSkillDomestic","checkSkillDriver","checkSkillElectrician","checkSkillEmbroidery",
    "checkSkillGardening","checkSkillMasonry","checkSkillPainter","checkSkillPaintingJobs",
    "checkSkillPhotography","checkSkillPlumbing","checkSkillSewing","checkSkillStenography",
    "checkSkillTailoring","checkSkillOther",
  ];
  const hasSkill = SKILL_IDS.some(on) || txt("viewSkillOther");
  if (!hasSkill) {
    hide("sectionOtherSkillsHeader", "empty-block");
    hide("sectionOtherSkills", "empty-block");
  } else {
    // Hide individual unchecked skill labels so checked ones reflow in the grid
    el("sectionOtherSkills")?.querySelectorAll("label").forEach((lbl) => {
      const cb = lbl.querySelector("input[type='checkbox']");
      if (cb && !cb.checked) hideEl(lbl);
    });
  }
}