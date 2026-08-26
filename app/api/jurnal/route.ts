export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

// GET: Ambil semua jurnal (gabungan manual + otomatis dari transaksi)
export async function GET() {
  try {
    // 1. Ambil jurnal manual
    const { data: jurnalManual, error: errManual } = await supabase.from('jurnal').select('*');
    if (errManual) console.warn('Error jurnal manual:', errManual.message);
    
    // 2. Ambil transaksi penjualan (Kasir)
    const { data: transaksiKasir, error: errKasir } = await supabase.from('transaksi').select('*');
    if (errKasir) console.warn('Error transaksi kasir:', errKasir.message);
    
    // 3. Ambil transaksi pembelian (Restok) - Sesuaikan nama tabel jika perlu ('pembelian' / 'restok_header')
    const { data: transaksiRestok, error: errRestok } = await supabase.from('pembelian').select('*');
    if (errRestok) console.warn('Error transaksi restok:', errRestok.message);
    
    let gabunganData: any[] = [];
    
    // ============ NORMALISASI JURNAL MANUAL ============
    if (jurnalManual && Array.isArray(jurnalManual)) {
      const mappedManual = jurnalManual.map(j => ({
        id: j.id,
        waktu: j.waktu,
        tipe: j.tipe,
        kategori: j.kategori,
        sandi: j.sandi ? j.sandi.charAt(0).toUpperCase() : '', // Ambil huruf pertamanya saja
        keterangan: j.keterangan,
        nominal: Number(j.nominal),
        akunSumber: j.akun_sumber || '',
        akunTujuan: j.akun_tujuan || '',
        referensi: j.referensi || '',
        sumber: 'MANUAL'
      }));
      gabunganData = [...gabunganData, ...mappedManual];
    }
    
    // ============ NORMALISASI TRANSAKSI KASIR (PENJUALAN) ============
    if (transaksiKasir && Array.isArray(transaksiKasir)) {
      const mappedKasir = transaksiKasir.map(t => {
        const nominal = Number(t.total_belanja || 0);
        const metode = t.metode_pembayaran || 'Tunai';
        
        return {
          id: t.id_transaksi,
          waktu: t.waktu || t.created_at,
          tipe: 'Pemasukan',
          kategori: 'Penjualan Kasir',
          sandi: 'D', // KUNCI PERBAIKAN: Langsung tembak ke Sandi D
          keterangan: `Penjualan - ${t.nama_pelanggan || 'Pelanggan Umum'} (${metode})`,
          nominal: nominal,
          akunSumber: '',
          akunTujuan: t.id_dompet || '',
          referensi: t.id_transaksi,
          sumber: 'KASIR'
        };
      });
      gabunganData = [...gabunganData, ...mappedKasir];
    }
    
    // ============ NORMALISASI TRANSAKSI RESTOK (PEMBELIAN) ============
    if (transaksiRestok && Array.isArray(transaksiRestok)) {
      const mappedRestok = transaksiRestok.map(r => {
        const totalTagihan = Number(r.total_tagihan || 0);
        const status = r.status || 'Lunas';
        
        return {
          id: r.id_pembelian || r.id_restok,
          waktu: r.waktu || r.created_at,
          tipe: 'Pengeluaran',
          kategori: status === 'Hutang' ? 'Hutang Restok' : 'Pembelian Restok',
          sandi: 'E', // KUNCI PERBAIKAN: Langsung tembak ke Sandi E
          keterangan: `Restok - ${r.id_supplier || 'Supplier'} (${status})`,
          nominal: totalTagihan,
          akunSumber: r.id_dompet || '',
          akunTujuan: '',
          referensi: r.id_pembelian || r.id_restok,
          sumber: 'RESTOK'
        };
      });
      gabunganData = [...gabunganData, ...mappedRestok];
    }
    
    // Urutkan berdasarkan waktu terbaru
    gabunganData.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());
    
    return NextResponse.json({ status: 'sukses', data: gabunganData }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}