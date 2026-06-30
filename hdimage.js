/* =========================================
   MIKI UNIVERSE — HD Image (client-side AI upscale)
   Pakai UpscalerJS + TensorFlow.js, semua proses jalan di HP
   user sendiri (browser), jadi 100% gratis & unlimited, nggak
   ada server/API yang dipanggil sama sekali buat fitur ini.
   ========================================= */

(function () {
  let upscalerInstance = null;
  let selectedImageEl = null;
  let isProcessing = false;

  function $(id) { return document.getElementById(id); }

  function getUpscaler() {
    if (upscalerInstance) return upscalerInstance;
    if (typeof Upscaler === "undefined" || typeof DefaultUpscalerJSModel === "undefined") {
      return null;
    }
    upscalerInstance = new Upscaler({ model: DefaultUpscalerJSModel });
    return upscalerInstance;
  }

  /* resize gambar input dulu (canvas) biar inference-nya nggak berat,
     terutama buat foto kamera HP yang bisa 3000-4000px */
  function loadAndResizeImage(file, maxDim) {
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
          const resizedImg = new Image();
          resizedImg.onload = () => resolve(resizedImg);
          resizedImg.onerror = reject;
          resizedImg.src = canvas.toDataURL("image/jpeg", 0.92);
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function resetResultArea() {
    const resultBox = $("hdImageResultBox");
    if (resultBox) resultBox.style.display = "none";
  }

  function setGenerateState(label, enabled) {
    const btn = $("hdImageGenerateBtn");
    const labelEl = $("hdImageGenerateLabel");
    if (labelEl) labelEl.textContent = label;
    if (btn) btn.disabled = !enabled;
  }

  function onFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const errEl = $("hdImageError");
    if (errEl) errEl.textContent = "";
    resetResultArea();
    setGenerateState("Memuat foto...", false);

    loadAndResizeImage(file, 900)
      .then((img) => {
        selectedImageEl = img;
        const previewEl = $("hdImagePreview");
        const hintEl = $("hdImageUploadHint");
        if (previewEl) { previewEl.src = img.src; previewEl.style.display = "block"; }
        if (hintEl) hintEl.style.display = "none";
        setGenerateState("Generate HD", true);
      })
      .catch(() => {
        if (errEl) errEl.textContent = "Gagal proses foto. Coba foto lain.";
        setGenerateState("Pilih foto dulu", false);
      });
  }

  async function generateHdImage() {
    if (isProcessing) return;
    const errEl = $("hdImageError");
    if (errEl) errEl.textContent = "";

    if (!selectedImageEl) {
      if (errEl) errEl.textContent = "Pilih foto dulu.";
      return;
    }

    const upscaler = getUpscaler();
    if (!upscaler) {
      if (errEl) errEl.textContent = "Library AI gagal dimuat. Cek koneksi internet lu, terus refresh halaman.";
      return;
    }

    isProcessing = true;
    setGenerateState("Memproses... 0%", false);
    resetResultArea();

    try {
      const result = await upscaler.upscale(selectedImageEl, {
        patchSize: 64,
        padding: 2,
        progress: (rate) => {
          const pct = Math.round((typeof rate === "number" ? rate : 0) * 100);
          setGenerateState(`Memproses... ${pct}%`, false);
        }
      });

      const resultImg = $("hdImageResultImg");
      const downloadBtn = $("hdImageDownloadBtn");
      const resultBox = $("hdImageResultBox");
      if (resultImg) resultImg.src = result;
      if (downloadBtn) downloadBtn.href = result;
      if (resultBox) resultBox.style.display = "block";

      setGenerateState("Generate Lagi", true);
    } catch (e) {
      if (errEl) errEl.textContent = "Gagal proses gambar. Coba foto lain atau refresh halaman.";
      setGenerateState("Generate HD", true);
    } finally {
      isProcessing = false;
    }
  }

  function refreshHdImageGateState() {
    const currentUser = window.__mikiAuthState?.currentUser;
    const gateEl = $("hdImageLoginGate");
    const mainEl = $("hdImageMain");
    if (!gateEl || !mainEl) return;
    if (currentUser) {
      gateEl.style.display = "none";
      mainEl.style.display = "block";
    } else {
      gateEl.style.display = "block";
      mainEl.style.display = "none";
    }
  }

  function openHdImageModal() {
    refreshHdImageGateState();
    document.getElementById("hdImageModal")?.classList.add("active");
  }

  function closeHdImageModal() {
    document.getElementById("hdImageModal")?.classList.remove("active");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const fileInput = $("hdImageFileInput");
    if (fileInput) fileInput.addEventListener("change", onFileSelected);

    const genBtn = $("hdImageGenerateBtn");
    if (genBtn) genBtn.addEventListener("click", generateHdImage);

    const modal = $("hdImageModal");
    if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeHdImageModal(); });
  });

  Object.assign(window, { openHdImageModal, closeHdImageModal });
})();
