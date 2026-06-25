/* =========================================
   MIKI UNIVERSE — CLEAN SCRIPT (No More Chaos)
   ========================================= */

/* === POPUP === */
function openMorePopup(){ document.getElementById("morePopup").classList.add("active"); }
function closeMorePopup(){ document.getElementById("morePopup").classList.remove("active"); }
document.addEventListener("DOMContentLoaded", function(){
  const popup = document.getElementById("morePopup");
  if(popup){ popup.addEventListener("click", function(e){ if(e.target === popup) closeMorePopup(); }); }
});


/* === TRANSLATIONS === */
const translations = {
  id: {
    heroTitle: "Top Langganan<br>Edit Miki",
    heroDesc: "Website khusus buat nampilin customer yang paling sering edit. Karena repeat order lebih setia daripada manusia yang bilang \u201caku ga bakal berubah\u201d.",
    btnTop: "🔥 Lihat Top Langganan",
    btnWa: "💬 Order via WhatsApp",
    royalTitle: "🔥 Customer Royal",
    royalDesc: "Yang masuk sini berarti udah sering order. Mental kuat. Dompet sehat.",
    statusTitle: "Available Today",
    statusDesc: "Open order, fast response, dan masih ada slot edit.",
    statusSlot: "3 Slots Left",
    topTitle: "Top Langganan",
    totalEdit: "Total Edit",
    tagRoyal: "Paling Royal",
    tagRegular: "Langganan Tetap",
    tagNoDrama: "No Drama",
    serviceTitle: "Service Edit",
    svcCcTitle: "CC Gameplay",
    svcCcDesc: "Color correction gameplay biar gameplay lu makin HD.",
    svcEditTitle: "Paid Edit",
    svcEditDesc: "Edit MLBB, PUBG, Konsep bebas yang penting masuk akal",
    svcAmTitle: "Alight Motion",
    svcAmDesc: "Order Account Premium Alight Motion 1 Years.",
    recentTitle: "Recently Uploaded",
    recentDesc: "Video terbaru dari TikTok admin. Stats bisa lu update manual di data.js.",
    recentInfoTitle: "Latest TikTok Video",
    watchTikTok: "Watch on TikTok",
    whyTitle: "Kenapa Harus Order Disini?",
    whyFastTitle: "Fast Response",
    whyFastDesc: "Chat dibales cepat, order diproses tanpa drama panjang.",
    whyQualityTitle: "Hasil Niat",
    whyQualityDesc: "Edit dibuat rapi, bukan asal tempel efek terus kabur.",
    whyTrustedTitle: "Trusted Customer",
    whyTrustedDesc: "Banyak repeat order dan bukti testi yang bisa dicek.",
    whyRevisionTitle: "Revisi Aman",
    whyRevisionDesc: "Masih bisa revisi sesuai request selama masuk akal.",
    socialTitle: "Social Media",
    navTop: "Top",
    navService: "Service",
    navSocial: "Social Media",
    navMore: "More",
    navTesti: "Testi",
    moreTitle: "More Menu",
    moreDesc: "Pilih jenis testi.",
    headerNavTop: "Top",
    headerNavService: "Service",
    headerNavWhy: "Why",
    headerNavSocial: "Social",
    statusClosedTitle: "Order Closed",
    statusClosedDesc: "Order close dulu. Buka lagi jam 1 siang.",
    statusClosed: "Closed",
    statusHours: "13:00 – 23:00"
  },
  en: {
    heroTitle: "Top Customers<br>Miki Edit",
    heroDesc: "A special website to show customers who order edits the most. Repeat orders are more loyal than people saying \u201cI won\u2019t change\u201d.",
    btnTop: "🔥 View Top Customers",
    btnWa: "💬 Order via WhatsApp",
    royalTitle: "🔥 Loyal Customers",
    royalDesc: "People listed here have ordered many times. Strong mindset. Healthy wallet.",
    statusTitle: "Available Today",
    statusDesc: "Open orders, fast response, and editing slots are still available.",
    statusSlot: "3 Slots Left",
    topTitle: "Top Customers",
    totalEdit: "Total Edits",
    tagRoyal: "Most Loyal",
    tagRegular: "Regular Customer",
    tagNoDrama: "No Drama",
    serviceTitle: "Edit Services",
    svcCcTitle: "CC Gameplay",
    svcCcDesc: "Gameplay color correction to make your footage look sharper and more HD.",
    svcEditTitle: "Paid Edit",
    svcEditDesc: "MLBB, PUBG, any concept as long as it makes sense.",
    svcAmTitle: "Alight Motion",
    svcAmDesc: "Order 1-year Premium Alight Motion account.",
    recentTitle: "Recently Uploaded",
    recentDesc: "Latest video from admin TikTok. You can update the stats manually in data.js.",
    recentInfoTitle: "Latest TikTok Video",
    watchTikTok: "Watch on TikTok",
    whyTitle: "Why Order Here?",
    whyFastTitle: "Fast Response",
    whyFastDesc: "Quick replies and orders processed without endless drama.",
    whyQualityTitle: "Quality Results",
    whyQualityDesc: "Clean edits, not random effects slapped together.",
    whyTrustedTitle: "Trusted Customers",
    whyTrustedDesc: "Plenty of repeat orders and proof you can check.",
    whyRevisionTitle: "Safe Revisions",
    whyRevisionDesc: "Revisions available as long as the request makes sense.",
    socialTitle: "Social Media",
    navTop: "Top",
    navService: "Service",
    navSocial: "Social Media",
    navMore: "More",
    navTesti: "Testimonials",
    moreTitle: "More Menu",
    moreDesc: "Choose a testimonial type.",
    headerNavTop: "Top",
    headerNavService: "Service",
    headerNavWhy: "Why",
    headerNavSocial: "Social",
    statusClosedTitle: "Order Closed",
    statusClosedDesc: "Orders are closed for now. We reopen at 1 PM.",
    statusClosed: "Closed",
    statusHours: "1:00 PM – 11:00 PM"
  },
  ms: {
    heroTitle: "Top Langganan<br>Edit Miki",
    heroDesc: "Laman khas untuk memaparkan pelanggan yang paling kerap order edit. Repeat order memang lebih setia daripada janji manusia.",
    btnTop: "🔥 Lihat Top Langganan",
    btnWa: "💬 Order melalui WhatsApp",
    royalTitle: "🔥 Pelanggan Setia",
    royalDesc: "Yang tersenarai di sini sudah kerap order. Mental kuat. Dompet sihat.",
    statusTitle: "Available Today",
    statusDesc: "Order dibuka, respon pantas, dan slot edit masih ada.",
    statusSlot: "3 Slot Lagi",
    topTitle: "Top Langganan",
    totalEdit: "Total Edit",
    tagRoyal: "Paling Royal",
    tagRegular: "Langganan Tetap",
    tagNoDrama: "No Drama",
    serviceTitle: "Servis Edit",
    svcCcTitle: "CC Gameplay",
    svcCcDesc: "Color correction gameplay supaya gameplay nampak lebih HD.",
    svcEditTitle: "Paid Edit",
    svcEditDesc: "Edit MLBB, PUBG, konsep bebas asalkan masuk akal.",
    svcAmTitle: "Alight Motion",
    svcAmDesc: "Order akaun Premium Alight Motion 1 tahun.",
    recentTitle: "Recently Uploaded",
    recentDesc: "Video terbaru dari TikTok admin. Stats boleh diubah manual di data.js.",
    recentInfoTitle: "Latest TikTok Video",
    watchTikTok: "Watch on TikTok",
    whyTitle: "Kenapa Perlu Order Di Sini?",
    whyFastTitle: "Respon Pantas",
    whyFastDesc: "Chat dibalas cepat, order diproses tanpa drama panjang.",
    whyQualityTitle: "Hasil Niat",
    whyQualityDesc: "Edit dibuat kemas, bukan sekadar tampal efek lalu hilang.",
    whyTrustedTitle: "Pelanggan Dipercayai",
    whyTrustedDesc: "Banyak repeat order dan bukti testimoni yang boleh disemak.",
    whyRevisionTitle: "Revisi Aman",
    whyRevisionDesc: "Masih boleh revisi selagi request masuk akal.",
    socialTitle: "Media Sosial",
    navTop: "Top",
    navService: "Servis",
    navSocial: "Media Sosial",
    navMore: "Lagi",
    navTesti: "Testi",
    moreTitle: "Menu Lagi",
    moreDesc: "Pilih jenis testimoni.",
    headerNavTop: "Top",
    headerNavService: "Servis",
    headerNavWhy: "Kenapa",
    headerNavSocial: "Sosial",
    statusClosedTitle: "Order Ditutup",
    statusClosedDesc: "Order ditutup buat masa ini. Dibuka semula jam 1 petang.",
    statusClosed: "Ditutup",
    statusHours: "1:00 PTG – 11:00 MLM"
  }
};

function toggleLangMenu(){
  document.getElementById("langMenu").classList.toggle("active");
}

function setLanguage(lang){
  localStorage.setItem("siteLang", lang);
  document.body.classList.remove("lang-id","lang-en","lang-ms");
  document.body.classList.add("lang-" + lang);

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if(translations[lang] && translations[lang][key]){
      el.textContent = translations[lang][key];
    }
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if(translations[lang] && translations[lang][key]){
      el.innerHTML = translations[lang][key];
    }
  });

  // testi page title/desc
  if(document.body.dataset.titleId){
    const capLang = lang.charAt(0).toUpperCase() + lang.slice(1);
    document.querySelectorAll("[data-page-title]").forEach(el => {
      el.textContent = document.body.dataset["title" + capLang] || el.textContent;
    });
    document.querySelectorAll("[data-page-desc]").forEach(el => {
      el.textContent = document.body.dataset["desc" + capLang] || el.textContent;
    });
  }

  const menu = document.getElementById("langMenu");
  if(menu) menu.classList.remove("active");

  document.dispatchEvent(new CustomEvent("languagechanged", { detail: { lang } }));
}

document.addEventListener("DOMContentLoaded", function(){
  const lang = localStorage.getItem("siteLang") || "id";
  setLanguage(lang);

  // close lang menu on outside click
  document.addEventListener("click", function(e){
    const menu = document.getElementById("langMenu");
    const btn = document.querySelector(".lang-btn");
    if(menu && btn && !menu.contains(e.target) && !btn.contains(e.target)){
      menu.classList.remove("active");
    }
  });
});


/* === ACTIVE BOTTOM NAV ON SCROLL === */
document.addEventListener("DOMContentLoaded", function(){
  const sections = document.querySelectorAll("section[id]");
  const navItems = document.querySelectorAll('.bottom-nav .nav-item[href^="#"]');
  window.addEventListener("scroll", function(){
    let current = "";
    sections.forEach(section => {
      if(window.scrollY >= section.offsetTop - 220){ current = section.getAttribute("id"); }
    });
    navItems.forEach(item => {
      item.classList.toggle("active", item.getAttribute("href") === "#" + current);
    });
  });
});


/* === HERO BUTTONS === */
document.addEventListener("DOMContentLoaded", function(){
  const WA_LINK = "https://wa.me/6285174229436?text=Halo%20bang%20mau%20order%20edit";

  const topBtn = document.getElementById("goTopCustomerBtn");
  const waBtn  = document.getElementById("orderWhatsappBtn");

  if(topBtn){
    topBtn.addEventListener("click", function(e){
      e.preventDefault();
      const target = document.getElementById("top-list") || document.getElementById("top") || document.querySelector(".cards");
      if(target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if(waBtn){
    waBtn.addEventListener("click", function(e){
      e.preventDefault();
      window.open(WA_LINK, "_blank", "noopener");
    });
  }
});


/* === ORDER STATUS (auto open/close 13:00–23:00) === */
(function(){
  const OPEN_HOUR  = 13;
  const CLOSE_HOUR = 23;

  function updateStatus(){
    const open = (function(){ const h = new Date().getHours(); return h >= OPEN_HOUR && h < CLOSE_HOUR; })();
    const lang = localStorage.getItem("siteLang") || "id";
    const t = translations[lang] || translations.id;

    document.querySelectorAll("#statusCard, .status-card").forEach(function(card){
      card.classList.toggle("available", open);
      card.classList.toggle("closed", !open);

      const title = card.querySelector("#statusTitle, h3");
      if(title) title.textContent = open ? t.statusTitle : t.statusClosedTitle;

      const desc = card.querySelector("#statusDesc, p");
      if(desc) desc.textContent = open ? t.statusDesc : t.statusClosedDesc;

      const dot = card.querySelector(".status-dot");
      if(dot){ dot.classList.toggle("closed", !open); }

      // rebuild meta row cleanly
      let meta = card.querySelector(".status-meta");
      if(!meta){
        meta = document.createElement("div");
        meta.className = "status-meta";
        card.appendChild(meta);
      }
      meta.innerHTML = `
        <span class="status-slot"><svg class="icon" aria-hidden="true"><use href="#icon-fire"></use></svg><b>${open ? t.statusSlot : t.statusClosed}</b></span>
        <span class="status-hours"><svg class="icon" aria-hidden="true"><use href="#icon-clock"></use></svg><b>${t.statusHours}</b></span>
      `;
    });
  }

  document.addEventListener("DOMContentLoaded", function(){
    updateStatus();
    setInterval(updateStatus, 30000);
  });
  document.addEventListener("languagechanged", updateStatus);
})();


/* === BEFORE / AFTER SLIDER === */
document.addEventListener("DOMContentLoaded", function(){
  const range  = document.getElementById("previewRange");
  const wrap   = document.getElementById("previewAfterWrap");
  const handle = document.getElementById("previewHandle");
  if(!range || !wrap || !handle) return;

  function update(){
    const v = range.value;
    wrap.style.width   = v + "%";
    handle.style.left  = v + "%";
  }

  range.addEventListener("input", update);
  update();
});


/* === RECENT TIKTOK DATA === */
document.addEventListener("DOMContentLoaded", function(){
  if(typeof recentTikTokData === "undefined") return;
  const d = recentTikTokData;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  const setHref = (id, val) => { const el = document.getElementById(id); if(el) el.href = val; };
  const setSrc  = (id, val) => { const el = document.getElementById(id); if(el && val) el.src = val; };

  set("tiktokCaption",  d.caption);
  set("tiktokUploaded", d.uploaded);
  set("tiktokViews",    d.views);
  set("tiktokComments", d.comments);
  set("tiktokShares",   d.shares);
  setSrc("tiktokThumb", d.thumbnailUrl);
  setHref("tiktokLink",      d.videoUrl);
  setHref("tiktokLinkThumb", d.videoUrl);
});


/* === MIKI AI CHAT === */
(function(){
  const ANSWERS = {
    "berapa lama proses editnya":
      "Estimasi proses edit biasanya 1 sampai 3 hari, tergantung antrean, durasi video, dan tingkat ribet request. Kalau cuma ringan bisa lebih cepat.",
    "harga cc gameplay":
      "Harga CC Gameplay mulai dari Rp35.000. Bikin warna gameplay lebih hidup dan nggak kelihatan mentah.",
    "harga order edit":
      "Harga order edit mulai dari Rp50.000, tergantung konsep dan durasi. Edit kompleks harga menyesuaikan.",
    "harga hd-in video":
      "Harga HD-in video mulai dari Rp10.000 sampai Rp25.000. Tergantung kualitas source dan output yang diminta."
  };

  const QUESTIONS = [
    "Berapa lama proses editnya",
    "Harga CC Gameplay",
    "Harga Order Edit",
    "Harga HD-in Video"
  ];

  function getBox(){ return document.getElementById("mikiAiMessages"); }
  function scrollBot(){ const b = getBox(); if(b) b.scrollTop = b.scrollHeight; }

  window.openMikiAi = function(){
    const panel = document.getElementById("mikiAiPanel");
    if(!panel) return;
    panel.classList.add("active");
    panel.setAttribute("aria-hidden","false");
    const box = getBox();
    if(box && box.children.length === 0) window.resetMikiAi();
  };

  window.closeMikiAi = function(){
    const panel = document.getElementById("mikiAiPanel");
    if(!panel) return;
    panel.classList.remove("active");
    panel.setAttribute("aria-hidden","true");
  };

  window.resetMikiAi = function(){
    const box = getBox();
    if(!box) return;
    box.innerHTML = "";
    QUESTIONS.forEach(function(q){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "miki-ai-question";
      btn.textContent = q;
      btn.addEventListener("click", function(){ window.askMikiAi(q); });
      box.appendChild(btn);
    });
    scrollBot();
  };

  window.askMikiAi = function(question){
    const box = getBox();
    if(!box) return;

    // user bubble
    const user = document.createElement("div");
    user.className = "miki-ai-msg user";
    user.textContent = question;
    box.appendChild(user);

    // typing
    const typing = document.createElement("div");
    typing.className = "miki-ai-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    box.appendChild(typing);
    scrollBot();

    setTimeout(function(){
      typing.remove();
      const bot = document.createElement("div");
      bot.className = "miki-ai-msg bot";
      bot.textContent = ANSWERS[question.toLowerCase()] || "Chat admin aja biar lebih jelas.";
      box.appendChild(bot);
      scrollBot();
    }, 900);
  };

  document.addEventListener("DOMContentLoaded", function(){
    window.resetMikiAi();
  });
})();
