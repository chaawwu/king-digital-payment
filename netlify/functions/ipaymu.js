const crypto = require('crypto');
const axios = require('axios');

exports.handler = async (event, context) => {
    // WAJIB: Header CORS agar tidak diblokir oleh browser website utama (Mencegah "Failed to fetch")
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Tangkap request pre-flight (OPTIONS) dari browser dengan cepat
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    // Tolak jika bukan POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
    }

    try {
        // Ambil data yang dikirim dari index.html Cak
        const { order_id, amount, name, phone, email } = JSON.parse(event.body);

        const apikey = process.env.IPAYMU_API_KEY;
        const va = process.env.IPAYMU_VA;
        const isSandbox = process.env.IPAYMU_SANDBOX === 'true'; 
        
        // Cek jika API key belum dipasang di Netlify
        if (!apikey || !va) {
            return { 
                statusCode: 500, 
                headers: corsHeaders, 
                body: JSON.stringify({ error: "API Key atau VA iPaymu belum diatur di menu Environment Variables Netlify." }) 
            };
        }

        const url = isSandbox 
            ? 'https://sandbox.ipaymu.com/api/v2/payment' 
            : 'https://my.ipaymu.com/api/v2/payment';

        // Rakit data pesanan
        const body = {
            product: ['Langganan King Digital Premium'],
            qty: ['1'],
            price: [amount],
            amount: amount,
            returnUrl: 'https://kingdigitalpremium.my.id/?status=success',
            cancelUrl: 'https://kingdigitalpremium.my.id/?status=canceled',
            notifyUrl: 'https://kingdigitalpayment.netlify.app/.netlify/functions/callback',
            referenceId: order_id,
            buyerName: name,
            buyerEmail: email,
            buyerPhone: phone,
        };

        // Buat enkripsi Signature standar iPaymu v2
        const jsonBody = JSON.stringify(body);
        const signatureText = crypto.createHash('sha256').update(jsonBody).digest('hex');
        const stringToSign = `POST:${va}:${signatureText}:${apikey}`;
        const signature = crypto.createHmac('sha256', apikey).update(stringToSign).digest('hex');
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

        // Kirim request ke server iPaymu
        const response = await axios.post(url, body, {
            headers: {
                'Content-Type': 'application/json',
                'signature': signature,
                'va': va,
                'timestamp': timestamp
            }
        });

        // Selalu kembalikan corsHeaders saat sukses
        if (response.data.Success) {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ paymentUrl: response.data.Data.Url })
            };
        } else {
            return { 
                statusCode: 400, 
                headers: corsHeaders, 
                body: JSON.stringify(response.data) 
            };
        }

    } catch (error) {
        console.error("Error pembuatan payment:", error.message);
        // Selalu kembalikan corsHeaders bahkan saat terjadi error fatal
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Gagal menghubungkan ke payment gateway.", details: error.message })
        };
    }
};