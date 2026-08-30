import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase dengan error handling yang lebih baik
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Validasi payload untuk mencegah duplikasi kode
function validateBarangItem(item: any): boolean {
  return !!(item.qr && item.nama_barang);
}

function validateBarangData(data: any[]): boolean {
  return data.every(validateBarangItem);
}

function prepareBarangData(payload: any) {
  return {
    qr: payload.qr,
    nama_barang: payload.nama_barang,
    kategori: payload.kategori || '',
    status_bpom: payload.status_bpom || '',
    tipe: payload.tipe || '',
    jumlah_1: Number(payload.jumlah_1) || 0,
    modal_1: Number(payload.modal_1) || 0,
    jumlah_2: Number(payload.jumlah_2) || 0,
    modal_2: Number(payload.modal_2) || 0,
    jumlah_3: Number(payload.jumlah_3) || 0,
    modal_3: Number(payload.modal_3) || 0,
    jual_a: Number(payload.jual_a) || 0,
    jual_b: Number(payload.jual_b) || 0,
    jual_c: Number(payload.jual_c) || 0,
    jual_d: Number(payload.jual_d) || 0,
    jual_e: Number(payload.jual_e) || 0,
    jual_f: Number(payload.jual_f) || 0,
    jual_g: Number(payload.jual_g) || 0,
    jual_h: Number(payload.jual_h) || 0,
    jual_i: Number(payload.jual_i) || 0,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    // Beri izin server untuk mengembalikan lebih dari 100 baris
    const limit = parseInt(searchParams.get('limit') || '1000'); 
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('barang')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ 
      status: 'sukses', 
      data: data,
      total: count || 0,
      page: page,
      limit: limit,
      totalPages: Math.ceil((count || 0) / limit) // INI KUNCI UTAMANYA
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Bulk upload
    if (payload.data && Array.isArray(payload.data)) {
      if (payload.data.length === 0) {
        return NextResponse.json({
          status: 'error',
          message: 'Data array is empty'
        }, { status: 400 });
      }

      if (!validateBarangData(payload.data)) {
        return NextResponse.json({
          status: 'error',
          message: 'All rows must have qr and nama_barang'
        }, { status: 400 });
      }

      const { error } = await supabase
        .from('barang')
        .upsert(payload.data, { 
          onConflict: 'qr',
          ignoreDuplicates: false
        });

      if (error) throw error;

      return NextResponse.json({
        status: 'success',
        message: `${payload.data.length} items uploaded successfully`
      }, { status: 200 });
    }

    // Single item upload
    if (!validateBarangItem(payload)) {
      return NextResponse.json({
        status: 'error',
        message: 'qr and nama_barang are required'
      }, { status: 400 });
    }

    const preparedData = prepareBarangData(payload);
    const { error } = await supabase
      .from('barang')
      .upsert(preparedData, { 
        onConflict: 'qr',
        ignoreDuplicates: false
      });

    if (error) throw error;

    return NextResponse.json({
      status: 'success',
      message: 'Item saved successfully'
    }, { status: 200 });

  } catch (error: any) {
    console.error('POST Error:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Failed to save data'
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();

    if (!payload.data || !Array.isArray(payload.data) || payload.data.length === 0) {
      return NextResponse.json({
        status: 'error',
        message: 'Invalid or empty data array'
      }, { status: 400 });
    }

    if (!validateBarangData(payload.data)) {
      return NextResponse.json({
        status: 'error',
        message: 'All rows must have qr and nama_barang'
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('barang')
      .upsert(payload.data, { 
        onConflict: 'qr',
        ignoreDuplicates: false
      });

    if (error) throw error;

    return NextResponse.json({
      status: 'success',
      message: `${payload.data.length} items updated successfully`
    }, { status: 200 });

  } catch (error: any) {
    console.error('PUT Error:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Failed to update data'
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let qr = searchParams.get('qr');

    // Jika tidak ada di query params, coba dari body
    if (!qr) {
      try {
        const payload = await request.json();
        qr = payload.qr;
      } catch {
        // Body tidak valid atau tidak ada
      }
    }

    if (!qr) {
      return NextResponse.json({
        status: 'error',
        message: 'qr parameter is required'
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('barang')
      .delete()
      .eq('qr', qr);

    if (error) throw error;

    return NextResponse.json({
      status: 'success',
      message: 'Item deleted successfully'
    }, { status: 200 });

  } catch (error: any) {
    console.error('DELETE Error:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Failed to delete data'
    }, { status: 500 });
  }
}