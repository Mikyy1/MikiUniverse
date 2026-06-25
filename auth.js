/* =========================================
   MIKI UNIVERSE — AUTH & PROFILE (Firebase)
   Login Google / Email / Guest / Admin.
   Tiap user punya dokumen sendiri di Firestore: users/{uid}
   ========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp,
  collection, query, where, getDocs, limit
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { firebaseConfig, BOOTSTRAP_ADMIN_EMAILS } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentProfile = null;
let unsubProfile = null;
let emailMode = "masuk";
let editingProfile = false;
let stagedAvatarDataURL = null;
let adminFoundUid = null;

/* ---------- helpers ---------- */
function $(id) { return document.getElementById(id); }
function escapeAttr(str) { return String(str).replace(/"/g, "&quot;"); }

function openModal(id) { $(id)?.classList.add("active"); }
function closeModal(id) { $(id)?.classList.remove("active"); }

function friendlyAuthError(e) {
  const map = {
    "auth/email-already-in-use": "Email ini udah dipakai. Coba tab Masuk.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/wrong-password": "Email atau password salah.",
    "auth/user-not-found": "Email atau password salah.",
    "auth/weak-password": "Password terlalu lemah, minimal 6 karakter.",
    "auth/invalid-email": "Format email nggak valid.",
    "auth/popup-closed-by-user": "Login dibatalkan.",
    "auth/network-request-failed": "Koneksi gagal, cek internet lu.",
    "auth/too-many-requests": "Kebanyakan percobaan. Coba lagi nanti."
  };
  return map[e?.code] || (e?.message || "Terjadi kesalahan, coba lagi.");
}

function compressImageToDataURL(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        } else {
          if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- ensure / fetch the per-user Firestore document ---------- */
async function ensureUserDoc(user, opts = {}) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const isBootstrapAdmin = !!(user.email && BOOTSTRAP_ADMIN_EMAILS.includes(user.email));

  if (!snap.exists()) {
    const base = {
      displayName:
        opts.displayNameOverride ||
        user.displayName ||
        (opts.provider === "guest" ? ("Tamu" + Math.floor(1000 + Math.random() * 9000)) : (user.email ? user.email.split("@")[0] : "User")),
      photoURL: user.photoURL || "",
      email: user.email || null,
      provider: opts.provider || "email",
      title: null,
      role: isBootstrapAdmin ? "admin" : "user",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, base);
    return base;
  }

  const data = snap.data();
  if (isBootstrapAdmin && data.role !== "admin") {
    await updateDoc(ref, { role: "admin", updatedAt: serverTimestamp() });
    data.role = "admin";
  }
  return data;
}

/* ---------- auth state ---------- */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (unsubProfile) { unsubProfile(); unsubProfile = null; }

  if (user) {
    const ref = doc(db, "users", user.uid);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      const providerId = user.providerData[0]?.providerId;
      await ensureUserDoc(user, {
        provider: user.isAnonymous ? "guest" : (providerId === "google.com" ? "google" : "email")
      });
    }
    unsubProfile = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        currentProfile = snap.data();
        renderHeaderAccount();
        if ($("profileModal")?.classList.contains("active")) renderProfileModal();
      }
    });
  } else {
    currentProfile = null;
    renderHeaderAccount();
  }
});

/* ---------- header account button ---------- */
function renderHeaderAccount() {
  const btn = $("accountBtn");
  if (!btn) return;
  if (currentUser && currentProfile && currentProfile.photoURL) {
    btn.classList.add("has-avatar");
    btn.innerHTML = `<img class="account-btn-avatar-img" src="${escapeAttr(currentProfile.photoURL)}" alt="">`;
  } else {
    btn.classList.remove("has-avatar");
    btn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#icon-circle-user"></use></svg>`;
  }
}

function onAccountBtnClick() {
  if (currentUser) openProfileModal();
  else openAuthModal();
}

/* ---------- auth modal ---------- */
function openAuthModal() {
  ["googleAuthError", "emailAuthError", "guestAuthError", "adminAuthError"].forEach(id => { if ($(id)) $(id).textContent = ""; });
  openModal("authModal");
}
function closeAuthModal() { closeModal("authModal"); }

function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".auth-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === tab));
}

function switchEmailMode(mode) {
  emailMode = mode;
  document.querySelectorAll(".auth-subtab").forEach(b => b.classList.toggle("active", b.dataset.sub === mode));
  $("emailNicknameField").style.display = mode === "daftar" ? "flex" : "none";
  $("emailSubmitBtn").textContent = mode === "daftar" ? "Daftar" : "Masuk";
  $("emailAuthError").textContent = "";
}

async function loginGoogle() {
  const errEl = $("googleAuthError");
  errEl.textContent = "";
  try {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    await ensureUserDoc(cred.user, { provider: "google" });
    closeAuthModal();
  } catch (e) {
    errEl.textContent = friendlyAuthError(e);
  }
}

async function submitEmailAuth() {
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  const errEl = $("emailAuthError");
  errEl.textContent = "";
  if (!email || !password) { errEl.textContent = "Email & password wajib diisi."; return; }
  if (password.length < 6) { errEl.textContent = "Password minimal 6 karakter."; return; }
  try {
    if (emailMode === "daftar") {
      const nickname = $("emailNickname").value.trim() || email.split("@")[0];
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try { await updateProfile(cred.user, { displayName: nickname }); } catch (_) {}
      await ensureUserDoc(cred.user, { provider: "email", displayNameOverride: nickname });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    closeAuthModal();
  } catch (e) {
    errEl.textContent = friendlyAuthError(e);
  }
}

async function loginGuest() {
  const errEl = $("guestAuthError");
  errEl.textContent = "";
  try {
    const cred = await signInAnonymously(auth);
    await ensureUserDoc(cred.user, { provider: "guest" });
    closeAuthModal();
  } catch (e) {
    errEl.textContent = friendlyAuthError(e);
  }
}

async function submitAdminLogin() {
  const email = $("adminEmailInput").value.trim();
  const password = $("adminPasswordInput").value;
  const errEl = $("adminAuthError");
  errEl.textContent = "";
  if (!email || !password) { errEl.textContent = "Email & password wajib diisi."; return; }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await ensureUserDoc(cred.user, { provider: "email" });
    if (profile.role !== "admin") {
      await signOut(auth);
      errEl.textContent = "Akun ini bukan admin.";
      return;
    }
    closeAuthModal();
    openProfileModal();
    setTimeout(openAdminPanel, 250);
  } catch (e) {
    errEl.textContent = friendlyAuthError(e);
  }
}

/* ---------- profile modal ---------- */
function renderProfileModal() {
  if (!currentUser || !currentProfile) return;

  const img = $("profileAvatarImg");
  const fallback = $("profileAvatarFallback");
  if (currentProfile.photoURL) {
    img.src = currentProfile.photoURL; img.style.display = "block"; fallback.style.display = "none";
  } else {
    img.style.display = "none"; fallback.style.display = "block";
  }

  const titleBadge = $("profileTitleBadge");
  if (currentProfile.title) {
    $("profileTitleText").textContent = currentProfile.title;
    titleBadge.style.display = "flex";
  } else {
    titleBadge.style.display = "none";
  }

  $("profileNameView").textContent = currentProfile.displayName || "User";
  $("profileNameInput").value = currentProfile.displayName || "";

  const providerLabel = { google: "Google", email: "Email", guest: "Tamu" }[currentProfile.provider] || currentProfile.provider;
  $("profileMetaText").textContent = currentProfile.email
    ? `${currentProfile.email} · ${providerLabel}`
    : `Login sebagai ${providerLabel}`;

  const roleBadge = $("profileRoleBadge");
  const adminBtn = $("profileAdminBtn");
  const isAdmin = currentProfile.role === "admin";
  roleBadge.style.display = isAdmin ? "flex" : "none";
  adminBtn.style.display = isAdmin ? "block" : "none";

  $("profileError").textContent = "";
}

function openProfileModal() { renderProfileModal(); openModal("profileModal"); }
function closeProfileModal() { closeModal("profileModal"); cancelProfileEdit(); }

function toggleProfileEdit() {
  editingProfile = !editingProfile;
  $("profileNameView").style.display = editingProfile ? "none" : "block";
  $("profileNameInput").style.display = editingProfile ? "block" : "none";
  $("profileAvatarEditBtn").style.display = editingProfile ? "flex" : "none";
  $("profileEditBtn").style.display = editingProfile ? "none" : "block";
  $("profileSaveBtn").style.display = editingProfile ? "block" : "none";
  if (!editingProfile) { stagedAvatarDataURL = null; renderProfileModal(); }
}

function cancelProfileEdit() {
  if (!editingProfile) return;
  editingProfile = false;
  stagedAvatarDataURL = null;
  $("profileNameView").style.display = "block";
  $("profileNameInput").style.display = "none";
  $("profileAvatarEditBtn").style.display = "none";
  $("profileEditBtn").style.display = "block";
  $("profileSaveBtn").style.display = "none";
}

async function onAvatarFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const errEl = $("profileError");
  errEl.textContent = "";
  try {
    const dataUrl = await compressImageToDataURL(file, 256, 0.72);
    stagedAvatarDataURL = dataUrl;
    $("profileAvatarImg").src = dataUrl;
    $("profileAvatarImg").style.display = "block";
    $("profileAvatarFallback").style.display = "none";
  } catch (e) {
    errEl.textContent = "Gagal proses gambar. Coba foto lain.";
  }
}

async function saveProfile() {
  if (!currentUser) return;
  const errEl = $("profileError");
  errEl.textContent = "";
  const newName = $("profileNameInput").value.trim();
  if (!newName) { errEl.textContent = "Nickname nggak boleh kosong."; return; }
  if (newName.length > 24) { errEl.textContent = "Nickname maksimal 24 karakter."; return; }
  try {
    const updates = { displayName: newName, updatedAt: serverTimestamp() };
    if (stagedAvatarDataURL) updates.photoURL = stagedAvatarDataURL;
    await updateDoc(doc(db, "users", currentUser.uid), updates);
    try { await updateProfile(currentUser, { displayName: newName }); } catch (_) {}
    stagedAvatarDataURL = null;
    toggleProfileEdit();
  } catch (e) {
    errEl.textContent = "Gagal simpan. Coba lagi.";
  }
}

async function logoutUser() {
  try {
    await signOut(auth);
    closeModal("profileModal");
    closeModal("adminModal");
  } catch (_) {}
}

/* ---------- admin panel ---------- */
function openAdminPanel() {
  if (currentProfile?.role !== "admin") return;
  closeModal("profileModal");
  $("adminResultBox").style.display = "none";
  $("adminSearchError").textContent = "";
  openModal("adminModal");
}
function closeAdminModal() { closeModal("adminModal"); }

async function adminSearchUser() {
  const email = $("adminSearchEmail").value.trim();
  const errEl = $("adminSearchError");
  const box = $("adminResultBox");
  errEl.textContent = "";
  box.style.display = "none";
  adminFoundUid = null;
  if (!email) { errEl.textContent = "Isi email dulu."; return; }
  try {
    const q = query(collection(db, "users"), where("email", "==", email), limit(1));
    const snaps = await getDocs(q);
    if (snaps.empty) { errEl.textContent = "User nggak ketemu."; return; }
    const docSnap = snaps.docs[0];
    const data = docSnap.data();
    adminFoundUid = docSnap.id;
    $("adminResultName").textContent = data.displayName || "User";
    $("adminResultEmail").textContent = data.email || "-";
    const avatarImg = $("adminResultAvatar");
    avatarImg.src = data.photoURL || "";
    avatarImg.style.visibility = data.photoURL ? "visible" : "hidden";
    $("adminTitleInput").value = data.title || "";
    $("adminRoleStatus").textContent = "Role: " + (data.role || "user");
    $("adminRoleBtn").textContent = data.role === "admin" ? "Cabut Admin" : "Jadikan Admin";
    box.style.display = "flex";
  } catch (e) {
    errEl.textContent = "Gagal cari user. Cek Firestore Rules / koneksi lu.";
  }
}

async function adminSaveTitle() {
  if (!adminFoundUid) return;
  const errEl = $("adminSearchError");
  const title = $("adminTitleInput").value.trim();
  try {
    await updateDoc(doc(db, "users", adminFoundUid), { title: title || null, updatedAt: serverTimestamp() });
    errEl.textContent = "";
    errEl.style.color = "#22c55e";
    errEl.textContent = "Title berhasil disimpan.";
    setTimeout(() => { errEl.textContent = ""; errEl.style.color = ""; }, 2500);
  } catch (e) {
    errEl.textContent = "Gagal simpan title. Cek Firestore Rules lu.";
  }
}

async function adminToggleRole() {
  if (!adminFoundUid) return;
  const statusEl = $("adminRoleStatus");
  const btn = $("adminRoleBtn");
  const makingAdmin = btn.textContent === "Jadikan Admin";
  try {
    await updateDoc(doc(db, "users", adminFoundUid), { role: makingAdmin ? "admin" : "user", updatedAt: serverTimestamp() });
    statusEl.textContent = "Role: " + (makingAdmin ? "admin" : "user");
    btn.textContent = makingAdmin ? "Cabut Admin" : "Jadikan Admin";
  } catch (e) {
    alert("Gagal ubah role. Cek Firestore Rules lu.");
  }
}

/* ---------- close modal on backdrop click ---------- */
document.addEventListener("DOMContentLoaded", () => {
  ["authModal", "profileModal", "adminModal"].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener("click", (e) => { if (e.target === el) closeModal(id); });
  });
});

/* ---------- expose to inline onclick= handlers ---------- */
Object.assign(window, {
  onAccountBtnClick, closeAuthModal, switchAuthTab, switchEmailMode,
  loginGoogle, submitEmailAuth, loginGuest, submitAdminLogin,
  closeProfileModal, toggleProfileEdit, onAvatarFileChange, saveProfile,
  openAdminPanel, closeAdminModal, adminSearchUser, adminSaveTitle, adminToggleRole,
  logoutUser
});
