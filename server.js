require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const midtransClient = require('midtrans-client');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// 1. KONEKSI DATABASE
const MONGO_URI = "mongodb+srv://adminutama:123@cluster0.xfyyycf.mongodb.net/topupku?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Terhubung ke MongoDB Atlas'))
  .catch((err) => console.error('❌ Gagal Konek Database:', err.message));

// 2. MODEL DATA
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }
}));

const TransactionSchema = new mongoose.Schema({
    orderId: String,
    username: String,
    item: String,
    amount: Number,
    status: { type: String, default: 'Pending' }, 
    date: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', TransactionSchema);

// 3. KONFIGURASI MIDTRANS (CoreApi untuk Notifikasi lebih akurat)
// Gunakan Server Key Anda
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;

let snap = new midtransClient.Snap({
    isProduction : false,
    serverKey : SERVER_KEY
});

// apiClient untuk verifikasi tanda tangan (signature)
let apiClient = new midtransClient.CoreApi({
    isProduction : false,
    serverKey : SERVER_KEY,
    clientKey : 'Mid-client-pEiy7of20ulHHHcD'
});

// ================= ROUTE API =================
app.post('/login', async (req, res) => {
    // 1. Tangkap apa yang dikirim dari Frontend
    console.log("---------------------------------------");
    console.log("📨 ADA ORANG MAU LOGIN!");
    
    const { username, password } = req.body;
    console.log("👉 Username diketik:", `"${username}"`); 
    console.log("👉 Password diketik:", `"${password}"`);

    // 2. Cek Admin Manual
    if (username === 'AdminUtama' && password === '123') {
        console.log("✅ Login Admin Berhasil");
        return res.status(200).json({
            message: 'Login Berhasil (Admin)',
            user: { username: 'AdminUtama', role: 'admin', token: 'admin-secret' }
        });
    }

    // 3. Cari User di Database
    const user = await User.findOne({ username: username.trim() }); 

    if (!user) {
        console.log("❌ GAGAL: Username tidak ditemukan di Database.");
        return res.status(401).json({ message: 'Username tidak terdaftar!' });
    }

    console.log("✅ User Ditemukan di DB:", user.username);
    console.log("🔑 Password di DB:", `"${user.password}"`);

    // 4. Bandingkan Password
    if (user.password === password) {
        console.log("🎉 SUKSES: Password COCOK!");
        return res.status(200).json({
            message: 'Login Berhasil',
            user: { username: user.username, role: user.role || 'user', token: 'user-token' }
        });
    } else {
        console.log("🚫 GAGAL: Password BEDA!");
        console.log(`(Input: "${password}" vs Database: "${user.password}")`);
        return res.status(401).json({ message: 'Password Salah!' });
    }
});
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: 'Username sudah dipakai' });
    const newUser = new User({ username, password, role: 'user' });
    await newUser.save();
    res.status(201).json({ message: 'Pendaftaran Berhasil!' });
});

// --- TRANSAKSI (GET & POST) ---
app.get('/api/transactions', async (req, res) => {
    try {
        const allTransactions = await Transaction.find().sort({ date: -1 });
        res.status(200).json(allTransactions);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data' });
    }
});

app.post('/api/payment', async (req, res) => {
    try {
        const { orderId, amount, itemDetails, customerDetails } = req.body;
        let parameter = {
            "transaction_details": { "order_id": orderId, "gross_amount": amount },
            "credit_card":{ "secure" : true },
            "customer_details": customerDetails
        };
        const transactionToken = await snap.createTransaction(parameter);

        // Simpan transaksi awal sebagai PENDING
        const newTrans = new Transaction({
            orderId: orderId,
            username: customerDetails.first_name,
            item: itemDetails,
            amount: amount,
            status: 'Pending'
        });
        await newTrans.save();

        res.status(200).json({ token: transactionToken.token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ======================================================
//  BAGIAN PENTING: MENERIMA LAPORAN STATUS DARI MIDTRANS
// ======================================================
app.post('/api/notification', async (req, res) => {
    try {
        const statusResponse = req.body;
        let orderId = statusResponse.order_id;
        let transactionStatus = statusResponse.transaction_status;
        let fraudStatus = statusResponse.fraud_status;

        console.log(`Laporan Masuk: Order ${orderId} statusnya ${transactionStatus}`);

        let newStatus = 'Pending';

        if (transactionStatus == 'capture') {
            if (fraudStatus == 'challenge') {
                newStatus = 'Challenge'; // Indikasi penipuan
            } else if (fraudStatus == 'accept') {
                newStatus = 'Success'; // Pembayaran Kartu Sukses
            }
        } else if (transactionStatus == 'settlement') {
            newStatus = 'Success'; // Pembayaran selain kartu (Gopay/VA/Indomaret) Sukses!
        } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
            newStatus = 'Failed'; // Gagal atau Kadaluarsa
        } else if (transactionStatus == 'pending') {
            newStatus = 'Pending';
        }

        // UPDATE DATABASE KITA SESUAI LAPORAN MIDTRANS
        await Transaction.findOneAndUpdate(
            { orderId: orderId }, 
            { status: newStatus }
        );

        console.log(`✅ Database diupdate: Order ${orderId} menjadi ${newStatus}`);
        
        // Wajib balas OK ke Midtrans agar tidak dikirim ulang
        res.status(200).send('OK');

    } catch (error) {
        console.error("Gagal memproses notifikasi:", error);
        res.status(500).send("Error");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});

module.exports = app;

// Update Midtrans Client