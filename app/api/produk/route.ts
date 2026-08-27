import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function GET(request: Request) {
  try {
    // Ambil parameter pagination dari URL
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    // Query dengan pagination
    const { data, error, count } = await supabase
      .from('barang')
      .select('*', { count: 'exact' }) // Hitung total data
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1); // Pagination

    if (error) throw error;

    return NextResponse.json({ 
      status: 'sukses', 
      data: data,
      total: count || 0,
      page: page,
      limit: limit,
      totalPages: Math.ceil((count || 0) / limit)
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // Validasi data wajib
    if (!payload.qr || !payload.nama_barang) {
      return NextResponse.json({ 
        status: 'error', 
        pesan: 'QR dan nama_barang wajib diisi' 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('barang')
      .upsert({
        qr: payload.qr,
        nama_barang: payload.nama_barang,
        kategori: payload.kategori || '',
        status_bpom: payload.status_bpom || '',
        tipe: payload.tipe || '',
        jumlah_1: payload.jumlah_1 || 0,
        modal_1: payload.modal_1 || 0,
        jumlah_2: payload.jumlah_2 || 0,
        modal_2: payload.modal_2 || 0,
        jumlah_3: payload.jumlah_3 || 0,
        modal_3: payload.modal_3 || 0,
        jual_a: payload.jual_a || 0,
        jual_b: payload.jual_b || 0,
        jual_c: payload.jual_c || 0,
        jual_d: payload.jual_d || 0,
        jual_e: payload.jual_e || 0,
        jual_f: payload.jual_f || 0,
        jual_g: payload.jual_g || 0,
        jual_h: payload.jual_h || 0,
        jual_i: payload.jual_i || 0,
      }, { onConflict: 'qr' });

    if (error) throw error;
    return NextResponse.json({ status: 'sukses', pesan: 'Data berhasil disimpan' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

// Tambahan endpoint untuk bulk upload
export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    
    if (!payload.data || !Array.isArray(payload.data) || payload.data.length === 0) {
      return NextResponse.json({ 
        status: 'error', 
        pesan: 'Data array kosong atau tidak valid' 
      }, { status: 400 });
    }

    // Validasi semua data
    const invalidData = payload.data.some((row: any) => !row.qr || !row.nama_barang);
    if (invalidData) {
      return NextResponse.json({ 
        status: 'error', 
        pesan: 'Semua baris harus memiliki qr dan nama_barang' 
      }, { status: 400 });
    }

    // Bulk upsert
    const { error } = await supabase
      .from('barang')
      .upsert(payload.data, { onConflict: 'qr' });

    if (error) throw error;
    
    return NextResponse.json({ 
      status: 'sukses', 
      pesan: `${payload.data.length} data berhasil disimpan` 
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const qr = searchParams.get('qr');
    
    if (!qr) {
      // Jika tidak ada parameter qr, coba baca dari body
      const payload = await request.json();
      if (!payload.qr) {
        return NextResponse.json({ 
          status: 'error', 
          pesan: 'Parameter qr diperlukan' 
        }, { status: 400 });
      }
      
      const { error } = await supabase
        .from('barang')
        .delete()
        .eq('qr', payload.qr);
      
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('barang')
        .delete()
        .eq('qr', qr);
      
      if (error) throw error;
    }
    
    return NextResponse.json({ 
      status: 'sukses', 
      pesan: 'Data berhasil dihapus' 
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}