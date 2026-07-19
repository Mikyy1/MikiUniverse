/* =========================================
   MIKI UNIVERSE — Admin Panel Page Gate
   Halaman ini FAIL-CLOSED: defaultnya nampilin "Akses Ditolak"
   dan baru nampilin konten admin kalau role user KEPASTIAN admin.
   Beda sama gate maintenance HD Image yang fail-open — di sini
   sengaja fail-closed karena ini soal hak akses, bukan uptime fitur.
   ========================================= */

(function () {
  function $(id) { return document.getElementById(id); }

  async function refreshAdminGate() {
    const denyGate = $("adminDenyGate");
    const main = $("adminMain");
    if (!denyGate || !main) return;

    const user = window.__mikiAuthState?.currentUser;
    const profile = window.__mikiAuthState?.currentProfile;
    const isAdmin = !!user && profile?.role === "admin";

    if (isAdmin) {
      denyGate.style.display = "none";
      main.style.display = "block";
      // otomatis muat status Fitur HD Image begitu halaman kebuka,
      // gak perlu nunggu diklik lagi kayak pas masih model popup.
      window.adminLoadHdFeatureStatus?.();
    } else {
      denyGate.style.display = "block";
      main.style.display = "none";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Firebase/auth.js bakal manggil hook ini tiap kali status login berubah.
    window.__mikiOnAuthChange = refreshAdminGate;
    refreshAdminGate();
  });
})();
