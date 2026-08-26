import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function GET() {
  const { data, error } = await supabase.from('supplier').select('*').order('nama_supplier', { ascending: true });
  if (error) return NextResponse.json({ status: 'error', pesan: error.message }, { status: 500 });
  return NextResponse.json({ status: 'sukses', data: data }, { status: 200 });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const { error } = await supabase.from('supplier').upsert({
    id_supplier: payload.id_supplier, nama_supplier: payload.nama_supplier, kontak_wa: payload.kontak_wa || '',
    alamat: payload.alamat || '', status_aktif: payload.status_aktif || 'true'
  }, { onConflict: 'id_supplier' });
  if (error) return NextResponse.json({ status: 'error', pesan: error.message }, { status: 500 });
  return NextResponse.json({ status: 'sukses' }, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  const { error } = await supabase.from('supplier').delete().eq('id_supplier', id);
  if (error) return NextResponse.json({ status: 'error', pesan: error.message }, { status: 500 });
  return NextResponse.json({ status: 'sukses' }, { status: 200 });
}