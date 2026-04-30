/**
 * Smart Money Tracker - Google Apps Script
 * Email Scanner & Supabase Pusher
 *
 * CARA SETUP:
 * 1. Buka https://script.google.com → Buat project baru
 * 2. Copy-paste seluruh kode ini
 * 3. Isi SUPABASE_URL dan SUPABASE_KEY di bawah
 * 4. Jalankan fungsi setupTrigger() SEKALI untuk pasang otomatis
 * 5. Authorize akses Gmail saat diminta
 */

// ============================================================
// KONFIGURASI — ISI SESUAI AKUN SUPABASE KAMU
// ============================================================
const CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',  // ← ganti ini
  SUPABASE_KEY: 'your-anon-key-here',                // ← ganti ini
  MAX_EMAILS_PER_RUN: 20,     // maks email per eksekusi
  DAYS_BACK: 1,               // scan email N hari terakhir
};

// ============================================================
// KEYWORDS YANG MENANDAKAN EMAIL ADALAH TRANSAKSI KEUANGAN
// Setidaknya satu harus ada di subject atau body
// ============================================================
const TRANSACTION_KEYWORDS = [
  // Umum
  'transaksi', 'pembayaran', 'transfer', 'debit', 'kredit',
  'bayar', 'terima', 'kirim', 'tarik', 'setor',

  // English
  'payment', 'transaction', 'debit', 'credit', 'transfer',
  'purchase', 'withdrawal', 'deposit',

  // Nominals
  'Rp', 'IDR',
];

// ============================================================
// AMBIL DAFTAR PLATFORM DARI SUPABASE (dinamis dari Settings)
// ============================================================
function getActivePlatforms() {
  try {
    const response = UrlFetchApp.fetch(
      CONFIG.SUPABASE_URL + '/rest/v1/financial_platforms?is_active=eq.true&select=name,email_sender,email_keywords',
      {
        headers: {
          'apikey': CONFIG.SUPABASE_KEY,
          'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
        },
        muteHttpExceptions: true,
      }
    );

    if (response.getResponseCode() === 200) {
      const platforms = JSON.parse(response.getContentText());
      Logger.log('Platform aktif ditemukan: ' + platforms.length);
      return platforms.filter(p => p.email_sender); // hanya yang punya email sender
    }
  } catch (e) {
    Logger.log('Gagal ambil platform dari Supabase: ' + e.message);
  }
  return [];
}

// ============================================================
// FUNGSI UTAMA — Dipanggil otomatis oleh trigger
// ============================================================
function scanEmails() {
  Logger.log('=== Smart Money Tracker - Email Scan Start ===');
  Logger.log('Time: ' + new Date().toISOString());

  // Ambil platform aktif dari Supabase (bukan hardcoded)
  const platforms = getActivePlatforms();

  if (platforms.length === 0) {
    Logger.log('⚠️ Tidak ada platform aktif dengan email sender. Tambahkan di Settings web app.');
    return;
  }

  const processedIds = getProcessedEmailIds();
  let scanned = 0;
  let pushed = 0;
  let skipped = 0;

  try {
    for (const platform of platforms) {
      if (scanned >= CONFIG.MAX_EMAILS_PER_RUN) break;

      const sender = platform.email_sender;
      const query = `from:(${sender}) newer_than:${CONFIG.DAYS_BACK}d`;
      const threads = GmailApp.search(query, 0, 5);

      Logger.log(`Scanning: ${platform.name} (${sender}) → ${threads.length} thread`);

      for (const thread of threads) {
        const messages = thread.getMessages();
        for (const msg of messages) {
          if (scanned >= CONFIG.MAX_EMAILS_PER_RUN) break;

          const msgId = msg.getId();

          // Skip jika sudah diproses
          if (processedIds.has(msgId)) {
            skipped++;
            continue;
          }

          const subject = msg.getSubject();
          const body = msg.getPlainBody();

          // Cek apakah ini email transaksi (gunakan keywords dari platform atau global)
          const platformKeywords = platform.email_keywords || [];
          if (!isTransactionEmail(subject, body, platformKeywords)) {
            Logger.log('Bukan transaksi, skip: ' + subject);
            skipped++;
            markAsProcessed(msgId);
            continue;
          }

          // Push ke Supabase
          const success = pushToSupabase({
            gmail_message_id: msgId,
            platform_name: platform.name,
            subject: subject,
            body: truncateText(body, 5000),
            received_at: msg.getDate().toISOString(),
          });

          if (success) {
            pushed++;
            markAsProcessed(msgId);
            Logger.log('✅ Pushed: ' + subject + ' | Platform: ' + platform.name);
          } else {
            Logger.log('❌ Failed to push: ' + subject);
          }

          scanned++;
          Utilities.sleep(300);
        }
      }
    }
  } catch (e) {
    Logger.log('ERROR di scanEmails: ' + e.message);
  }

  Logger.log('=== Scan Complete ===');
  Logger.log(`Scanned: ${scanned}, Pushed: ${pushed}, Skipped: ${skipped}`);
}

// ============================================================
// CEK APAKAH EMAIL ADALAH TRANSAKSI KEUANGAN
// Cek platform keywords dulu, fallback ke global keywords
// ============================================================
function isTransactionEmail(subject, body, platformKeywords) {
  const combined = (subject + ' ' + body).toLowerCase();

  // Cek platform-specific keywords dulu (lebih spesifik)
  if (platformKeywords && platformKeywords.length > 0) {
    for (const keyword of platformKeywords) {
      if (combined.includes(keyword.toLowerCase())) return true;
    }
  }

  // Fallback ke global keywords
  for (const keyword of TRANSACTION_KEYWORDS) {
    if (combined.includes(keyword.toLowerCase())) return true;
  }

  return false;
}

// ============================================================
// PUSH DATA KE SUPABASE
// ============================================================
function pushToSupabase(data) {
  try {
    const response = UrlFetchApp.fetch(
      CONFIG.SUPABASE_URL + '/rest/v1/pending_emails',
      {
        method: 'POST',
        headers: {
          'apikey': CONFIG.SUPABASE_KEY,
          'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal,resolution=ignore-duplicates',
        },
        payload: JSON.stringify(data),
        muteHttpExceptions: true,
      }
    );

    const code = response.getResponseCode();
    return code === 201 || code === 200 || code === 204;
  } catch (e) {
    Logger.log('Supabase push error: ' + e.message);
    return false;
  }
}

// ============================================================
// TRACKING EMAIL YANG SUDAH DIPROSES (pakai PropertiesService)
// ============================================================
function getProcessedEmailIds() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('processed_ids') || '[]';
  return new Set(JSON.parse(raw));
}

function markAsProcessed(msgId) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('processed_ids') || '[]';
  const ids = JSON.parse(raw);
  ids.push(msgId);
  const trimmed = ids.slice(-500);
  props.setProperty('processed_ids', JSON.stringify(trimmed));
}

function truncateText(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '... [truncated]';
}

// ============================================================
// SETUP TIME TRIGGER (jalankan SEKALI dari GAS Editor)
// ============================================================
function setupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'scanEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger('scanEmails')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('✅ Trigger berhasil dipasang! Scan setiap 15 menit.');
}

// ============================================================
// HAPUS SEMUA TRIGGER
// ============================================================
function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }
  Logger.log('✅ Semua trigger dihapus');
}

// ============================================================
// TEST — Cek koneksi ke Supabase
// ============================================================
function testSupabaseConnection() {
  const response = UrlFetchApp.fetch(
    CONFIG.SUPABASE_URL + '/rest/v1/pending_emails?limit=1',
    {
      headers: {
        'apikey': CONFIG.SUPABASE_KEY,
        'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
      },
      muteHttpExceptions: true,
    }
  );
  Logger.log('Status: ' + response.getResponseCode());
  Logger.log('Response: ' + response.getContentText().substring(0, 200));
}

// ============================================================
// TEST — Lihat platform aktif dari Supabase
// ============================================================
function testGetPlatforms() {
  const platforms = getActivePlatforms();
  Logger.log('Total platform aktif: ' + platforms.length);
  platforms.forEach(p => {
    Logger.log(`- ${p.name}: ${p.email_sender}`);
  });
}

// ============================================================
// TEST — Scan manual sekarang (tanpa nunggu 15 menit)
// ============================================================
function testManualScan() {
  Logger.log('=== Manual Scan Test ===');
  scanEmails();
}
