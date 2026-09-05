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
    
    // 3. Ambil detail transaksi (untuk HPP dan Retur)
    const { data: transaksiDetail, error: errDetail } = await supabase.from('transaksi_detail').select('*');
    if (errDetail) console.warn('Error transaksi detail:', errDetail.message);
    
    // 4. Ambil transaksi pembelian (Restok)
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
        akunSumber: j.akun_sumber || '',
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
        const isOnline = String(t.id_transaksi || '').toUpperCase().startsWith('OL-') || 
                         String(t.metode_penjualan || '').toUpperCase().includes('ONLINE');
        
        return {
          id: t.id_transaksi,
          waktu: t.waktu || t.created_at,
          tipe: 'Pemasukan',
          kategori: isOnline ? 'Penjualan Online' : 'Penjualan Offline',
          sandi: 'D', 
          keterangan: `Penjualan ${isOnline ? 'Online' : 'Offline'} - ${t.nama_pelanggan || 'Pelanggan Umum'} (${metode})`,
          nominal: nominal,
          akunSumber: '',
          akunTujuan: t.id_dompet || '',
          referensi: t.id_transaksi,
          sumber: 'KASIR'
        };
      });
      gabunganData = [...gabunganData, ...mappedKasir];
    }
    
    // ============ NORMALISASI HPP (SANDI F) DARI DETAIL TRANSAKSI ============
    if (transaksiDetail && Array.isArray(transaksiDetail)) {
      // Kelompokkan HPP per transaksi
      const hppMap = new Map<string, { total: number; waktu: string; id_transaksi: string }>();
      
      transaksiDetail.forEach(detail => {
        const idDetail = String(detail.id_detail || '').toUpperCase();
        
        // Skip retur (B-) karena akan dihitung terpisah
        if (idDetail.startsWith('B-')) return;
        
        const idTransaksi = detail.id_transaksi;
        const subModal = Number(detail.subtotal_modal || 0);
        
        if (subModal > 0 && idTransaksi) {
          if (!hppMap.has(idTransaksi)) {
            hppMap.set(idTransaksi, {
              total: 0,
              waktu: detail.waktu || new Date().toISOString(),
              id_transaksi: idTransaksi
            });
          }
          hppMap.get(idTransaksi)!.total += subModal;
        }
      });
      
      // Convert HPP map ke array jurnal
      hppMap.forEach((value, idTransaksi) => {
        gabunganData.push({
          id: `HPP-${idTransaksi}`,
          waktu: value.waktu,
          tipe: 'Pemasukan', // HPP dihitung sebagai pemasukan di laporan (nilai positif)
          kategori: 'HPP (Terjual)',
          sandi: 'F',
          keterangan: `HPP - ${idTransaksi}`,
          nominal: value.total,
          akunSumber: '',
          akunTujuan: 'Kas',
          referensi: idTransaksi,
          sumber: 'HPP'
        });
      });
    }
    
    // ============ NORMALISASI RETUR (SANDI B) DARI DETAIL TRANSAKSI ============
    if (transaksiDetail && Array.isArray(transaksiDetail)) {
      // Kelompokkan retur per transaksi
      const returMap = new Map<string, { total: number; waktu: string; id_transaksi: string }>();
      
      transaksiDetail.forEach(detail => {
        const idDetail = String(detail.id_detail || '').toUpperCase();
        
        // Hanya ambil detail retur (B-)
        if (!idDetail.startsWith('B-')) return;
        
        const idTransaksi = detail.id_transaksi;
        const subJual = Math.abs(Number(detail.subtotal_jual || 0));
        
        if (subJual > 0 && idTransaksi) {
          if (!returMap.has(idTransaksi)) {
            returMap.set(idTransaksi, {
              total: 0,
              waktu: detail.waktu || new Date().toISOString(),
              id_transaksi: idTransaksi
            });
          }
          returMap.get(idTransaksi)!.total += subJual;
        }
      });
      
      // Convert retur map ke array jurnal
      returMap.forEach((value, idTransaksi) => {
        gabunganData.push({
          id: `RTR-${idTransaksi}`,
          waktu: value.waktu,
          tipe: 'Pengeluaran',
          kategori: 'Retur (Pengurangan Kas Ditukar Barang)',
          sandi: 'B',
          keterangan: `Retur - ${idTransaksi}`,
          nominal: value.total,
          akunSumber: 'Kas',
          akunTujuan: '',
          referensi: idTransaksi,
          sumber: 'RETUR'
        });
      });
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
    
    return NextResponse.json({ 
      status: 'sukses', 
      data: gabunganData,
      metadata: {
        total: gabunganData.length,
        sumberManual: gabunganData.filter(d => d.sumber === 'MANUAL').length,
        sumberKasir: gabunganData.filter(d => d.sumber === 'KASIR').length,
        sumberHpp: gabunganData.filter(d => d.sumber === 'HPP').length,
        sumberRetur: gabunganData.filter(d => d.sumber === 'RETUR').length,
        sumberRestok: gabunganData.filter(d => d.sumber === 'RESTOK').length,
        timestamp: new Date().toISOString()
      }
    }, { status: 200 });
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
  try {
    // Ambil saldo terakhir
    const { data: dompetData, error: errGet } = await supabase
      .from('data_dompet')
      .select('saldo_aktif')
      .eq('id_dompet', idDompet)
      .single();
      
    if (errGet || !dompetData) {
      console.warn(`Dompet ${idDompet} tidak ditemukan`);
      return;
    }
    
    const saldoBaru = aksi === 'tambah' 
      ? Number(dompetData.saldo_aktif) + nominal 
      : Number(dompetData.saldo_aktif) - nominal;
      
    // Update saldo
    const { error: errUpdate } = await supabase
      .from('data_dompet')
      .update({ saldo_aktif: saldoBaru })
      .eq('id_dompet', idDompet);
      
    if (errUpdate) {
      console.warn(`Gagal update saldo dompet ${idDompet}:`, errUpdate.message);
    }
  } catch (err) {
    console.warn('Error update saldo:', err);
  }
}