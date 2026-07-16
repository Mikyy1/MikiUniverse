/* =========================================
   MIKI UNIVERSE — Page Loader
   Nampilin overlay loading pas pindah antar halaman internal,
   dan pas halaman baru pertama kali dimuat.
   ========================================= */

(function () {
  const MIN_SHOW_MS = 550; // durasi minimum overlay keliatan biar gak "kedip" doang

  function createOverlay() {
    if (document.getElementById("mikiPageLoader")) return;
    const el = document.createElement("div");
    el.id = "mikiPageLoader";
    el.innerHTML = `
      <div class="miki-loader-inner">
        <span class="miki-loader-text">Miki Universe</span>
        <div class="miki-loader-ring"></div>
      </div>`;
    document.body.prepend(el);
  }

  function showOverlay() {
    createOverlay();
    const el = document.getElementById("mikiPageLoader");
    el.classList.remove("miki-loader-hide");
  }

  function hideOverlay() {
    const el = document.getElementById("mikiPageLoader");
    if (el) el.classList.add("miki-loader-hide");
  }

  // Tampil dari awal saat halaman baru dimuat, lalu fade-out abis siap.
  createOverlay();
  const shownAt = Date.now();
  window.addEventListener("load", () => {
    const elapsed = Date.now() - shownAt;
    const wait = Math.max(0, MIN_SHOW_MS - elapsed);
    setTimeout(hideOverlay, wait);
  });
  // Jaga-jaga kalau load event kelamaan/gak jalan, tetep ke-hide otomatis.
  setTimeout(hideOverlay, 4000);

  // Intercept klik ke link internal, biar overlay nongol SEBELUM pindah halaman.
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const isInternal = href.startsWith("/") && !href.startsWith("//");
    const opensNewTab = a.target === "_blank";
    if (!isInternal || opensNewTab) return;

    const isHash = href.startsWith("/#");
    const onHomePage = ["/", "/home", "/index.html"].includes(window.location.pathname);
    // Kalau link-nya anchor (#top dll) dan kita udah di home, biarin scroll biasa, gak usah loading.
    if (isHash && onHomePage) return;

    e.preventDefault();
    showOverlay();
    setTimeout(() => { window.location.href = href; }, 220);
  });
})();
