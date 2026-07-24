/**
 * MIKI UNIVERSE — HD Image Proxy Worker (WINK.AI VERSION)
 * Upload gambar user -> proses via Wink.ai API -> stream hasilnya langsung
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const BASE_URL = "https://wink.ai";
const STRATEGY_URL = "https://strategy.app.meitudata.com";
const CLIENT_ID = "1189857605";
const VERSION = "5.1.2";
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";
const BYPASS_USER_ID = "1";

const BROWSER_HEADERS = {
  "User-Agent": UA,
  "Accept": "*/*"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

/* --- Captcha custom (proof-of-work) --- */
const CAPTCHA_DIFFICULTY = 4;
const CAPTCHA_MAX_AGE_MS = 5 * 60 * 1000;

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return bufToHex(buf);
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bufToHex(sig);
}

async function issueCaptchaChallenge(secret) {
  if (!secret) throw new Error("CAPTCHA_SECRET belum diset di Worker Secrets");
  const salt = crypto.randomUUID();
  const timestamp = Date.now();
  const signature = await hmacHex(secret, `${salt}:${timestamp}`);
  return { salt, timestamp, difficulty: CAPTCHA_DIFFICULTY, signature };
}

async function verifyCaptchaSolution(fields, secret) {
  const { captchaSalt: salt, captchaTimestamp: timestamp, captchaSignature: signature, captchaNonce: nonce } = fields;
  if (!secret) throw new Error("CAPTCHA_SECRET belum diset di Worker Secrets");
  if (!salt || !timestamp || !signature || !nonce) throw new Error("captcha tidak lengkap");

  const expectedSig = await hmacHex(secret, `${salt}:${timestamp}`);
  if (expectedSig !== signature) throw new Error("signature captcha tidak valid");

  if (Date.now() - Number(timestamp) > CAPTCHA_MAX_AGE_MS) throw new Error("captcha kadaluarsa");

  const hash = await sha256Hex(`${salt}:${nonce}`);
  if (!hash.startsWith("0".repeat(CAPTCHA_DIFFICULTY))) throw new Error("proof-of-work tidak valid");
}

/* --- Upload ke host sementara --- */
async function uploadTo0x0(imageBlob, filename) {
  const form = new FormData();
  form.append("file", imageBlob, filename);
  const res = await fetch("https://0x0.st", {
    method: "POST",
    body: form,
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(30000)
  });
  const text = (await res.text()).trim();
  if (!text.startsWith("https://")) throw new Error("0x0.st gagal: " + text.slice(0, 80));
  return text;
}

async function uploadToTmpfiles(imageBlob, filename) {
  const form = new FormData();
  form.append("file", imageBlob, filename);
  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  const data = await res.json();
  if (!data?.data?.url) throw new Error("tmpfiles gagal");
  return data.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
}

async function uploadToLitterbox(imageBlob, filename) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("time", "1h");
  form.append("fileToUpload", imageBlob, filename);
  const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  const text = (await res.text()).trim();
  if (!text.startsWith("https://")) throw new Error("litterbox gagal: " + text.slice(0, 80));
  return text;
}

async function uploadImage(imageBlob, filename) {
  const hosts = [
    { name: "0x0.st", fn: () => uploadTo0x0(imageBlob, filename) },
    { name: "litterbox", fn: () => uploadToLitterbox(imageBlob, filename) },
    { name: "tmpfiles", fn: () => uploadToTmpfiles(imageBlob, filename) }
  ];
  const errors = [];
  for (const host of hosts) {
    try {
      const url = await host.fn();
      console.log(`Upload berhasil via ${host.name}: ${url}`);
      return url;
    } catch (e) {
      errors.push(`${host.name}: ${e.message}`);
      console.log(`${host.name} gagal: ${e.message}`);
    }
  }
  throw new Error("Semua upload host gagal: " + errors.join(" | "));
}

/* --- Wink.ai helper functions --- */
function createSession() {
  const gnum = crypto.randomUUID();
  const headers = {
    ...BROWSER_HEADERS,
    "Cookie": `_sm=${gnum}; meitustat=${encodeURIComponent(JSON.stringify({ wgid: gnum }))}; uid=${BYPASS_USER_ID}`,
    "Origin": BASE_URL,
    "Referer": `${BASE_URL}/image-enhancer/upload`
  };
  return { gnum, headers };
}

function baseParams(gnum, extra = {}) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    version: VERSION,
    country_code: "ID",
    gnum,
    client_language: "en_US",
    client_channel_id: "",
    client_timezone: "Asia/Jakarta",
    user_id: BYPASS_USER_ID,
    ...extra
  });
  return params;
}

async function getMaatSign(gnum, suffix) {
  const signParams = baseParams(gnum, { suffix, type: "temp", count: "1" });
  const res = await fetch(`${BASE_URL}/api/file/get_maat_sign.json?${signParams}`, {
    method: "GET",
    headers: createSession().headers,
    signal: AbortSignal.timeout(30000)
  });
  
  if (!res.ok) {
    throw new Error(`Gagal mendapatkan sign dari Wink: ${res.status}`);
  }
  
  const data = await res.json();
  if (data?.code !== 0) {
    throw new Error("Gagal dapat sign: " + JSON.stringify(data).substring(0, 200));
  }
  
  return data.data;
}

async function getUploadPolicy(sign) {
  const policyParams = new URLSearchParams({
    app: sign.app, 
    count: String(sign.count), 
    sig: sign.sig,
    sigTime: sign.sig_time, 
    sigVersion: sign.sig_version, 
    suffix: sign.suffix, 
    type: sign.type
  });
  
  const res = await fetch(`${STRATEGY_URL}/upload/policy?${policyParams}`, {
    method: "GET",
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(30000)
  });
  
  if (!res.ok) {
    throw new Error(`Gagal mendapatkan policy upload: ${res.status}`);
  }
  
  const data = await res.json();
  if (!data?.[0]?.qiniu) {
    throw new Error("Gagal dapat policy upload");
  }
  
  return data[0].qiniu;
}

async function uploadToWinkCDN(imageBlob, filename, gnum) {
  const suffix = "." + (filename.split('.').pop() || 'jpg');
  const sign = await getMaatSign(gnum, suffix);
  const policy = await getUploadPolicy(sign);
  
  const form = new FormData();
  form.append("file", imageBlob, filename);
  form.append("token", policy.token);
  form.append("key", policy.key);
  form.append("fname", filename);
  
  const uploadRes = await fetch(policy.url, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60000)
  });
  
  if (!uploadRes.ok) {
    throw new Error("Upload ke CDN gagal: HTTP " + uploadRes.status);
  }
  
  const uploadData = await uploadRes.json();
  return {
    file_key: policy.key,
    source_url: uploadData.url || uploadData.data || policy.data
  };
}

async function deliverToWinkAI(gnum, sourceUrl, mode = "uhd") {
  const modeConfig = {
    uhd: {
      type: "12",
      functionId: "620",
      materialId: "62011",
      taskName: "Image Quality Enhancer - Ultra HD"
    },
    hd: {
      type: "2",
      functionId: "630",
      materialId: "63011",
      taskName: "Image Quality Enhancer - HD"
    }
  };
  
  const config = modeConfig[mode] || modeConfig.uhd;
  
  const body = baseParams(gnum, {
    type: config.type,
    content_type: "1",
    source_url: sourceUrl,
    type_params: JSON.stringify({
      is_mirror: 0,
      orientation_tag: 1,
      j_420_trans: "1",
      return_ext: "2"
    }),
    right_detail: JSON.stringify({
      source: "1",
      touch_type: "4",
      function_id: config.functionId,
      material_id: config.materialId,
      url: "https://wink.ai/image-enhancer/upload"
    }),
    ext_params: JSON.stringify({
      task_name: config.taskName,
      records: config.type
    }),
    with_prepare: "1"
  });

  const res = await fetch(`${BASE_URL}/api/meitu_ai/delivery.json`, {
    method: "POST",
    body: body.toString(),
    headers: {
      ...createSession().headers,
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    throw new Error(`Delivery gagal: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data?.code !== 0) {
    throw new Error("Delivery gagal: " + JSON.stringify(data).substring(0, 200));
  }

  return data.data?.msg_id || data.data?.prepare_msg_id;
}

async function queryWinkResult(gnum, msgId, maxRetries = 60) {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const qParams = baseParams(gnum, { msg_ids: msgId });
    const qRes = await fetch(`${BASE_URL}/api/meitu_ai/query_batch.json?${qParams}`, {
      method: "GET",
      headers: createSession().headers,
      signal: AbortSignal.timeout(30000)
    });
    
    if (!qRes.ok) continue;
    
    const qData = await qRes.json();
    const item = qData?.data?.item_list?.[0];
    const result = item?.result;
    
    const nextId = result?.result || result?.msg_id;
    if (nextId && nextId !== msgId && !nextId.startsWith("http") && !nextId.startsWith("wpr_")) {
      msgId = nextId;
      continue;
    }
    
    const errorCode = result?.error_code;
    const mediaInfo = result?.media_info_list?.[0];
    const rawUrl = mediaInfo?.raw_media_data;
    const watermarkedUrl = mediaInfo?.media_data;
    
    if ((rawUrl || watermarkedUrl) && errorCode === 0) {
      return rawUrl || watermarkedUrl;
    }
    
    if (errorCode && errorCode !== 29901 && errorCode !== 0) {
      throw new Error(`Wink error ${errorCode}: ${result?.error_msg || "Unknown"}`);
    }
  }
  
  throw new Error("Timeout menunggu hasil dari Wink.ai");
}

async function upscaleWithWink(imageUrl, mode = "uhd") {
  const { gnum, headers } = createSession();
  
  const imgRes = await fetch(imageUrl, { 
    signal: AbortSignal.timeout(30000), 
    headers: BROWSER_HEADERS 
  });
  if (!imgRes.ok) throw new Error(`Gagal download gambar: ${imgRes.status}`);
  
  const blob = await imgRes.blob();
  const filename = "image." + (imageUrl.split('.').pop() || 'jpg');
  
  const { source_url } = await uploadToWinkCDN(blob, filename, gnum);
  
  const msgId = await deliverToWinkAI(gnum, source_url, mode);
  if (!msgId) throw new Error("Tidak ada msg_id dari Wink.ai");
  
  const resultUrl = await queryWinkResult(gnum, msgId);
  return resultUrl;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

    const url = new URL(request.url);

    if (request.method === "GET" && url.searchParams.get("action") === "captcha-challenge") {
      try {
        const challenge = await issueCaptchaChallenge(env.CAPTCHA_SECRET);
        return json(challenge);
      } catch (e) {
        console.error("[HD Worker] Gagal bikin captcha challenge:", e.message);
        return json({ error: "Gagal menyiapkan captcha." }, 500);
      }
    }

    if (request.method !== "POST") return json({ error: "Method tidak didukung." }, 405);

    let imageBlob, filename, captchaFields, mode;
    try {
      const formData = await request.formData();
      imageBlob = formData.get("image");
      filename = formData.get("filename") || "image.jpg";
      mode = formData.get("mode") || "uhd";
      captchaFields = {
        captchaSalt: formData.get("captchaSalt"),
        captchaTimestamp: formData.get("captchaTimestamp"),
        captchaSignature: formData.get("captchaSignature"),
        captchaNonce: formData.get("captchaNonce")
      };
      if (!imageBlob) return json({ ok: false, error: "Gagal memproses gambar. Coba lagi." }, 400);
    } catch (e) {
      console.error("[HD Worker] Request format salah:", e.message);
      return json({ ok: false, error: "Gagal memproses gambar. Coba lagi." }, 400);
    }

    try {
      await verifyCaptchaSolution(captchaFields, env.CAPTCHA_SECRET);
    } catch (e) {
      console.error("[HD Worker] Captcha ditolak:", e.message);
      return json({ ok: false, error: "Verifikasi captcha gagal. Coba lagi." }, 403);
    }

    try {
      const imageUrl = await uploadImage(imageBlob, filename);
      const upscaledUrl = await upscaleWithWink(imageUrl, mode);

      const imgRes = await fetch(upscaledUrl, { 
        signal: AbortSignal.timeout(60000), 
        headers: BROWSER_HEADERS 
      });
      if (!imgRes.ok || !imgRes.body) throw new Error(`Gagal ambil hasil gambar (${imgRes.status})`);

      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      return new Response(imgRes.body, {
        status: 200,
        headers: { "Content-Type": contentType, ...CORS_HEADERS }
      });
    } catch (e) {
      console.error("[HD Worker] Proses gagal:", e.message);
      return json({ ok: false, error: "Gagal memproses gambar. Coba lagi beberapa saat." }, 500);
    }
  }
};
