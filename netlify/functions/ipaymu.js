const crypto = require('crypto');

exports.handler = async (event, context) => {
  // Hanya izinkan metode POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  // Gunakan API Sandbox untuk testing awal
  // Jika sudah live, ubah menjadi: "https://my.ipaymu.com/api/v2/payment"
  const API_URL = "https://sandbox.ipaymu.com/api/v2/payment"; 
  const VA = process.env.IPAYMU_VA; 
  const API_KEY = process.env.IPAYMU_API_KEY;

  if (!VA || !API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "API Keys belum dikonfigurasi di Netlify" }) };
  }

  try {
    const { buyerName, buyerPhone, buyerEmail, amount } = JSON.parse(event.body);

    // Format data sesuai standar dokumentasi iPaymu
    const bodyParams = {
      product: ["Langganan King Digital Premium"],
      qty: ["1"],
      price: [amount],
      returnUrl: "https://kingdigitalpayment.netlify.app/success",
      cancelUrl: "https://kingdigitalpayment.netlify.app/cancel",
      notifyUrl: "https://kingdigitalpayment.netlify.app/.netlify/functions/callback",
      buyerName: buyerName,
      buyerEmail: buyerEmail,
      buyerPhone: buyerPhone
    };

    // Proses Enkripsi Signature iPaymu
    const bodyEncrypt = crypto.createHash('sha256')
                              .update(JSON.stringify(bodyParams))
                              .digest('hex')
                              .toLowerCase();
                              
    const stringToSign = `POST:${VA}:${bodyEncrypt}:${API_KEY}`;
    const signature = crypto.createHmac('sha256', API_KEY)
                            .update(stringToSign)
                            .digest('hex');

    // Tembak API iPaymu
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'va': VA,
        'signature': signature
      },
      body: JSON.stringify(bodyParams)
    });

    const responseData = await response.json();

    // Kembalikan response ke Frontend
    if (responseData.Status === 200) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, paymentUrl: responseData.Data.Url })
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: responseData.Message || "Ditolak oleh sistem iPaymu" })
      };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Terjadi kesalahan server internal." }) };
  }
};