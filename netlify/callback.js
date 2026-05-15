// Menggunakan modul querystring bawaan Node.js
const querystring = require('querystring');

exports.handler = async (event, context) => {
  // 1. Tolak secara otomatis jika bukan POST request
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 2. Tangkap data yang dikirim iPaymu
    // iPaymu biasanya mengirim data dalam format form URL-encoded
    let paymentData;
    if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
        paymentData = JSON.parse(event.body);
    } else {
        paymentData = querystring.parse(event.body);
    }

    // 3. Cetak data yang masuk di log Netlify (Untuk kebutuhan debugging)
    console.log("=== NOTIFIKASI PEMBAYARAN MASUK DARI IPAYMU ===");
    console.log("Status Pembayaran:", paymentData.status);
    console.log("ID Transaksi (Trx ID):", paymentData.trx_id);
    console.log("Nominal Masuk:", paymentData.total);
    console.log("Detail Lengkap:", paymentData);

    // 4. Logika Update Database Aplikasi
    if (paymentData.status === 'berhasil' || paymentData.status === 'sukses') {
        // TODO: Tulis kode untuk mengubah status pelanggan di database (misal: Supabase/Firebase) menjadi "Lunas" / "Premium"
        console.log(`[SUKSES] Pembayaran ${paymentData.trx_id} lunas! Akses Premium siap diaktifkan.`);
    } else {
        console.log(`[INFO] Transaksi ${paymentData.trx_id} berstatus: ${paymentData.status}`);
    }

    // 5. Wajib mengembalikan status 200 OK ke iPaymu
    return {
      statusCode: 200,
      body: "Callback diterima dengan sukses"
    };

  } catch (error) {
    console.error("Error memproses callback:", error);
    return { 
      statusCode: 500, 
      body: "Terjadi kesalahan internal pada sistem callback" 
    };
  }
};