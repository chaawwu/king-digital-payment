const admin = require('firebase-admin');

// Inisialisasi Firebase Admin dengan Environment Variables
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Replace untuk menangani format newline (\n) di Netlify env vars
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
        })
    });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
    // 1. Hanya izinkan metode POST (Webhook standar dari iPaymu)
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        let status, referenceId, trxId;

        // 2. Mengurai data yang dikirim iPaymu dengan aman
        try {
            const params = new URLSearchParams(event.body);
            status = params.get('status');
            referenceId = params.get('reference_id'); 
            trxId = params.get('trx_id');
            
            // Jika parsing URLSearchParams gagal/kosong, coba parse sebagai JSON
            if (!status && event.body) {
                const bodyData = JSON.parse(event.body);
                status = bodyData.status;
                referenceId = bodyData.reference_id;
                trxId = bodyData.trx_id;
            }
        } catch (e) {
            console.error("Gagal parsing data dari iPaymu:", e);
            return { statusCode: 400, body: 'Bad Request: Format data tidak valid' };
        }

        console.log(`[INFO] Menerima Callback - Trx ID: ${trxId}, Order ID: ${referenceId}, Status: ${status}`);

        if (!referenceId) {
            return { statusCode: 400, body: 'Reference ID tidak ditemukan' };
        }

        // 3. Tentukan status baru untuk database kita
        let newStatus = 'Menunggu Pembayaran (Otomatis)';
        const statusLower = status ? status.toLowerCase() : '';

        if (statusLower === 'berhasil') {
            newStatus = 'Sedang Diproses';
        } else if (statusLower === 'gagal' || statusLower === 'expired') {
            newStatus = 'Ditolak';
        } else {
            console.log(`[INFO] Transaksi ${referenceId} berstatus: ${statusLower}. Tidak ada perubahan di database.`);
        }

        // 4. Update database Firebase (BAGIAN INI YANG SEBELUMNYA HILANG DI VS CODE CAK)
        if (statusLower === 'berhasil' || statusLower === 'gagal' || statusLower === 'expired') {
            await db.collection('artifacts')
                .doc('kingdigital-default-app')
                .collection('public')
                .doc('data')
                .collection('orders')
                .doc(referenceId)
                .update({
                    status: newStatus,
                    updatedViaWebhook: new Date().toISOString()
                });
            console.log(`[SUCCESS] Order ${referenceId} berhasil diupdate ke status: ${newStatus}`);
        }

        // 5. Wajib mengembalikan status 200 OK ke iPaymu agar mereka tidak mengirim notifikasi berulang-ulang
        return {
            statusCode: 200,
            body: "Callback diterima dengan sukses"
        };

    } catch (error) {
        console.error("[ERROR] Terjadi kesalahan fatal saat memproses callback:", error);
        return {
            statusCode: 500,
            body: "Terjadi kesalahan internal pada sistem callback"
        };
    }
};