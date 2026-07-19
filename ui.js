/* =========================================
   MIKI UNIVERSE — AUTH UI (no Firebase here)
   Modal open/close/tab-switching lives here, completely
   independent from Firebase. This guarantees every button
   still responds even if auth.js / Firebase fails to load
   (bad config, blocked CDN, no internet, etc).
   auth.js overwrites the Firebase-dependent functions below
   once it finishes loading successfully.
   ========================================= */

function $(id) { return document.getElementById(id); }
function openModal(id) { $(id)?.classList.add("active"); }
function closeModal(id) { $(id)?.classList.remove("active"); }

window.__mikiAuthState = { currentUser: null, currentProfile: null };
window.__mikiEditingProfile = false;

function onAccountBtnClick() {
  if (window.__mikiAuthState.currentUser) openProfileModal();
  else openAuthModal();
}

function openAuthModal() {
  ["googleAuthError", "guestAuthError", "adminAuthError"].forEach(id => { if ($(id)) $(id).textContent = ""; });
  openModal("authModal");
}
function closeAuthModal() { closeModal("authModal"); }

function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".auth-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === tab));
}

function openProfileModal() {
  window.__mikiRenderProfileModal?.();
  openModal("profileModal");
}
function closeProfileModal() {
  closeModal("profileModal");
  cancelProfileEdit();
}

function openAdminPanel() {
  if (window.__mikiAuthState.currentProfile?.role !== "admin") return;
  closeModal("profileModal");
  window.location.href = "/admin";
}
function closeAdminModal() { closeModal("adminModal"); }

function toggleProfileEdit() {
  window.__mikiEditingProfile = !window.__mikiEditingProfile;
  const editing = window.__mikiEditingProfile;
  $("profileNameView").style.display = editing ? "none" : "block";
  $("profileNameInput").style.display = editing ? "block" : "none";
  $("profileAvatarEditBtn").style.display = editing ? "flex" : "none";
  $("profileEditBtn").style.display = editing ? "none" : "block";
  $("profileSaveBtn").style.display = editing ? "block" : "none";
  if (!editing) { window.__mikiStagedAvatar = null; window.__mikiRenderProfileModal?.(); }
}

function cancelProfileEdit() {
  if (!window.__mikiEditingProfile) return;
  window.__mikiEditingProfile = false;
  window.__mikiStagedAvatar = null;
  $("profileNameView").style.display = "block";
  $("profileNameInput").style.display = "none";
  $("profileAvatarEditBtn").style.display = "none";
  $("profileEditBtn").style.display = "block";
  $("profileSaveBtn").style.display = "none";
}

/* close modal when tapping the dark backdrop */
document.addEventListener("DOMContentLoaded", () => {
  ["authModal", "profileModal"].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener("click", (e) => { if (e.target === el) closeModal(id); });
  });
});

/* ---------- placeholders for Firebase-dependent actions ----------
   auth.js overwrites every one of these once it loads successfully.
   If auth.js fails (bad config, blocked network, etc), clicking still
   gives the user a clear message instead of doing nothing at all. */
const MIKI_FIREBASE_NOT_READY = "Sistem login gagal dimuat. Coba refresh halaman, atau cek koneksi internet lu.";
[
  "loginGoogle", "loginGuest",
  "onAvatarFileChange", "saveProfile", "adminSearchUser", "adminSaveTitle",
  "adminToggleRole", "adminTogglePremium", "adminToggleHdFeature", "logoutUser",
  "onPresetPhotoChange", "submitPresetPost", "deletePresetPost",
  "togglePresetEdit", "savePresetEdit"
].forEach(name => {
  window[name] = function () { alert(MIKI_FIREBASE_NOT_READY); };
});

/* expose helpers for window assignment */
Object.assign(window, {
  onAccountBtnClick, openAuthModal, closeAuthModal, switchAuthTab,
  openProfileModal, closeProfileModal, openAdminPanel, closeAdminModal,
  toggleProfileEdit, cancelProfileEdit
});
