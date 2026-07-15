/* =========================================
   MIKI UNIVERSE — Cek ID Game (Mobile Legends)
   Lookup nickname pakai User ID + Server ID.
   Sumber data: api.isan.eu.org (API publik, gratis, dipake juga di web-web topup).
   ========================================= */

(function () {
  const API_URL = "https://api.isan.eu.org/nickname/ml";
  let isChecking = false;

  const REGION_MAP = {
    "1": "Indonesia", "2": "Indonesia", "3": "Indonesia", "4": "Indonesia",
    "5": "Indonesia", "6": "Indonesia", "7": "Indonesia", "8": "Indonesia", "9": "Indonesia",
    "10": "Malaysia / SG / BN", "11": "Philippines", "12": "Thailand",
    "13": "Vietnam", "14": "Cambodia", "15": "Myanmar", "16": "Laos",
    "17": "Timor-Leste", "19": "Middle East", "20": "North America",
    "21": "Europe", "22": "South America"
  };

  function $(id) { return document.getElementById(id); }

  function getRegion(serverId) {
    const s = String(serverId);
    return REGION_MAP[s.slice(0, 2)] ?? REGION_MAP[s.slice(0, 1)] ?? "Unknown";
  }

  function setBtnLoading(loading) {
    const btn = $("cekidBtn");
    if (!btn) return;
    btn.disabled = loading;
    $("cekidLoading").style.display = loading ? "flex" : "none";
  }

  async function runCekId() {
    if (isChecking) return;

    const userId = $("cekidUserId").value.trim();
    const serverId = $("cekidServerId").value.trim();
    const errorEl = $("cekidError");
    const resultEl = $("cekidResult");

    errorEl.textContent = "";
    resultEl.style.display = "none";

    if (!userId || !serverId) {
      errorEl.textContent = "Isi User ID sama Server ID dulu ya.";
      return;
    }
    if (!/^\d+$/.test(userId) || !/^\d+$/.test(serverId)) {
      errorEl.textContent = "User ID & Server ID harus angka semua.";
      return;
    }

    isChecking = true;
    setBtnLoading(true);

    try {
      const res = await fetch(
        `${API_URL}?id=${encodeURIComponent(userId)}&server=${encodeURIComponent(serverId)}`,
        {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(20000)
        }
      );
      const data = await res.json().catch(() => null);

      if (!data?.success || !data?.name) {
        errorEl.textContent = "Nickname gak ketemu. Pastiin User ID & Server ID bener.";
        return;
      }

      $("cekidResultName").textContent = data.name;
      $("cekidResultId").textContent = userId;
      $("cekidResultServer").textContent = serverId;
      $("cekidResultRegion").textContent = getRegion(serverId);
      resultEl.style.display = "block";

    } catch (err) {
      errorEl.textContent = err.name === "TimeoutError"
        ? "Timeout, coba lagi."
        : "Gagal cek nickname. Coba lagi beberapa saat.";
    } finally {
      isChecking = false;
      setBtnLoading(false);
    }
  }

  Object.assign(window, { runCekId });
})();
