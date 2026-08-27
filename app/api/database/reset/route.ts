import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

// Data Default yang HARUS dipertahankan saat factory reset
const DEFAULT_PENGATURAN = {
  // Identitas Toko
  Toko_Nama: 'Nama Toko Anda',
  Toko_Kontak: '08xxxxxxxxxx',
  Toko_Alamat: 'Alamat Toko Anda',
  
  // Warna Default
  Warna_Header1: '#00acc1',
  Warna_Header2: '#26c6da',
  Warna_Footer1: '#00838f',
  Warna_Footer2: '#4dd0e1',
  Warna_BgUtama: '#F3F3E9',
  Warna_BgLite: '#FCFCFA',
  Warna_TeksGelap: '#2D3715',
  Warna_Aksen: '#D32F2F',
  
  // Struk Default
  Struk_Kertas: '58mm',
  Struk_FontSize: '12px',
  Struk_FormatWaktu: 'DD/MM/YYYY HH:mm',
  Struk_Otomatis: 'true',
  Struk_ShowID: 'true',
  Struk_ShowWaktu: 'true',
  Struk_ShowKasir: 'true',
  Struk_ShowPlg: 'false',
  Struk_Label_ID: 'ID:',
  Struk_Label_Waktu: 'Waktu:',
  Struk_Label_Kasir: 'Kasir:',
  Struk_Label_Plg: 'Pelanggan:',
  
  // Sandi Transaksi Default
  Sandi_A: 'Mutasi',
  Sandi_B: 'Retur',
  Sandi_C: '',
  Sandi_D: 'Pemasukan Toko',
  Sandi_E: 'Belanja Barang',
  Sandi_F: 'HPP',
  Sandi_G: 'Hasil Ndalem',
  Sandi_H: 'Biaya Kost',
  Sandi_I: 'Syahriyyah',
  Sandi_J: 'Thoharoh',
  Sandi_K: 'Transport dan Paket',
  Sandi_L: 'Biaya Listrik',
  Sandi_M: 'Biaya Kuota, pulsa & wifi',
  Sandi_N: 'Iuran Musyawaroh',
  Sandi_O: 'Biaya Perawatan Mobil',
  Sandi_P: "Biaya Ro'an",
  Sandi_Q: 'Keperluan Ndalem',
  Sandi_R: 'Shodaqoh Harian',
  Sandi_S: 'Transaksi Bank',
  Sandi_T: 'Biaya Air Minum',
  Sandi_U: '',
  Sandi_V: 'Operasional lain-lain',
  Sandi_W: 'Hutang - Piutang',
  Sandi_X: 'Pemasukan Lain (non-penjualan)',
  Sandi_Y: '',
  Sandi_Z: 'Pemberian Laba Bersih',
  
  // Level Harga Default
  ...Object.fromEntries(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].flatMap(tipe => [
      [`Label_Aktif_${tipe}`, 'false'],
      [`Label_Harga_${tipe}`, `Harga ${tipe}`],
      [`Aturan_Harga_${tipe}`, 'Manual'],
      [`Member_Khusus_${tipe}`, ''],
      [`Hari_Khusus_${tipe}`, 'Semua']
    ])
  )
};

export async function POST(request: Request) {
  try {
    const { mode } = await request.json(); // 'soft', 'hard', atau 'factory'

    const clearTable = async (tableName: string, idColumn: string) => {
      const { error } = await supabase.from(tableName).delete().not(idColumn, 'is', null);
      if (error) {
        console.error(`Error pada tabel ${tableName}:`, error);
        throw new Error(`Gagal mereset tabel ${tableName}: ${error.message}`);
      }
    };

    // --- 1. LEVEL 1: SOFT RESET (Selalu Dieksekusi) ---
    await clearTable('transaksi_detail', 'id_detail');
    await clearTable('transaksi', 'id_transaksi');
    await clearTable('pembelian_detail', 'id_restok');
    await clearTable('pembelian', 'id_pembelian');
    await clearTable('jurnal', 'id');
    await clearTable('jurnal_keuangan', 'ID_Jurnal');

    // --- 2. LEVEL 2: HARD RESET (Dieksekusi jika mode 'hard' ATAU 'factory') ---
    if (mode === 'hard' || mode === 'factory') {
      await clearTable('barang', 'qr');
      await clearTable('pelanggan', 'id_pelanggan');
      await clearTable('supplier', 'id_supplier');
      await clearTable('karyawan', 'id_karyawan');
    }

    // --- 3. LEVEL 3: FACTORY RESET (Hanya dieksekusi jika mode 'factory') ---
    if (mode === 'factory') {
      // Hapus data Dompet / Rekening
      await clearTable('data_dompet', 'id_dompet');
      
      // RESET pengaturan ke nilai default (BUKAN hapus semua)
      await resetPengaturan(DEFAULT_PENGATURAN);
      
      // Buat ulang dompet default
      await createDefaultDompet();
    }

    return NextResponse.json({ 
      status: 'sukses', 
      pesan: `Reset (${mode}) berhasil. Sistem siap digunakan kembali.` 
    }, { status: 200 });
    
  } catch (err: any) {
    return NextResponse.json({ 
      status: 'error', 
      pesan: err.message 
    }, { status: 500 });
  }
}

// Fungsi untuk reset pengaturan ke nilai default
async function resetPengaturan(defaultData: Record<string, string>) {
  try {
    // 1. Hapus semua pengaturan lama
    const { error: deleteError } = await supabase
      .from('pengaturan')
      .delete()
      .not('kunci', 'is', null); // Ganti 'kunci' dengan nama kolom ID yang benar
    
    if (deleteError) throw deleteError;
    
    // 2. Insert data default baru
    const rowsToInsert = Object.entries(defaultData).map(([kunci, nilai]) => ({
      kunci, // Ganti 'kunci' dengan nama kolom yang benar
      nilai // Ganti 'nilai' dengan nama kolom yang benar
    }));
    
    const { error: insertError } = await supabase
      .from('pengaturan')
      .insert(rowsToInsert);
    
    if (insertError) throw insertError;
    
    console.log('✅ Pengaturan default berhasil dipulihkan');
  } catch (error) {
    console.error('❌ Gagal reset pengaturan:', error);
    throw new Error('Gagal memulihkan pengaturan default');
  }
}

// Fungsi untuk membuat dompet default
async function createDefaultDompet() {
  try {
    const dompetDefault = {
      id_dompet: `KAS-DEFAULT-${Date.now().toString().slice(-4)}`,
      nama_dompet: 'Laci Kas',
      kategori: 'Tunai',
      saldo_aktif: 0,
      status_aktif: 'true'
    };
    
    const { error } = await supabase
      .from('data_dompet')
      .insert([dompetDefault]);
    
    if (error) throw error;
    
    console.log('✅ Dompet default berhasil dibuat');
  } catch (error) {
    console.error('❌ Gagal membuat dompet default:', error);
    // Tidak throw error agar factory reset tetap berhasil
  }
}