// ============================================================
// Config Firebase project "Miki Universe"
// JANGAN takut nge-expose ini ke publik, ini memang dirancang buat dipasang di client-side.
// Yang menjaga keamanan data adalah Firestore Security Rules, bukan config ini.
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyCop8JoFqb1IogjonyEZOOWT7olkhwhKUM",
  authDomain: "miki-universe.firebaseapp.com"",
  projectId: "miki-universe",
  storageBucket: "miki-universe.firebasestorage.app",
  messagingSenderId: "628595985901",
  appId: "1:628595985901:web:b45cb17a98a0cd41e2ebe4"
};

// Daftar email yang otomatis jadi admin begitu pertama kali login/daftar pakai email ini.
// Boleh isi lebih dari satu, pisahkan dengan koma.
// Setelah jadi admin, lu juga bisa naikin admin lain lewat Admin Panel di web.
export const BOOTSTRAP_ADMIN_EMAILS = [
  "mine14788@gmail.com"
];
