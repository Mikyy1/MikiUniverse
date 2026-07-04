/* =========================================
   MIKI UNIVERSE — AUTH & PROFILE (Firebase)
   Login Google / Email / Guest / Admin.
   Tiap user punya dokumen sendiri di Firestore: users/{uid}
   Modal open/close logic ada di ui.js (load duluan, no dependency).
   ========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp,
  collection, query, where, getDocs, limit, addDoc, deleteDoc, orderBy
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { firebaseConfig, BOOTSTRAP_ADMIN_EMAILS } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let unsubProfile = null;
let adminFoundUid = null;

function $(id) { return document.getElementById(id); }
function escapeAttr(str) { return String(str).replace(/"/g, "&quot;"); }
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
    "auth/too-many-requests": "Kebanyakan percobaan. Coba lagi nanti.",
    "auth/invalid-api-key": "Config Firebase belum bener. Cek firebase-config.js.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Config Firebase belum bener. Cek firebase-config.js."
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

/* ---------- auth state (kept in sync with window.__mikiAuthState for ui.js) ---------- */
onAuthStateChanged(auth, async (user) => {
  window.__mikiAuthState.currentUser = user;
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
        window.__mikiAuthState.currentProfile = snap.data();
        renderHeaderAccount();
        if ($("profileModal")?.classList.contains("active")) renderProfileModal();
        setupPresetComposerVisibility();
        renderPresetFeedFromCache();
        window.__mikiOnAuthChange?.();
      }
    });
  } else {
    window.__mikiAuthState.currentProfile = null;
    renderHeaderAccount();
    setupPresetComposerVisibility();
    renderPresetFeedFromCache();
    window.__mikiOnAuthChange?.();
  }
});

/* ---------- header account button ---------- */
function renderHeaderAccount() {
  const btn = $("accountBtn");
  if (!btn) return;
  const { currentUser, currentProfile } = window.__mikiAuthState;
  if (currentUser && currentProfile && currentProfile.photoURL) {
    btn.classList.add("has-avatar");
    btn.innerHTML = `<img class="account-btn-avatar-img" src="${escapeAttr(currentProfile.photoURL)}" alt="">`;
  } else {
    btn.classList.remove("has-avatar");
    btn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#icon-circle-user"></use></svg>`;
  }
}

/* ---------- profile modal rendering (called by ui.js too) ---------- */
function renderProfileModal() {
  const { currentUser, currentProfile } = window.__mikiAuthState;
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

  const premiumBadge = $("profilePremiumBadge");
  if (premiumBadge) premiumBadge.style.display = currentProfile.premium ? "flex" : "none";

  $("profileError").textContent = "";
}
window.__mikiRenderProfileModal = renderProfileModal;

/* ---------- Preset Feed (post admin: preset, link CR, konten) ---------- */
let stagedPresetPhoto = null;
let unsubPresetFeed = null;

function linkifyHtml(rawText) {
  const escaped = escapeHtml(rawText);
  const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
  return escaped.replace(urlRegex, (match) => {
    const href = match.startsWith("http") ? match : "https://" + match;
    return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener">${match}</a>`;
  });
}

function formatPresetDate(timestamp) {
  if (!timestamp || !timestamp.seconds) return "";
  const d = new Date(timestamp.seconds * 1000);
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const jam = String(d.getHours()).padStart(2, "0");
  const menit = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()} · ${jam}:${menit}`;
}

function setupPresetComposerVisibility() {
  const composer = $("presetComposer");
  if (!composer) return;
  const { currentProfile } = window.__mikiAuthState;
  composer.style.display = currentProfile?.role === "admin" ? "block" : "none";
}

async function onPresetPhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const errEl = $("presetError");
  if (errEl) errEl.textContent = "";
  try {
    const dataUrl = await compressImageToDataURL(file, 1080, 0.78);
    stagedPresetPhoto = dataUrl;
    $("presetPhotoPreview").src = dataUrl;
    $("presetPhotoPreview").style.display = "block";
    $("presetPhotoHint").style.display = "none";
  } catch (e) {
    if (errEl) errEl.textContent = "Gagal proses foto. Coba foto lain.";
  }
}

async function submitPresetPost() {
  const { currentUser, currentProfile } = window.__mikiAuthState;
  const errEl = $("presetError");
  if (errEl) errEl.textContent = "";
  if (!currentUser || currentProfile?.role !== "admin") {
    if (errEl) errEl.textContent = "Cuma admin yang bisa posting.";
    return;
  }
  const caption = ($("presetCaptionInput")?.value || "").trim();
  if (!caption && !stagedPresetPhoto) {
    if (errEl) errEl.textContent = "Isi caption atau pilih foto dulu.";
    return;
  }
  const btn = $("presetSubmitBtn");
  if (btn) btn.disabled = true;
  try {
    await addDoc(collection(db, "presets"), {
      caption,
      photoURL: stagedPresetPhoto || "",
      authorName: currentProfile?.displayName || "Admin",
      authorPhoto: currentProfile?.photoURL || "",
      createdAt: serverTimestamp()
    });
    $("presetCaptionInput").value = "";
    stagedPresetPhoto = null;
    $("presetPhotoPreview").style.display = "none";
    $("presetPhotoPreview").src = "";
    $("presetPhotoHint").style.display = "flex";
  } catch (e) {
    if (errEl) errEl.textContent = "Gagal posting. Coba lagi.";
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deletePresetPost(postId) {
  const { currentProfile } = window.__mikiAuthState;
  if (currentProfile?.role !== "admin") return;
  if (!confirm("Hapus post ini?")) return;
  try {
    await deleteDoc(doc(db, "presets", postId));
  } catch (e) {
    alert("Gagal hapus post.");
  }
}

function togglePresetEdit(postId) {
  const card = document.querySelector(`.preset-card[data-id="${postId}"]`);
  if (!card) return;
  card.classList.toggle("editing");
}

async function savePresetEdit(postId) {
  const { currentProfile } = window.__mikiAuthState;
  if (currentProfile?.role !== "admin") return;
  const card = document.querySelector(`.preset-card[data-id="${postId}"]`);
  if (!card) return;
  const textarea = card.querySelector(".preset-edit-input");
  const newCaption = (textarea?.value || "").trim();
  const errEl = card.querySelector(".preset-edit-error");
  if (errEl) errEl.textContent = "";
  try {
    await updateDoc(doc(db, "presets", postId), { caption: newCaption });
    card.classList.remove("editing");
  } catch (e) {
    if (errEl) errEl.textContent = "Gagal simpan perubahan.";
  }
}

function renderPresetCard(id, data, isAdmin) {
  const avatar = data.authorPhoto
    ? `<img src="${escapeAttr(data.authorPhoto)}" alt="">`
    : `<div class="preset-author-fallback"><svg class="icon" aria-hidden="true"><use href="#icon-circle-user"></use></svg></div>`;
  const photoBlock = data.photoURL
    ? `<div class="preset-card-photo"><img src="${escapeAttr(data.photoURL)}" alt="Foto preset"></div>`
    : "";
  const adminBtns = isAdmin
    ? `<div class="preset-admin-btns">
         <button class="preset-edit-btn-icon" type="button" onclick="togglePresetEdit('${id}')"><svg class="icon" aria-hidden="true"><use href="#icon-pencil"></use></svg></button>
         <button class="preset-delete-btn" type="button" onclick="deletePresetPost('${id}')"><svg class="icon" aria-hidden="true"><use href="#icon-xmark"></use></svg></button>
       </div>`
    : "";
  const editBlock = isAdmin
    ? `<div class="preset-edit-area">
         <textarea class="preset-edit-input" rows="4" maxlength="1200">${escapeHtml(data.caption || "")}</textarea>
         <p class="auth-error preset-edit-error"></p>
         <div class="preset-edit-actions">
           <button class="btn preset-edit-cancel-btn" type="button" onclick="togglePresetEdit('${id}')">Batal</button>
           <button class="btn preset-edit-save-btn" type="button" onclick="savePresetEdit('${id}')">Simpan</button>
         </div>
       </div>`
    : "";

  return `
    <article class="preset-card" data-id="${id}">
      <div class="preset-card-head">
        ${avatar}
        <div>
          <div class="preset-author-name">${escapeHtml(data.authorName || "Admin")}</div>
          <div class="preset-card-date">${formatPresetDate(data.createdAt)}</div>
        </div>
        ${adminBtns}
      </div>
      <div class="preset-view-area">
        ${data.caption ? `<p class="preset-card-caption">${linkifyHtml(data.caption)}</p>` : ""}
      </div>
      ${editBlock}
      ${photoBlock}
    </article>
  `;
}

let lastPresetDocs = null;

function renderPresetFeedFromCache() {
  const listEl = $("presetFeedList");
  if (!listEl || !lastPresetDocs) return;
  const { currentProfile } = window.__mikiAuthState;
  const isAdmin = currentProfile?.role === "admin";
  const emptyEl = $("presetFeedEmpty");

  if (lastPresetDocs.length === 0) {
    if (emptyEl) emptyEl.style.display = "block";
    listEl.querySelectorAll(".preset-card").forEach((el) => el.remove());
    return;
  }
  if (emptyEl) emptyEl.style.display = "none";

  let html = "";
  lastPresetDocs.forEach(({ id, data }) => { html += renderPresetCard(id, data, isAdmin); });
  listEl.innerHTML = html + (emptyEl ? emptyEl.outerHTML : "");
}

function subscribePresetFeed() {
  const listEl = $("presetFeedList");
  if (!listEl) return;

  if (unsubPresetFeed) unsubPresetFeed();
  const q = query(collection(db, "presets"), orderBy("createdAt", "desc"));
  unsubPresetFeed = onSnapshot(q, (snap) => {
    lastPresetDocs = [];
    snap.forEach((d) => { lastPresetDocs.push({ id: d.id, data: d.data() }); });
    renderPresetFeedFromCache();
  }, () => {
    if (listEl) listEl.innerHTML = `<p class="preset-feed-empty">Gagal muat konten. Coba refresh halaman.</p>`;
  });
}

subscribePresetFeed();

/* ---------- Google ---------- */
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

/* ---------- Guest ---------- */
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

/* ---------- HD Image rate limit (5x/day per user) ---------- */
const HD_DAILY_LIMIT = 5;

async function hdCheckUsage() {
  const { currentUser } = window.__mikiAuthState;
  if (!currentUser) return { ok: false, reason: "Login dulu." };
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  try {
    const ref = doc(db, "users", currentUser.uid);
    const snap = await getDoc(ref);
    const data = snap.data() || {};
    const usageDate = data.hdUsageDate || "";
    const usageCount = usageDate === today ? (data.hdUsageCount || 0) : 0;
    if (usageCount >= HD_DAILY_LIMIT) {
      return { ok: false, reason: `Batas harian tercapai (${HD_DAILY_LIMIT}x/hari). Coba lagi besok.` };
    }
    return { ok: true, used: usageCount, limit: HD_DAILY_LIMIT };
  } catch (_) {
    return { ok: true, used: 0, limit: HD_DAILY_LIMIT }; // fail open
  }
}

async function hdIncrementUsage() {
  const { currentUser } = window.__mikiAuthState;
  if (!currentUser) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const ref = doc(db, "users", currentUser.uid);
    const snap = await getDoc(ref);
    const data = snap.data() || {};
    const usageDate = data.hdUsageDate || "";
    const prev = usageDate === today ? (data.hdUsageCount || 0) : 0;
    await updateDoc(ref, { hdUsageDate: today, hdUsageCount: prev + 1, updatedAt: serverTimestamp() });
  } catch (_) {}
}

/* ---------- avatar upload + save profile ---------- */
async function onAvatarFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const errEl = $("profileError");
  errEl.textContent = "";
  try {
    const dataUrl = await compressImageToDataURL(file, 256, 0.72);
    window.__mikiStagedAvatar = dataUrl;
    $("profileAvatarImg").src = dataUrl;
    $("profileAvatarImg").style.display = "block";
    $("profileAvatarFallback").style.display = "none";
  } catch (e) {
    errEl.textContent = "Gagal proses gambar. Coba foto lain.";
  }
}

async function saveProfile() {
  const { currentUser } = window.__mikiAuthState;
  if (!currentUser) return;
  const errEl = $("profileError");
  errEl.textContent = "";
  const newName = $("profileNameInput").value.trim();
  if (!newName) { errEl.textContent = "Nickname nggak boleh kosong."; return; }
  if (newName.length > 24) { errEl.textContent = "Nickname maksimal 24 karakter."; return; }
  try {
    const updates = { displayName: newName, updatedAt: serverTimestamp() };
    if (window.__mikiStagedAvatar) updates.photoURL = window.__mikiStagedAvatar;
    await updateDoc(doc(db, "users", currentUser.uid), updates);
    try { await updateProfile(currentUser, { displayName: newName }); } catch (_) {}
    window.__mikiStagedAvatar = null;
    toggleProfileEdit();
  } catch (e) {
    errEl.textContent = "Gagal simpan. Coba lagi.";
  }
}

async function logoutUser() {
  try {
    await signOut(auth);
    closeModalSafe("profileModal");
    closeModalSafe("adminModal");
  } catch (_) {}
}
function closeModalSafe(id) { $(id)?.classList.remove("active"); }

/* ---------- admin panel ---------- */
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
    $("adminPremiumStatus").textContent = "Premium: " + (data.premium ? "ya" : "tidak");
    $("adminPremiumBtn").textContent = data.premium ? "Cabut Premium" : "Aktifkan Premium";
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
    errEl.style.color = "#22c55e";
    errEl.textContent = "Title berhasil disimpan.";
    setTimeout(() => { errEl.textContent = ""; errEl.style.color = ""; }, 2500);
  } catch (e) {
    errEl.style.color = "";
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

async function adminTogglePremium() {
  if (!adminFoundUid) return;
  const statusEl = $("adminPremiumStatus");
  const btn = $("adminPremiumBtn");
  const makingPremium = btn.textContent === "Aktifkan Premium";
  try {
    await updateDoc(doc(db, "users", adminFoundUid), { premium: makingPremium, updatedAt: serverTimestamp() });
    statusEl.textContent = "Premium: " + (makingPremium ? "ya" : "tidak");
    btn.textContent = makingPremium ? "Cabut Premium" : "Aktifkan Premium";
  } catch (e) {
    alert("Gagal ubah status premium. Cek Firestore Rules lu.");
  }
}

/* ---------- overwrite ui.js placeholders now that Firebase is ready ---------- */
Object.assign(window, {
  loginGoogle, loginGuest,
  onAvatarFileChange, saveProfile,
  adminSearchUser, adminSaveTitle, adminToggleRole, adminTogglePremium,
  logoutUser,
  onPresetPhotoChange, submitPresetPost, deletePresetPost,
  togglePresetEdit, savePresetEdit,
  hdCheckUsage, hdIncrementUsage
});

console.log("[Miki Auth] Firebase siap & nyambung.");
