export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

// Interface yang disesuaikan dengan struktur database
interface DataLaporan {
  kiri: {
    jmlTrx: number;
    totalPemasukan: number;
    totalHpp: number;
    totalLaba: number;
    rataKeranjang: number;
    totalTransaksiOffline: number;
    totalTransaksiOnline: number;
    totalPembelian: number;
    totalHutangSupplier: number;
  };
  tengah: {
    pengeluaran: Record<string, number>;
    totalPengeluaran?: number;
    rincianPengeluaran?: {
      sandi: string;
      keterangan: string;
      nominal: number;
      jumlahTransaksi: number;
    }[];
  };
  kanan: {
    labaTotal: number;
    labaOffline: number;
    labaOnline: number;
    bpom: { omzet: number; hpp: number; laba: number };
    nonBpom: { omzet: number; hpp: number; laba: number };
    piutangCust: number;
    piutangSup: number;
    piutangAnggota: number;
    piutangKaryawan: number;
    hutangSupplier: number;
  };
  detailTransaksi?: {
    metodePembayaran: Record<string, { jumlah: number; total: number }>;
    tipeHarga: Record<string, { jumlah: number; total: number }>;
  };
  detailPembelian?: {
    totalPembelian: number;
    totalDibayar: number;
    sisaHutang: number;
    jumlahSupplier: number;
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    if (!startDate || !endDate) {
      return NextResponse.json({ 
        status: 'error', 
        pesan: 'Parameter start dan end diperlukan' 
      }, { status: 400 });
    }

    const startStr = `${startDate}T00:00:00`;
    const endStr = `${endDate}T23:59:59`;

    // ============ FETCH DATA DARI DATABASE ============
    
    // 1. Fetch Jurnal
    const { data: jurnalData, error: jurnalErr } = await supabase
      .from('jurnal')
      .select('*')
      .gte('waktu', startStr)
      .lte('waktu', endStr)
      .order('waktu', { ascending: true });

    if (jurnalErr) {
      console.warn('Error fetching jurnal:', jurnalErr);
    }

    // 2. Fetch Transaksi (Kasir)
    const { data: trxData, error: trxErr } = await supabase
      .from('transaksi')
      .select('*')
      .gte('waktu', startStr)
      .lte('waktu', endStr)
      .order('waktu', { ascending: true });

    if (trxErr) {
      console.warn('Error fetching transaksi:', trxErr);
    }

    // 3. Fetch Pembelian (Restok)
    const { data: restokData, error: restokErr } = await supabase
      .from('pembelian')
      .select('*')
      .gte('waktu', startStr)
      .lte('waktu', endStr)
      .order('waktu', { ascending: true });

    if (restokErr) {
      console.warn('Error fetching pembelian:', restokErr);
    }

    // 4. Fetch Detail Transaksi
    let trxDtlData: any[] = [];
    if (trxData && trxData.length > 0) {
      const trxIds = trxData.map(t => t.id_transaksi).filter(Boolean);
      if (trxIds.length > 0) {
        const { data: dtl, error: dtlErr } = await supabase
          .from('transaksi_detail')
          .select('*')
          .in('id_transaksi', trxIds);
        
        if (dtlErr) {
          console.warn('Error fetching transaksi_detail:', dtlErr);
        }
        trxDtlData = dtl || [];
      }
    }

    // 5. Fetch Detail Pembelian
    let pembelianDtlData: any[] = [];
    if (restokData && restokData.length > 0) {
      const pembelianIds = restokData.map(p => p.id_pembelian).filter(Boolean);
      if (pembelianIds.length > 0) {
        const { data: dtl, error: dtlErr } = await supabase
          .from('pembelian_detail')
          .select('*')
          .in('id_pembelian', pembelianIds);
        
        if (dtlErr) {
          console.warn('Error fetching pembelian_detail:', dtlErr);
        }
        pembelianDtlData = dtl || [];
      }
    }

    // 6. Fetch Mutasi Pelanggan untuk Piutang
    const { data: mutasiData, error: mutasiErr } = await supabase
      .from('mutasi_pelanggan')
      .select('*')
      .gte('Waktu', startStr)
      .lte('Waktu', endStr);

    if (mutasiErr) {
      console.warn('Error fetching mutasi_pelanggan:', mutasiErr);
    }

    // ============ INISIALISASI RESPONSE ============
    const response: DataLaporan = {
      kiri: {
        jmlTrx: 0,
        totalPemasukan: 0,
        totalHpp: 0,
        totalLaba: 0,
        rataKeranjang: 0,
        totalTransaksiOffline: 0,
        totalTransaksiOnline: 0,
        totalPembelian: 0,
        totalHutangSupplier: 0
      },
      tengah: {
        pengeluaran: {},
        totalPengeluaran: 0,
        rincianPengeluaran: []
      },
      kanan: {
        labaTotal: 0,
        labaOffline: 0,
        labaOnline: 0,
        bpom: { omzet: 0, hpp: 0, laba: 0 },
        nonBpom: { omzet: 0, hpp: 0, laba: 0 },
        piutangCust: 0,
        piutangSup: 0,
        piutangAnggota: 0,
        piutangKaryawan: 0,
        hutangSupplier: 0
      },
      detailTransaksi: {
        metodePembayaran: {},
        tipeHarga: {}
      },
      detailPembelian: {
        totalPembelian: 0,
        totalDibayar: 0,
        sisaHutang: 0,
        jumlahSupplier: 0
      }
    };

    let totalPemasukan = 0;
    let totalHpp = 0;
    let totalLabaKotor = 0;
    let jumlahTransaksi = 0;
    let totalTransaksiOffline = 0;
    let totalTransaksiOnline = 0;
    let totalPembelian = 0;
    let totalDibayar = 0;
    let sisaHutang = 0;
    let jumlahSupplier = new Set();

    // ============ PROSES TRANSAKSI KASIR & DETAIL ============
    if (trxData && trxData.length > 0) {
      trxData.forEach((t: any) => {
        jumlahTransaksi++;
        
        // Identifikasi Online/Offline dari metode_penjualan
        const metodePenjualan = String(t.metode_penjualan || t.kategori || '').toUpperCase();
        const isOnline = metodePenjualan.includes('ONLINE') || 
                        metodePenjualan.includes('MARKETPLACE') || 
                        metodePenjualan.includes('E-COMMERCE');
        
        if (isOnline) {
          totalTransaksiOnline++;
          response.kiri.totalTransaksiOnline++;
        } else {
          totalTransaksiOffline++;
          response.kiri.totalTransaksiOffline++;
        }

        // Catat detail metode pembayaran
        const metodeBayar = String(t.metode_pembayaran || 'Tunai');
        if (!response.detailTransaksi!.metodePembayaran[metodeBayar]) {
          response.detailTransaksi!.metodePembayaran[metodeBayar] = { jumlah: 0, total: 0 };
        }
        response.detailTransaksi!.metodePembayaran[metodeBayar].jumlah++;
        response.detailTransaksi!.metodePembayaran[metodeBayar].total += Number(t.total_belanja || 0);

        // Catat detail tipe harga
        const tipeHarga = String(t.tipe_harga || 'Normal');
        if (!response.detailTransaksi!.tipeHarga[tipeHarga]) {
          response.detailTransaksi!.tipeHarga[tipeHarga] = { jumlah: 0, total: 0 };
        }
        response.detailTransaksi!.tipeHarga[tipeHarga].jumlah++;
        response.detailTransaksi!.tipeHarga[tipeHarga].total += Number(t.total_belanja || 0);

        const details = trxDtlData.filter(d => d.id_transaksi === t.id_transaksi);
        
        if (details.length > 0) {
          details.forEach(d => {
            const subJual = Number(d.subtotal_jual) || 0;
            const subModal = Number(d.subtotal_modal) || 0;
            const labaKotor = Number(d.laba_kotor) || 0;
            const isBpom = String(d.nama_barang || '').toUpperCase().includes('BPOM');

            totalPemasukan += subJual;
            totalHpp += subModal;
            totalLabaKotor += labaKotor;

            if (isBpom) {
              response.kanan.bpom.omzet += subJual;
              response.kanan.bpom.hpp += subModal;
              response.kanan.bpom.laba += labaKotor;
            } else {
              response.kanan.nonBpom.omzet += subJual;
              response.kanan.nonBpom.hpp += subModal;
              response.kanan.nonBpom.laba += labaKotor;
            }

            if (isOnline) {
              response.kanan.labaOnline += labaKotor;
            } else {
              response.kanan.labaOffline += labaKotor;
            }
          });
        } else {
          // Fallback jika tidak ada detail, gunakan total_belanja
          const totalBelanja = Number(t.total_belanja || 0);
          totalPemasukan += totalBelanja;
          
          if (isOnline) {
            response.kanan.labaOnline += totalBelanja;
          } else {
            response.kanan.labaOffline += totalBelanja;
          }
        }
      });
    }

    // ============ PROSES PEMBELIAN (RESTOK) ============
    if (restokData && restokData.length > 0) {
      restokData.forEach((r: any) => {
        const nominal = Number(r.total_tagihan || 0);
        const dibayar = Number(r.dibayar || 0);
        const sisa = Number(r.sisa_hutang_toko || 0);
        const status = String(r.status || '').toUpperCase();
        const supplierId = r.id_supplier;
        
        if (supplierId) {
          jumlahSupplier.add(supplierId);
        }

        totalPembelian += nominal;
        totalDibayar += dibayar;
        
        // Memasukkan restok ke Sandi E (Belanja Barang)
        response.tengah.pengeluaran['E'] = (response.tengah.pengeluaran['E'] || 0) + nominal;
        
        // Catat rincian pengeluaran
        if (response.tengah.rincianPengeluaran) {
          const existingIndex = response.tengah.rincianPengeluaran.findIndex(
            item => item.sandi === 'E'
          );
          
          if (existingIndex >= 0) {
            response.tengah.rincianPengeluaran[existingIndex].nominal += nominal;
            response.tengah.rincianPengeluaran[existingIndex].jumlahTransaksi++;
          } else {
            response.tengah.rincianPengeluaran.push({
              sandi: 'E',
              keterangan: 'Belanja Barang/Restok',
              nominal: nominal,
              jumlahTransaksi: 1
            });
          }
        }

        // Hutang Supplier jika masih ada sisa
        if (sisa > 0) {
          response.kanan.hutangSupplier += sisa;
          sisaHutang += sisa;
        }
        
        // Piutang Supplier jika ada kelebihan bayar
        if (dibayar > nominal) {
          response.kanan.piutangSup += (dibayar - nominal);
        }
      });
    }

    // ============ PROSES JURNAL (PENGELUARAN OPERASIONAL & MANUAL) ============
    if (jurnalData && jurnalData.length > 0) {
      jurnalData.forEach((j: any) => {
        const sandiUtuh = String(j.sandi || '').trim();
        const sandi = sandiUtuh ? sandiUtuh.charAt(0).toUpperCase() : '';
        const nominal = Number(j.nominal) || 0;
        const tipe = String(j.tipe || '').toUpperCase();
        const kategori = String(j.kategori || '').toUpperCase();
        const akunSumber = String(j.akun_sumber || j.akunSumber || '').toLowerCase();
        const keterangan = String(j.keterangan || '');

        // Antisipasi jika pengguna memasukkan Pemasukan secara Manual di Jurnal
        if (tipe === 'PEMASUKAN' || tipe === 'PEMASUKAN_LAIN') {
          totalPemasukan += nominal;
          jumlahTransaksi++;
          totalLabaKotor += nominal;
          
          if (kategori.includes('BPOM')) {
            response.kanan.bpom.omzet += nominal;
            response.kanan.bpom.laba += nominal;
          } else {
            response.kanan.nonBpom.omzet += nominal;
            response.kanan.nonBpom.laba += nominal;
          }

          if (kategori.includes('ONLINE') || kategori.includes('MARKETPLACE')) {
            response.kanan.labaOnline += nominal;
          } else {
            response.kanan.labaOffline += nominal;
          }
        }

        // Pengeluaran Jurnal Operasional
        if (tipe === 'PENGELUARAN' || tipe === 'BEBAN') {
          if (sandi) {
            response.tengah.pengeluaran[sandi] = (response.tengah.pengeluaran[sandi] || 0) + nominal;
            
            // Catat rincian pengeluaran
            if (response.tengah.rincianPengeluaran) {
              const existingIndex = response.tengah.rincianPengeluaran.findIndex(
                item => item.sandi === sandi
              );
              
              if (existingIndex >= 0) {
                response.tengah.rincianPengeluaran[existingIndex].nominal += nominal;
                response.tengah.rincianPengeluaran[existingIndex].jumlahTransaksi++;
              } else {
                response.tengah.rincianPengeluaran.push({
                  sandi: sandi,
                  keterangan: keterangan || `Sandi ${sandi}`,
                  nominal: nominal,
                  jumlahTransaksi: 1
                });
              }
            }
          } else {
            response.tengah.pengeluaran['NONE'] = (response.tengah.pengeluaran['NONE'] || 0) + nominal;
            
            if (response.tengah.rincianPengeluaran) {
              const existingIndex = response.tengah.rincianPengeluaran.findIndex(
                item => item.sandi === 'NONE'
              );
              
              if (existingIndex >= 0) {
                response.tengah.rincianPengeluaran[existingIndex].nominal += nominal;
                response.tengah.rincianPengeluaran[existingIndex].jumlahTransaksi++;
              } else {
                response.tengah.rincianPengeluaran.push({
                  sandi: 'NONE',
                  keterangan: 'Lainnya (Tanpa Sandi)',
                  nominal: nominal,
                  jumlahTransaksi: 1
                });
              }
            }
          }
        }

        // Catatan Piutang Terpisah di Jurnal
        if (kategori.includes('PIUTANG') || akunSumber.includes('piutang')) {
          if (kategori.includes('CUSTOMER') || akunSumber.includes('customer')) {
            response.kanan.piutangCust += nominal;
          } else if (kategori.includes('SUPPLIER') || akunSumber.includes('supplier')) {
            response.kanan.piutangSup += nominal;
          } else if (kategori.includes('KARYAWAN') || akunSumber.includes('karyawan')) {
            response.kanan.piutangKaryawan += nominal;
          } else if (kategori.includes('ANGGOTA') || akunSumber.includes('anggota')) {
            response.kanan.piutangAnggota += nominal;
          }
        }
      });
    }

    // ============ PROSES MUTASI PELANGGAN (PIUTANG CUSTOMER) ============
    if (mutasiData && mutasiData.length > 0) {
      mutasiData.forEach((m: any) => {
        const jenisMutasi = String(m.Jenis_Mutasi || '').toUpperCase();
        const tipe = String(m.Tipe || '').toUpperCase();
        const nominal = Number(m.Nominal) || 0;
        
        if (jenisMutasi.includes('PIUTANG') || tipe.includes('PIUTANG')) {
          if (tipe.includes('CUSTOMER') || jenisMutasi.includes('CUSTOMER')) {
            response.kanan.piutangCust += nominal;
          } else if (tipe.includes('SUPPLIER') || jenisMutasi.includes('SUPPLIER')) {
            response.kanan.piutangSup += nominal;
          } else if (tipe.includes('KARYAWAN') || jenisMutasi.includes('KARYAWAN')) {
            response.kanan.piutangKaryawan += nominal;
          }
        }
      });
    }

    // ============ FINALISASI DATA ============
    response.kiri.totalPemasukan = totalPemasukan;
    response.kiri.totalHpp = totalHpp;
    response.kiri.totalLaba = totalLabaKotor;
    response.kiri.jmlTrx = jumlahTransaksi;
    response.kiri.rataKeranjang = jumlahTransaksi > 0 ? (totalPemasukan / jumlahTransaksi) : 0;
    response.kiri.totalPembelian = totalPembelian;
    response.kiri.totalHutangSupplier = sisaHutang;

    // Hitung total pengeluaran
    let tPengeluaran = 0;
    Object.values(response.tengah.pengeluaran).forEach(val => {
      tPengeluaran += val;
    });
    response.tengah.totalPengeluaran = tPengeluaran;

    // Laba total = Laba kotor - Total pengeluaran
    response.kanan.labaTotal = totalLabaKotor - tPengeluaran;

    // Detail pembelian
    response.detailPembelian = {
      totalPembelian: totalPembelian,
      totalDibayar: totalDibayar,
      sisaHutang: sisaHutang,
      jumlahSupplier: jumlahSupplier.size
    };

    return NextResponse.json({ 
      status: 'sukses', 
      data: response 
    }, { status: 200 });

  } catch (err: any) {
    console.error('Error GET /api/laporan:', err);
    return NextResponse.json({ 
      status: 'error', 
      pesan: err.message || 'Terjadi kesalahan internal server'
    }, { status: 500 });
  }
}