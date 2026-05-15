const crypto = require("crypto");
const axios = require("axios");

// Format wajib untuk Netlify
exports.handler = async (event, context) => {
    // Pastikan request berupa POST
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ message: 'Gunakan method POST' }) 
        };
    }

    // Mengambil kunci rahasia dari Netlify nanti
    const merchantCode = process.env.DUITKU_MERCHANT_CODE;
    const apiKey = process.env.DUITKU_API_KEY;
    
    // Di Netlify, data pesanan harus di-parse (diterjemahkan) dulu
    const body = JSON.parse(event.body);
    const { orderId, paymentAmount, productDetails, email, returnUrl } = body;

    // Rumus gembok keamanan Duitku
    const signatureString = `${merchantCode}${orderId}${paymentAmount}${apiKey}`;
    const signature = crypto.createHash("md5").update(signatureString).digest("hex");

    // Menyiapkan paket data ke Duitku
    const payload = {
        merchantCode: merchantCode,
        paymentAmount: paymentAmount,
        merchantOrderId: orderId,
        productDetails: productDetails || "Langganan King Premium",
        email: email || "user@email.com",
        signature: signature,
        returnUrl: returnUrl || "https://google.com" 
    };

    try {
        // Tembak API Duitku Mode Sandbox
        const response = await axios.post("https://api-sandbox.duitku.com/api/merchant/createinvoice", payload);
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, paymentUrl: response.data.paymentUrl })
        };
    } catch (error) {
        // Tangkap pesan error aslinya agar gampang diperbaiki
        const alasanDuitku = error.response && error.response.data ? error.response.data.Message : error.message;
        
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: "Ditolak Duitku: " + alasanDuitku })
        };
    }
};