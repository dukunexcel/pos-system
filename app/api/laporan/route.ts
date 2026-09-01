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
    // Gunakan Promise.all untuk mengambil semua data secara paralel
    const [
      { data: jurnalData, error: errJurnal },
      { data: transaksiData, error: errTransaksi },
      { data: pembelianData, error: errPembelian },
      { data: transaksiDetailData, error: errTrxDtl },
      { data: pembelianDetailData, error: errPembDtl },
      { data: mutasiData, error: errMutasi }
    ] = await Promise.all([
      supabase.from('jurnal').select('*').order('waktu', { ascending: true }),
      supabase.from('transaksi').select('*').order('waktu', { ascending: true }),
      supabase.from('pembelian').select('*').order('waktu', { ascending: true }),
      supabase.from('transaksi_detail').select('*'),
      supabase.from('pembelian_detail').select('*'),
      supabase.from('mutasi_pelanggan').select('*').order('Waktu', { ascending: true })
    ]);

    // Log error jika ada (tapi tetap lanjutkan)
    if (errJurnal) console.warn('Error jurnal:', errJurnal.message);
    if (errTransaksi) console.warn('Error transaksi:', errTransaksi.message);
    if (errPembelian) console.warn('Error pembelian:', errPembelian.message);
    if (errTrxDtl) console.warn('Error transaksi_detail:', errTrxDtl.message);
    if (errPembDtl) console.warn('Error pembelian_detail:', errPembDtl.message);
    if (errMutasi) console.warn('Error mutasi_pelanggan:', errMutasi.message);

    // Validasi field yang diperlukan ada di response
    const validJurnal = Array.isArray(jurnalData) ? jurnalData : [];
    const validTransaksi = Array.isArray(transaksiData) ? transaksiData : [];
    const validPembelian = Array.isArray(pembelianData) ? pembelianData : [];
    const validTransaksiDetail = Array.isArray(transaksiDetailData) ? transaksiDetailData : [];
    const validPembelianDetail = Array.isArray(pembelianDetailData) ? pembelianDetailData : [];
    const validMutasi = Array.isArray(mutasiData) ? mutasiData : [];

    // Return SEMUA data mentah, biarkan frontend yang mengolah
    return NextResponse.json({ 
      status: 'sukses', 
      data: {
        jurnal: validJurnal,
        transaksi: validTransaksi,
        pembelian: validPembelian,
        transaksiDetail: validTransaksiDetail,
        pembelianDetail: validPembelianDetail,
        mutasi: validMutasi
      },
      metadata: {
        totalJurnal: validJurnal.length,
        totalTransaksi: validTransaksi.length,
        totalPembelian: validPembelian.length,
        totalTransaksiDetail: validTransaksiDetail.length,
        totalPembelianDetail: validPembelianDetail.length,
        totalMutasi: validMutasi.length,
        timestamp: new Date().toISOString()
      }
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (err: any) {
    console.error('Error fatal di API laporan:', err);
    return NextResponse.json({ 
      status: 'error', 
      pesan: err.message || 'Terjadi kesalahan internal',
      detail: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  }
}