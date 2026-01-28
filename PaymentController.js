const midtransClient = require('midtrans-client');

// Inisialisasi Snap Client
let snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY
});

exports.createTransaction = async (req, res) => {
    try {
        // 1. Ambil data dari Frontend
        const { orderId, amount, customerDetails } = req.body;

        // 2. PENTING: Bersihkan harga dari "Rp" dan titik "."
        // Contoh: "Rp 12.500" -> jadi angka 12500
        const cleanAmount = Number(amount.toString().replace(/\D/g, ''));

        // Cek di Logs Vercel (Biar ketahuan kalau ada yang salah)
        console.log("Menerima Order:", orderId, "| Harga Asli:", amount, "| Harga Bersih:", cleanAmount);

        let parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: cleanAmount // Pakai harga yang sudah dibersihkan
            },
            "notification_url": "https://topupku-backend.vercel.app/api/notification",

            customer_details: customerDetails,
            credit_card: {
                secure: true
            }
        };

        // 3. Minta Link Pembayaran ke Midtrans
        const transaction = await snap.createTransaction(parameter);
        
        // 4. Kirim Token/Url balik ke Frontend
        res.status(200).json({
            token: transaction.token,
            redirect_url: transaction.redirect_url
        });

    } catch (error) {
        // Log Error lengkap biar muncul di Vercel Logs
        console.error("❌ ERROR MIDTRANS:", error.message);
        res.status(500).json({ message: error.message });
    }
};

// update notifikasi final