const midtransClient = require('midtrans-client');

// Inisialisasi Snap Client
let snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY
});

exports.createTransaction = async (req, res) => {
    try {
        // Data dinamis dari Frontend
        const { orderId, amount, customerDetails } = req.body;

        let parameter = {
            "transaction_details": {
                "order_id": orderId, // ID unik (misal: "TRX-12345")
                "gross_amount": amount // Total harga (misal: 50000)
            },
            "customer_details": customerDetails,
            // Opsional: Aktifkan fitur tertentu
            "credit_card":{
                "secure" : true
            }
        };

        // Minta Token ke Midtrans
        const transaction = await snap.createTransaction(parameter);

        // Kirim token kembali ke Frontend
        res.status(200).json({ token: transaction.token });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};