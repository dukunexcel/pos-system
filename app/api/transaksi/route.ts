export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tipe = url.searchParams.get('tipe');
    const id = url.searchParams.get('id');
    
    // Jika ada parameter detail
    if (tipe && id) {
      return await ambilDetailTransaksi(tipe, id);
    }
    
    // Jika tidak, ambil list gabungan
    const { data: dataTrx, error: errTrx } = await supabase.from('transaksi').select('*');
    const { data: dataRestok, error: errRestok } = await supabase.from('pembelian').select('*');

    if (errTrx) console.warn('Error transaksi:', errTrx.message);
    if (errRestok) console.warn('Error restok:', errRestok.message);

    let gabunganData: any[] = [];

    if (dataTrx && Array.isArray(dataTrx)) {
      const mappedTrx = dataTrx.map(t => ({
        id_transaksi: t.id_transaksi,
        waktu: t.waktu || t.created_at,
        nama_pelanggan: t.nama_pelanggan || 'Pelanggan Umum',
        total_belanja: t.total_belanja || 0,
        status: t.status || 'Lunas',
        tipe: 'PENJUALAN'
      }));
      gabunganData = [...gabunganData, ...mappedTrx];
    }

    if (dataRestok && Array.isArray(dataRestok)) {
      const mappedRestok = dataRestok.map(r => ({
        id_transaksi: r.id_pembelian,
        waktu: r.waktu || r.created_at,
        nama_pelanggan: `[RESTOK] ${r.id_supplier || 'Supplier'}`,
        total_belanja: r.total_tagihan || 0,
        status: r.status || 'Lunas',
        tipe: 'RESTOK'
      }));
      gabunganData = [...gabunganData, ...mappedRestok];
    }

    gabunganData.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());

    return NextResponse.json({ status: 'sukses', data: gabunganData }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

async function ambilDetailTransaksi(tipe: string, id: string) {
  try {
    if (tipe === 'restok') {
      // Ambil header pembelian
      const { data: header, error: errHeader } = await supabase
        .from('pembelian')
        .select('*')
        .eq('id_pembelian', id)
        .single();
      
      if (errHeader) throw new Error(errHeader.message);
      
      // Ambil detail pembelian
      const { data: items, error: errItems } = await supabase
        .from('pembelian_detail')
        .select('*')
        .eq('id_pembelian', id);
      
      if (errItems) throw new Error(errItems.message);
      
      return NextResponse.json({ 
        status: 'sukses', 
        data: { header, items: items || [] } 
      }, { status: 200 });
    } else {
      // Ambil header transaksi
      const { data: header, error: errHeader } = await supabase
        .from('transaksi')
        .select('*')
        .eq('id_transaksi', id)
        .single();
      
      if (errHeader) throw new Error(errHeader.message);
      
      // Ambil detail transaksi
      const { data: items, error: errItems } = await supabase
        .from('transaksi_detail')
        .select('*')
        .eq('id_transaksi', id);
      
      if (errItems) throw new Error(errItems.message);
      
      // Hitung kembalian
      const kembalian = header.nominal_bayar > header.total_belanja 
        ? header.nominal_bayar - header.total_belanja 
        : 0;
      
      return NextResponse.json({ 
        status: 'sukses', 
        data: { 
          header: { ...header, kembalian }, 
          items: items || [] 
        } 
      }, { status: 200 });
    }
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}