import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

// 1. GET: Menarik daftar pelanggan
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('pelanggan')
      .select('*')
      .order('nama', { ascending: true }); // Diurutkan berdasarkan alfabet nama

    if (error) throw error;
    return NextResponse.json({ status: 'sukses', data: data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

// 2. POST: Menambah atau Update data pelanggan (Upsert) - Mendukung Single & Bulk
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // === 1. LOGIKA BULK UPLOAD (DARI EXCEL) ===
    if (payload.data && Array.isArray(payload.data)) {
      if (payload.data.length === 0) {
        return NextResponse.json({ status: 'error', pesan: 'Data array kosong' }, { status: 400 });
      }

      // Validasi: pastikan semua baris memiliki id_pelanggan dan nama
      const invalidData = payload.data.some((row: any) => !row.id_pelanggan || !row.nama);
      if (invalidData) {
        return NextResponse.json({ 
          status: 'error', 
          pesan: 'Semua baris di Excel harus memiliki id_pelanggan dan nama' 
        }, { status: 400 });
      }

      // Bulk upsert ke Supabase
      const { error } = await supabase
        .from('pelanggan')
        .upsert(payload.data, { onConflict: 'id_pelanggan' });

      if (error) throw error;
      
      return NextResponse.json({ 
        status: 'sukses', 
        pesan: `${payload.data.length} data pelanggan berhasil di-upload` 
      }, { status: 200 });
    }

    // === 2. LOGIKA INPUT MANUAL (SATU DATA DARI FORM) ===
    // Validasi input manual
    if (!payload.id_pelanggan || !payload.nama) {
      return NextResponse.json({ 
        status: 'error', 
        pesan: 'ID Pelanggan dan Nama wajib diisi' 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('pelanggan')
      .upsert({
        id_pelanggan: payload.id_pelanggan,
        nama: payload.nama,
        tipe: payload.tipe || 'Umum',
        wa: payload.wa || '',
        alamat: payload.alamat || '',
        saldo: payload.saldo || 0,
        piutang: payload.piutang || 0,
        poin_pembelian: payload.poin_pembelian || 0,
        nominal_pembelian: payload.nominal_pembelian || 0, 
        foto: payload.foto || '',
      }, { onConflict: 'id_pelanggan' });

    if (error) throw error;
    return NextResponse.json({ status: 'sukses', pesan: 'Data pelanggan berhasil disimpan' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}