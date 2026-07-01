/* =========================================
   MIKI UNIVERSE — HD Image Page
   Upload foto → catbox.moe (dapet link publik) →
   kirim ke salah satu dari 3 server upscale gratis
   ========================================= */

(function () {
  let selectedFile = null;
  let isProcessing = false;

  function $(id) { return document.getElementById(id); }

  /* --- gate: cek login & tampilkan UI yang sesuai --- */
  function refreshGate() {
    const user = window.__mikiAuthState?.currentUser;
    const gate = $("hdLoginGate");
    const main = $("hdMain");
    if (!gate || !main) return;
    if (user) {
      gate.style.display = "none";
      main.style.display = "block";
    } else {
      gate.style.display = "flex";
      main.style.display = "none";
    }
  }

  /* --- file pilih --- */
  function onFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedFile = file;

    const preview = $("hdPreviewImg");
    const hint = $("hdUploadHint");
    const servers = $("hdServers");
    const errEl = $("hdError");
    const resultEl = $("hdResult");

    if (errEl) errEl.textContent = "";
    if (resultEl) resultEl.style.display = "none";

    const reader = new FileReader();
    reader.onload = () => {
      if (preview) { preview.src = reader.result; preview.style.display = "block"; }
      if (hint) hint.style.display = "none";
      if (servers) servers.style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  /* --- upload ke catbox.moe (dapet public URL) --- */
  async function uploadToCatbox(file) {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", file);
    const res = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: form
    });
    const text = await res.text();
    if (!text.startsWith("https://")) throw new Error("Upload gagal: " + text.slice(0, 80));
    return text.trim();
  }

  /* --- set status UI --- */
  function setStatus(msg) {
    const el = $("hdStatus");
    const txt = $("hdStatusText");
    if (!el) return;
    if (msg) {
      el.style.display = "flex";
      if (txt) txt.textContent = msg;
    } else {
      el.style.display = "none";
    }
  }

  function setServerBtnsDisabled(val) {
    document.querySelectorAll(".hdpage-server-btn").forEach(b => b.disabled = val);
  }

  /* --- main: upload + hit server --- */
  async function runHdUpscale(serverNum) {
    if (isProcessing) return;
    if (!selectedFile) { const e = $("hdError"); if (e) e.textContent = "Pilih foto dulu."; return; }
    if (!window.__mikiAuthState?.currentUser) { refreshGate(); return; }

    isProcessing = true;
    setServerBtnsDisabled(true);
    const errEl = $("hdError");
    if (errEl) errEl.textContent = "";
    $("hdResult").style.display = "none";

    try {
      // Step 1: upload ke catbox dapet URL publik
      setStatus("Mengupload foto... (1/2)");
      const imageUrl = await uploadToCatbox(selectedFile);

      // Step 2: kirim ke server upscale sesuai pilihan
      setStatus(`Memproses HD... Server ${serverNum} (2/2)`);
      let resultUrl = "";

      if (serverNum === 1) {
        const res = await fetch(
          `https://api.ikyyxd.my.id/tools/upscale?url=${encodeURIComponent(imageUrl)}`,
          { signal: AbortSignal.timeout(90000) }
        );
        const json = await res.json();
        if (!json?.status || !json?.result?.upscale) throw new Error("Server 1 gagal memproses.");
        resultUrl = json.result.upscale;
      }

      else if (serverNum === 2) {
        const res = await fetch(
          `https://api.lexcode.biz.id/api/tools/upscale?url=${encodeURIComponent(imageUrl)}`,
          { signal: AbortSignal.timeout(90000) }
        );
        const json = await res.json();
        if (!json?.success || !json?.result) throw new Error("Server 2 gagal memproses.");
        resultUrl = json.result;
      }

      else if (serverNum === 3) {
        // Server 3 langsung balikin URL hasil (nggak perlu parse JSON)
        resultUrl = `https://api.zenzxz.my.id/tools/upscale?url=${encodeURIComponent(imageUrl)}&scale=4`;
      }

      // Tampilkan hasil
      setStatus(null);
      const resultImg = $("hdResultImg");
      const downloadBtn = $("hdDownloadBtn");
      const resultBox = $("hdResult");
      if (resultImg) resultImg.src = resultUrl;
      if (downloadBtn) downloadBtn.href = resultUrl;
      if (resultBox) resultBox.style.display = "flex";

    } catch (err) {
      setStatus(null);
      const e = $("hdError");
      if (e) {
        if (err.name === "TimeoutError") {
          e.textContent = `Server ${serverNum} timeout. Coba server lain.`;
        } else {
          e.textContent = err.message || `Server ${serverNum} error. Coba server lain.`;
        }
      }
    } finally {
      isProcessing = false;
      setServerBtnsDisabled(false);
    }
  }

  function hdReset() {
    selectedFile = null;
    const preview = $("hdPreviewImg");
    const hint = $("hdUploadHint");
    const servers = $("hdServers");
    const resultBox = $("hdResult");
    const errEl = $("hdError");
    const fileInput = $("hdFileInput");
    if (preview) { preview.src = ""; preview.style.display = "none"; }
    if (hint) hint.style.display = "flex";
    if (servers) servers.style.display = "none";
    if (resultBox) resultBox.style.display = "none";
    if (errEl) errEl.textContent = "";
    if (fileInput) fileInput.value = "";
    setStatus(null);
  }

  /* --- init --- */
  document.addEventListener("DOMContentLoaded", () => {
    const fileInput = $("hdFileInput");
    if (fileInput) fileInput.addEventListener("change", onFileSelected);

    // Refresh gate tiap kali status login berubah
    const origOnAuth = window.__mikiOnAuthChange;
    window.__mikiOnAuthChange = function () {
      refreshGate();
      if (origOnAuth) origOnAuth();
    };

    // Juga cek sekarang (kalau udah login sebelumnya)
    refreshGate();

    // Polling ringan karena __mikiAuthState diisi async oleh auth.js (module)
    const check = setInterval(() => {
      if (window.__mikiAuthState !== undefined) {
        refreshGate();
        clearInterval(check);
      }
    }, 200);
  });

  Object.assign(window, { runHdUpscale, hdReset });
})();
