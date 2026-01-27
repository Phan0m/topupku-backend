require('dotenv').config(); // 1. Wajib ada agar bisa baca .env
const mongoose = require('mongoose');

const connectDB = async () => {
    // 2. Ambil link dari brankas .env
    const LINK_DATABASE = process.env.MONGO_URI;

    try {
        // 3. Gunakan link tersebut
        await mongoose.connect(LINK_DATABASE);
        console.log('✅ BERHASIL Konek ke MongoDB Cloud!');
    } catch (error) {
        console.error('❌ Gagal konek DB:', error);
        process.exit(1);
    }
};

module.exports = connectDB;