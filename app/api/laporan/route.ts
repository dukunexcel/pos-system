export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

// ==========================================
// GET: Ambil SEMUA data untuk laporan (TANPA FILTER)
// ==========================================
export async function GET() {
  try {
    // 1. Ambil jurnal manual
    const { data: jurnalData, error: errJurnal } = await supabase.from('jurnal').select('*');
    if (errJurnal) console.warn('Error jurnal:', errJurnal.message);
    
    // 2. Ambil transaksi penjualan (Kasir)
    const { data: transaksiData, error: errTransaksi } = await supabase.from('transaksi').select('*');
    if (errTransaksi) console.warn('Error transaksi:', errTransaksi.message);
    
    // 3. Ambil transaksi pembelian (Restok)
    const { data: pembelianData, error: errPembelian } = await supabase.from('pembelian').select('*');
    if (errPembelian) console.warn('Error pembelian:', errPembelian.message);
    
    // 4. Ambil detail transaksi
    const { data: transaksiDetailData, error: errTrxDtl } = await supabase.from('transaksi_detail').select('*');
    if (errTrxDtl) console.warn('Error transaksi_detail:', errTrxDtl.message);
    
    // 5. Ambil detail pembelian
    const { data: pembelianDetailData, error: errPembDtl } = await supabase.from('pembelian_detail').select('*');
    if (errPembDtl) console.warn('Error pembelian_detail:', errPembDtl.message);
    
    // 6. Ambil mutasi pelanggan
    const { data: mutasiData, error: errMutasi } = await supabase.from('mutasi_pelanggan').select('*');
    if (errMutasi) console.warn('Error mutasi_pelanggan:', errMutasi.message);
    
    // Return SEMUA data mentah, biarkan frontend yang mengolah
    return NextResponse.json({ 
      status: 'sukses', 
      data: {
        jurnal: jurnalData || [],
        transaksi: transaksiData || [],
        pembelian: pembelianData || [],
        transaksiDetail: transaksiDetailData || [],
        pembelianDetail: pembelianDetailData || [],
        mutasi: mutasiData || []
      }
    }, { status: 200 });
    
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}