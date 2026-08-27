export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

// ==========================================
// GET: Ambil semua jurnal (Gabungan)
// ==========================================
export async function GET() {
  try {
    // 1. Ambil jurnal manual
    const { data: jurnalManual, error: errManual } = await supabase.from('jurnal').select('*');
    if (errManual) console.warn('Error jurnal manual:', errManual.message);
    
    // 2. Ambil transaksi penjualan (Kasir)
    const { data: transaksiKasir, error: errKasir } = await supabase.from('transaksi').select('*');
    if (errKasir) console.warn('Error transaksi kasir:', errKasir.message);
    
    // 3. Ambil transaksi pembelian (Restok)
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
        sandi: j.sandi ? String(j.sandi).charAt(0).toUpperCase() : '', 
        keterangan: j.keterangan,
        nominal: Number(j.nominal),
        akunSumber: j.akun_sumber || '', // Mapping ke camelCase untuk frontend
        akunTujuan: j.akun_tujuan || '',
        referensi: j.referensi || '',
        sumber: 'MANUAL'
      }));
      gabunganData = [...gabunganData, ...mappedManual];
    }
    
    // ============ NORMALISASI TRANSAKSI KASIR ============
    if (transaksiKasir && Array.isArray(transaksiKasir)) {
      const mappedKasir = transaksiKasir.map(t => {
        const nominal = Number(t.total_belanja || 0);
        const metode = t.metode_pembayaran || 'Tunai';
        
        return {
          id: t.id_transaksi,
          waktu: t.waktu || t.created_at,
          tipe: 'Pemasukan',
          kategori: 'Penjualan Kasir',
          sandi: 'D', 
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
    
    // ============ NORMALISASI TRANSAKSI RESTOK ============
    if (transaksiRestok && Array.isArray(transaksiRestok)) {
      const mappedRestok = transaksiRestok.map(r => {
        const totalTagihan = Number(r.total_tagihan || 0);
        const status = r.status || 'Lunas';
        
        return {
          id: r.id_pembelian || r.id_restok,
          waktu: r.waktu || r.created_at,
          tipe: 'Pengeluaran',
          kategori: status === 'Hutang' ? 'Hutang Restok' : 'Pembelian Restok',
          sandi: 'E', 
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


// ==========================================
// POST: Simpan Jurnal Manual (Termasuk Mutasi/Pemasukan/Pengeluaran)
// ==========================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Ekstraksi huruf pertama dari format "A. Mutasi" untuk disimpan ke DB
    let sandiTersimpan = '';
    if (body.sandi) {
      sandiTersimpan = String(body.sandi).trim().charAt(0).toUpperCase();
    }

    // Mapping payload dari frontend (camelCase) ke struktur database (snake_case)
    const payload = {
      waktu: body.waktu || new Date().toISOString(),
      tipe: body.tipe,
      kategori: body.kategori,
      sandi: sandiTersimpan,
      keterangan: body.keterangan,
      nominal: Number(body.nominal),
      akun_sumber: body.akunSumber || null,
      akun_tujuan: body.akunTujuan || null,
      referensi: body.referensi || null
    };

    // 1. Simpan ke tabel jurnal
    const { data: insertedJurnal, error: errInsert } = await supabase
      .from('jurnal')
      .insert([payload])
      .select();

    if (errInsert) throw new Error(`Gagal menyimpan jurnal: ${errInsert.message}`);

    // 2. [OPSIONAL TAPI PENTING] UPDATE SALDO DOMPET
    // Jika kamu TIDAK MENGGUNAKAN TRIGGER DATABASE, lakukan update saldo manual di sini
    const nominal = Number(body.nominal);
    
    if (body.tipe === 'Pemasukan' && payload.akun_tujuan) {
      await updateSaldoDompet(payload.akun_tujuan, nominal, 'tambah');
    } 
    else if (body.tipe === 'Pengeluaran' && payload.akun_sumber) {
      await updateSaldoDompet(payload.akun_sumber, nominal, 'kurang');
    } 
    else if (body.tipe === 'Mutasi' && payload.akun_sumber && payload.akun_tujuan) {
      await updateSaldoDompet(payload.akun_sumber, nominal, 'kurang');
      await updateSaldoDompet(payload.akun_tujuan, nominal, 'tambah');
    }

    return NextResponse.json({ 
      status: 'sukses', 
      pesan: 'Transaksi berhasil dicatat',
      data: insertedJurnal 
    }, { status: 200 });
    
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

// Helper untuk Update Saldo (Jika dibutuhkan)
async function updateSaldoDompet(idDompet: string, nominal: number, aksi: 'tambah' | 'kurang') {
  // Ambil saldo terakhir
  const { data: dompetData, error: errGet } = await supabase
    .from('data_dompet')
    .select('saldo_aktif')
    .eq('id_dompet', idDompet)
    .single();
    
  if (errGet || !dompetData) return;
  
  const saldoBaru = aksi === 'tambah' 
    ? Number(dompetData.saldo_aktif) + nominal 
    : Number(dompetData.saldo_aktif) - nominal;
    
  // Update saldo
  await supabase
    .from('data_dompet')
    .update({ saldo_aktif: saldoBaru })
    .eq('id_dompet', idDompet);
}