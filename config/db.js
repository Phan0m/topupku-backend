const mongoose = require('mongoose');

// Fungsi untuk konek ke Database
const connectDB = async () => {
    // URL Database dari screenshot Anda
    const LINK_DATABASE = 'mongodb+srv://admin:123@cluster0.xfyyycf.mongodb.net/topupku?retryWrites=true&w=majority&appName=Cluster0';

    try {
        await mongoose.connect(LINK_DATABASE);
        console.log('✅ BERHASIL Konek ke MongoDB Cloud!');
    } catch (error) {
        console.error('❌ Gagal konek DB:', error);
        process.exit(1);
    }
};

module.exports = connectDB;