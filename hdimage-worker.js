/**
 * MIKI UNIVERSE — HD Image Proxy Worker (Wink.ai / Meitu)
 * Menggunakan API Wink.ai (meitu) untuk upscale gambar.
 * Captcha custom (proof-of-work) tetap dipertahankan.
 * Semua logika upload, delivery, polling mengikuti wink-image-engine.mjs
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
  "Accept": "*/*",
  "Origin": "https://wink.ai",
  "Referer": "https://wink.ai/image-enhancer/upload"
};

const CLIENT_ID = "1189857605";
const VERSION = "5.1.2";
const STRATEGY_URL = "https://strategy.app.meitudata.com";
const BASE_URL = "https://wink.ai";

// Bypass user ID (agar tidak perlu login)
const BYPASS_USER_ID = "1";

// ===== CAPTCHA (sama persis dengan worker sebelumnya) =====
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
  if (!secret) throw new Error("CAPTCHA_SECRET belum diset");
  if (!salt || !timestamp || !signature || !nonce) throw new Error("captcha tidak lengkap");

  const expectedSig = await hmacHex(secret, `${salt}:${timestamp}`);
  if (expectedSig !== signature) throw new Error("signature captcha tidak valid");

  if (Date.now() - Number(timestamp) > CAPTCHA_MAX_AGE_MS) throw new Error("captcha kadaluarsa");

  const hash = await sha256Hex(`${salt}:${nonce}`);
  if (!hash.startsWith("0".repeat(CAPTCHA_DIFFICULTY))) throw new Error("proof-of-work tidak valid");
}

// ===== UTILITY =====
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getFileExt(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext;
}

// ===== WINK ENGINE (pure fetch) =====
async function winkUpscale(imageBlob, filename) {
  const gnum = crypto.randomUUID();
  const jar = new Map(); // simulate cookie jar with Map

  // Set cookies manually (we'll send in headers)
  const cookies = [
    `_sm=${gnum}; Path=/; Domain=wink.ai`,
    `meitustat=${encodeURIComponent(JSON.stringify({ wgid: gnum }))}; Path=/; Domain=wink.ai`,
    `uid=${BYPASS_USER_ID}; Path=/; Domain=wink.ai`
  ];

  function getCookieHeader() {
    return cookies.join('; ');
  }

  async function fetchWink(path, init = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = {
      ...BROWSER_HEADERS,
      'Cookie': getCookieHeader(),
      ...(init.headers || {})
    };
    const res = await fetch(url, { ...init, headers });
    return res;
  }

  async function fetchStrategy(path, init = {}) {
    const url = `${STRATEGY_URL}${path}`;
    const headers = {
      'User-Agent': BROWSER_HEADERS['User-Agent'],
      ...(init.headers || {})
    };
    const res = await fetch(url, { ...init, headers });
    return res;
  }

  // 1. Get sign
  const suffix = getFileExt(filename) || 'jpg';
  const signParams = new URLSearchParams({
    client_id: CLIENT_ID,
    version: VERSION,
    country_code: 'ID',
    gnum,
    client_language: 'en_US',
    client_channel_id: '',
    client_timezone: 'Asia/Jakarta',
    user_id: BYPASS_USER_ID,
    suffix,
    type: 'temp',
    count: '1'
  });

  let signRes = await fetchWink(`/api/file/get_maat_sign.json?${signParams}`);
  if (!signRes.ok) throw new Error(`Gagal dapat sign: HTTP ${signRes.status}`);
  let signData = await signRes.json();
  if (signData.code !== 0) throw new Error(`Gagal dapat sign: ${JSON.stringify(signData).substring(0, 200)}`);
  const sign = signData.data;

  // 2. Get upload policy
  const policyParams = new URLSearchParams({
    app: sign.app,
    count: String(sign.count),
    sig: sign.sig,
    sigTime: sign.sig_time,
    sigVersion: sign.sig_version,
    suffix: sign.suffix,
    type: sign.type
  });
  let policyRes = await fetchStrategy(`/upload/policy?${policyParams}`);
  if (!policyRes.ok) throw new Error(`Gagal dapat policy: HTTP ${policyRes.status}`);
  let policyData = await policyRes.json();
  if (!policyData || !policyData[0] || !policyData[0].qiniu) throw new Error('Policy tidak valid');
  const policy = policyData[0].qiniu;

  // 3. Upload to qiniu
  const form = new FormData();
  form.append('file', imageBlob, filename);
  form.append('token', policy.token);
  form.append('key', policy.key);
  form.append('fname', filename);

  let uploadRes = await fetch(policy.url, {
    method: 'POST',
    body: form,
    headers: {
      'User-Agent': BROWSER_HEADERS['User-Agent']
    }
  });
  if (!uploadRes.ok) throw new Error(`Upload qiniu gagal: HTTP ${uploadRes.status}`);
  let uploadData = await uploadRes.json();
  const source_url = uploadData.url || uploadData.data || policy.data;
  if (!source_url) throw new Error('Tidak dapat source_url dari upload');

  // 4. Delivery (start AI process)
  const type = '12'; // UHD mode
  const functionId = '620';
  const materialId = '62011';
  const taskName = 'Image Quality Enhancer - Ultra HD';

  const bodyParams = new URLSearchParams({
    client_id: CLIENT_ID,
    version: VERSION,
    country_code: 'ID',
    gnum,
    client_language: 'en_US',
    client_channel_id: '',
    client_timezone: 'Asia/Jakarta',
    user_id: BYPASS_USER_ID,
    type,
    content_type: '1',
    source_url,
    type_params: JSON.stringify({
      is_mirror: 0,
      orientation_tag: 1,
      j_420_trans: '1',
      return_ext: '2'
    }),
    right_detail: JSON.stringify({
      source: '1',
      touch_type: '4',
      function_id: functionId,
      material_id: materialId,
      url: 'https://wink.ai/image-enhancer/upload'
    }),
    ext_params: JSON.stringify({
      task_name: taskName,
      records: type
    }),
    with_prepare: '1'
  });

  let deliveryRes = await fetchWink('/api/meitu_ai/delivery.json', {
    method: 'POST',
    body: bodyParams.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    }
  });
  if (!deliveryRes.ok) throw new Error(`Delivery gagal: HTTP ${deliveryRes.status}`);
  let deliveryData = await deliveryRes.json();
  if (deliveryData.code !== 0) throw new Error(`Delivery gagal: ${JSON.stringify(deliveryData).substring(0, 200)}`);

  let msgId = deliveryData.data?.msg_id || deliveryData.data?.prepare_msg_id;
  if (!msgId) throw new Error('Tidak ada msg_id');

  // 5. Polling
  for (let i = 0; i < 60; i++) {
    await sleep(3000);

    const queryParams = new URLSearchParams({
      client_id: CLIENT_ID,
      version: VERSION,
      country_code: 'ID',
      gnum,
      client_language: 'en_US',
      client_channel_id: '',
      client_timezone: 'Asia/Jakarta',
      user_id: BYPASS_USER_ID,
      msg_ids: msgId
    });

    let queryRes = await fetchWink(`/api/meitu_ai/query_batch.json?${queryParams}`);
    if (!queryRes.ok) throw new Error(`Query gagal: HTTP ${queryRes.status}`);
    let queryData = await queryRes.json();
    const item = queryData.data?.item_list?.[0];
    if (!item) continue;

    const result = item.result;
    // Follow redirect msg_id
    const nextId = result?.result || result?.msg_id;
    if (nextId && nextId !== msgId && !nextId.startsWith('http') && !nextId.startsWith('wpr_')) {
      msgId = nextId;
      continue;
    }

    const errorCode = result?.error_code;
    const mediaInfo = result?.media_info_list?.[0];
    const rawUrl = mediaInfo?.raw_media_data;      // tanpa watermark
    const watermarkedUrl = mediaInfo?.media_data;   // dengan watermark

    if ((rawUrl || watermarkedUrl) && errorCode === 0) {
      const finalUrl = rawUrl || watermarkedUrl;
      return finalUrl;
    }

    if (errorCode && errorCode !== 29901 && errorCode !== 0) {
      throw new Error(`Wink error ${errorCode}: ${result?.error_msg || 'Unknown'}`);
    }
  }

  throw new Error('Timeout polling (3 menit)');
}

// ===== WORKER HANDLER =====
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Captcha challenge
    if (request.method === 'GET' && url.searchParams.get('action') === 'captcha-challenge') {
      try {
        const challenge = await issueCaptchaChallenge(env.CAPTCHA_SECRET);
        return json(challenge);
      } catch (e) {
        console.error('[Wink Worker] Captcha challenge error:', e.message);
        return json({ error: 'Gagal menyiapkan captcha' }, 500);
      }
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method tidak didukung' }, 405);
    }

    let imageBlob, filename, captchaFields;
    try {
      const formData = await request.formData();
      imageBlob = formData.get('image');
      filename = formData.get('filename') || 'image.jpg';
      captchaFields = {
        captchaSalt: formData.get('captchaSalt'),
        captchaTimestamp: formData.get('captchaTimestamp'),
        captchaSignature: formData.get('captchaSignature'),
        captchaNonce: formData.get('captchaNonce')
      };
      if (!imageBlob) throw new Error('Gambar tidak ditemukan');
    } catch (e) {
      console.error('[Wink Worker] Request parse error:', e.message);
      return json({ error: 'Gagal memproses gambar. Coba lagi.' }, 400);
    }

    // Verifikasi captcha
    try {
      await verifyCaptchaSolution(captchaFields, env.CAPTCHA_SECRET);
    } catch (e) {
      console.error('[Wink Worker] Captcha verification failed:', e.message);
      return json({ error: 'Verifikasi captcha gagal. Coba lagi.' }, 403);
    }

    try {
      // Proses upscale via Wink
      const resultUrl = await winkUpscale(imageBlob, filename);

      // Stream hasil gambar
      const imgRes = await fetch(resultUrl, {
        headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] },
        signal: AbortSignal.timeout(60000)
      });
      if (!imgRes.ok || !imgRes.body) {
        throw new Error(`Gagal ambil hasil gambar (${imgRes.status})`);
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      return new Response(imgRes.body, {
        status: 200,
        headers: { 'Content-Type': contentType, ...CORS_HEADERS }
      });
    } catch (e) {
      console.error('[Wink Worker] Upscale failed:', e.message);
      // Pesan error generik untuk user
      return json({ error: 'Gagal memproses gambar. Coba lagi beberapa saat.' }, 500);
    }
  }
};