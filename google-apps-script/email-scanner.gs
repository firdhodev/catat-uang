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
  SCAN_INTERVAL_HOURS: 0.25,  // scan setiap 15 menit
  MAX_EMAILS_PER_RUN: 20,     // maks email per eksekusi
  DAYS_BACK: 1,               // scan email N hari terakhir
};

// ============================================================
// DAFTAR SENDER EMAIL YANG DIPANTAU
// Sesuaikan dengan bank/ewallet yang kamu pakai
// ============================================================
const MONITORED_SENDERS = [
  // Bank
  'notifikasi@bca.co.id',
  'notifikasi@bankmandiri.co.id',
  'notif@bni.co.id',
  'info@bri.co.id',
  'hello@jenius.com',
  'noreply@seabank.co.id',

  // E-Wallet
  'noreply@gojek.com',
  'no-reply@ovo.id',
  'noreply@dana.id',
  'no-reply@shopee.co.id',
  'noreply@flip.id',

  // PayLater
  'notification@akulaku.com',
  'noreply@kredivo.com',
];

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
// FUNGSI UTAMA — Dipanggil otomatis oleh trigger
// ============================================================
function scanEmails() {
  Logger.log('=== Smart Money Tracker - Email Scan Start ===');
  Logger.log('Time: ' + new Date().toISOString());

  const processedIds = getProcessedEmailIds();
  let scanned = 0;
  let pushed = 0;
  let skipped = 0;

  try {
    for (const sender of MONITORED_SENDERS) {
      if (scanned >= CONFIG.MAX_EMAILS_PER_RUN) break;

      const query = `from:(${sender}) newer_than:${CONFIG.DAYS_BACK}d`;
      const threads = GmailApp.search(query, 0, 5);

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

          // Cek apakah ini email transaksi
          if (!isTransactionEmail(subject, body)) {
            Logger.log('Bukan transaksi, skip: ' + subject);
            skipped++;
            markAsProcessed(msgId, 'skipped');
            continue;
          }

          // Push ke Supabase
          const platformName = detectPlatformName(sender);
          const success = pushToSupabase({
            gmail_message_id: msgId,
            platform_name: platformName,
            subject: subject,
            body: truncateText(body, 5000), // batasi 5000 char
            received_at: msg.getDate().toISOString(),
          });

          if (success) {
            pushed++;
            markAsProcessed(msgId, 'pushed');
            Logger.log('✅ Pushed: ' + subject + ' | Platform: ' + platformName);
          } else {
            Logger.log('❌ Failed to push: ' + subject);
          }

          scanned++;
          Utilities.sleep(500); // jeda 500ms antar request
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
// ============================================================
function isTransactionEmail(subject, body) {
  const combined = (subject + ' ' + body).toLowerCase();
  for (const keyword of TRANSACTION_KEYWORDS) {
    if (combined.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  return false;
}

// ============================================================
// DETEKSI NAMA PLATFORM DARI SENDER EMAIL
// ============================================================
function detectPlatformName(senderEmail) {
  const platformMap = {
    'bca.co.id': 'BCA',
    'bankmandiri.co.id': 'Mandiri',
    'bni.co.id': 'BNI',
    'bri.co.id': 'BRI',
    'jenius.com': 'Jenius',
    'seabank.co.id': 'SeaBank',
    'gojek.com': 'GoPay',
    'ovo.id': 'OVO',
    'dana.id': 'DANA',
    'shopee.co.id': 'ShopeePay',
    'flip.id': 'Flip',
    'akulaku.com': 'Akulaku',
    'kredivo.com': 'Kredivo',
  };

  for (const [domain, name] of Object.entries(platformMap)) {
    if (senderEmail.includes(domain)) return name;
  }
  return senderEmail;
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

function markAsProcessed(msgId, status) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('processed_ids') || '[]';
  const ids = JSON.parse(raw);
  ids.push(msgId);

  // Simpan max 500 ID terakhir
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
  // Hapus trigger lama jika ada
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'scanEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Buat trigger baru setiap 15 menit
  ScriptApp.newTrigger('scanEmails')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('✅ Trigger berhasil dipasang! Scan setiap 15 menit.');
  Logger.log('Kamu bisa jalankan scanEmails() sekarang untuk test pertama kali.');
}

// ============================================================
// HAPUS SEMUA TRIGGER (untuk reset)
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
// TEST — Scan manual untuk 1 sender tertentu
// ============================================================
function testScanSingleSender() {
  const testSender = 'noreply@gojek.com'; // ubah sesuai kebutuhan
  const query = `from:(${testSender}) newer_than:7d`;
  const threads = GmailApp.search(query, 0, 3);

  Logger.log(`Mencari email dari: ${testSender}`);
  Logger.log(`Ditemukan ${threads.length} thread`);

  for (const thread of threads) {
    const msg = thread.getMessages()[0];
    Logger.log('Subject: ' + msg.getSubject());
    Logger.log('Is transaction: ' + isTransactionEmail(msg.getSubject(), msg.getPlainBody()));
    Logger.log('---');
  }
}
