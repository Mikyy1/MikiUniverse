/* =========================================
   MIKI UNIVERSE — HD Image Page
   Semua request lewat Cloudflare Worker (nggak ada CORS masalah).
   Ganti WORKER_URL di bawah setelah Worker-nya di-deploy.
   ========================================= */

(function () {
  /* ======== GANTI INI setelah Worker di-deploy di Cloudflare ======== */
  const WORKER_URL = "https://miki-hd-proxy.mine14788.workers.dev";
  /* =================================================================== */

  let selectedFile = null;
  let isProcessing = false;

  function $(id) { return document.getElementById(id); }

  /* --- gate: cek login --- */
  function refreshGate() {
    const user = window.__mikiAuthState?.currentUser;
    const gate = $("hdLoginGate");
    const main = $("hdMain");
    if (!gate || !main) return;
    if (user) { gate.style.display = "none"; main.style.display = "block"; }
    else { gate.style.display = "flex"; main.style.display = "none"; }
  }

  /* --- file pilih --- */
  function onFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      const preview = $("hdPreviewImg");
      const hint = $("hdUploadHint");
      if (preview) { preview.src = reader.result; preview.style.display = "block"; }
      if (hint) hint.style.display = "none";
      $("hdServers").style.display = "block";
      $("hdResult").style.display = "none";
      $("hdError").textContent = "";
    };
    reader.readAsDataURL(file);
  }

  function setStatus(msg) {
    const el = $("hdStatus");
    const txt = $("hdStatusText");
    if (el) el.style.display = msg ? "flex" : "none";
    if (txt) txt.textContent = msg || "";
  }

  function setServerBtnsDisabled(val) {
    document.querySelectorAll(".hdpage-server-btn").forEach(b => b.disabled = val);
  }

  /* --- main: kirim ke Worker --- */
  async function runHdUpscale(serverNum) {
    if (isProcessing) return;
    if (!selectedFile) { $("hdError").textContent = "Pilih foto dulu."; return; }
    if (!window.__mikiAuthState?.currentUser) { refreshGate(); return; }

    if (!WORKER_URL) {
  $("hdError").textContent = "Worker belum dipasang. Hubungi admin.";
  return;
}

    isProcessing = true;
    setServerBtnsDisabled(true);
    $("hdError").textContent = "";
    $("hdResult").style.display = "none";

    try {
      setStatus(`Mengupload & memproses... Server ${serverNum}`);

      const form = new FormData();
      form.append("server", String(serverNum));
      form.append("image", selectedFile, selectedFile.name || "image.jpg");
      form.append("filename", selectedFile.name || "image.jpg");

      const res = await fetch(WORKER_URL, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(120000)
      });

      const data = await res.json();

      if (!data?.ok || !data?.result) {
        throw new Error(data?.error || `Server ${serverNum} gagal memproses. Coba server lain.`);
      }

      setStatus(null);
      const resultImg = $("hdResultImg");
      const downloadBtn = $("hdDownloadBtn");
      const resultBox = $("hdResult");
      if (resultImg) resultImg.src = data.result;
      if (downloadBtn) downloadBtn.href = data.result;
      if (resultBox) resultBox.style.display = "flex";

    } catch (err) {
      setStatus(null);
      const msg = err.name === "TimeoutError"
        ? `Server ${serverNum} timeout (>2 menit). Coba server lain.`
        : (err.message || `Server ${serverNum} error. Coba server lain.`);
      $("hdError").textContent = msg;
    } finally {
      isProcessing = false;
      setServerBtnsDisabled(false);
    }
  }

  function hdReset() {
    selectedFile = null;
    const preview = $("hdPreviewImg");
    const hint = $("hdUploadHint");
    if (preview) { preview.src = ""; preview.style.display = "none"; }
    if (hint) hint.style.display = "flex";
    $("hdServers").style.display = "none";
    $("hdResult").style.display = "none";
    $("hdError").textContent = "";
    $("hdFileInput").value = "";
    setStatus(null);
  }

  /* --- init --- */
  document.addEventListener("DOMContentLoaded", () => {
    const fileInput = $("hdFileInput");
    if (fileInput) fileInput.addEventListener("change", onFileSelected);

    window.__mikiOnAuthChange = refreshGate;
    refreshGate();

    const check = setInterval(() => {
      if (window.__mikiAuthState !== undefined) { refreshGate(); clearInterval(check); }
    }, 200);
  });

  Object.assign(window, { runHdUpscale, hdReset });
})();
