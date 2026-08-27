export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

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
    totalRetur: number;
  };
  tengah: {
    pengeluaran: Record<string, number>;
    pemasukan: Record<string, number>;
    totalPengeluaran?: number;
    totalPemasukan?: number;
    rincianPengeluaran?: {
      sandi: string;
      keterangan: string;
      nominal: number;
      jumlahTransaksi: number;
    }[];
    rincianPemasukan?: {
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
    metodePenjualan: Record<string, { jumlah: number; total: number; laba: number; hpp: number }>;
  };
  detailPembelian?: {
    totalPembelian: number;
    totalDibayar: number;
    sisaHutang: number;
    jumlahSupplier: number;
    jumlahItemDibeli: number;
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

    if (jurnalErr) console.warn('Error fetching jurnal:', jurnalErr);

    // 2. Fetch Transaksi (Kasir)
    const { data: trxData, error: trxErr } = await supabase
      .from('transaksi')
      .select('*')
      .gte('waktu', startStr)
      .lte('waktu', endStr)
      .order('waktu', { ascending: true });

    if (trxErr) console.warn('Error fetching transaksi:', trxErr);

    // 3. Fetch Pembelian (Restok)
    const { data: restokData, error: restokErr } = await supabase
      .from('pembelian')
      .select('*')
      .gte('waktu', startStr)
      .lte('waktu', endStr)
      .order('waktu', { ascending: true });

    if (restokErr) console.warn('Error fetching pembelian:', restokErr);

    // 4. Fetch Detail Transaksi
    let trxDtlData: any[] = [];
    if (trxData && trxData.length > 0) {
      const trxIds = trxData.map(t => t.id_transaksi).filter(Boolean);
      if (trxIds.length > 0) {
        const { data: dtl, error: dtlErr } = await supabase
          .from('transaksi_detail')
          .select('*')
          .in('id_transaksi', trxIds)
          .order('id_detail', { ascending: true });
        
        if (dtlErr) console.warn('Error fetching transaksi_detail:', dtlErr);
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
        
        if (dtlErr) console.warn('Error fetching pembelian_detail:', dtlErr);
        pembelianDtlData = dtl || [];
      }
    }

    // 6. Fetch Mutasi Pelanggan
    const { data: mutasiData, error: mutasiErr } = await supabase
      .from('mutasi_pelanggan')
      .select('*')
      .gte('Waktu', startStr)
      .lte('Waktu', endStr);

    if (mutasiErr) console.warn('Error fetching mutasi_pelanggan:', mutasiErr);

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
        totalHutangSupplier: 0,
        totalRetur: 0
      },
      tengah: {
        pengeluaran: {},
        pemasukan: {},
        totalPengeluaran: 0,
        totalPemasukan: 0,
        rincianPengeluaran: [],
        rincianPemasukan: []
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
        tipeHarga: {},
        metodePenjualan: {}
      },
      detailPembelian: {
        totalPembelian: 0,
        totalDibayar: 0,
        sisaHutang: 0,
        jumlahSupplier: 0,
        jumlahItemDibeli: 0
      }
    };

    let totalPemasukan = 0;
    let totalHpp = 0;
    let totalLabaKotor = 0;
    let jumlahTransaksi = 0;
    let totalPembelian = 0;
    let totalDibayar = 0;
    let sisaHutang = 0;
    let totalRetur = 0;
    let jumlahReturTransaksi = 0;
    let jumlahSupplier = new Set();
    let jumlahItemDibeli = 0;

    // Map untuk menyimpan data per sandi
    const pemasukanSandiMap = new Map<string, { nominal: number; jumlahTransaksi: number; keterangan: string }>();
    const pengeluaranSandiMap = new Map<string, { nominal: number; jumlahTransaksi: number; keterangan: string }>();

    // ============ PROSES TRANSAKSI KASIR & DETAIL ============
    if (trxData && trxData.length > 0) {
      // Buat map untuk akses cepat detail per transaksi
      const detailMap = new Map();
      trxDtlData.forEach(d => {
        if (!detailMap.has(d.id_transaksi)) {
          detailMap.set(d.id_transaksi, []);
        }
        detailMap.get(d.id_transaksi).push(d);
      });

      trxData.forEach((t: any) => {
        const metodePenjualan = String(t.metode_penjualan || '').toUpperCase();
        const isOnline = metodePenjualan.includes('ONLINE') || 
                        metodePenjualan.includes('MARKETPLACE') || 
                        metodePenjualan.includes('E-COMMERCE') ||
                        metodePenjualan.includes('SHOPEE') ||
                        metodePenjualan.includes('TOKOPEDIA') ||
                        metodePenjualan.includes('LAZADA') ||
                        metodePenjualan.includes('GRAB') ||
                        metodePenjualan.includes('GOJEK');
        
        jumlahTransaksi++;
        
        if (isOnline) {
          response.kiri.totalTransaksiOnline++;
        } else {
          response.kiri.totalTransaksiOffline++;
        }

        // Catat detail metode penjualan
        const keyMetodeJual = metodePenjualan || 'Offline';
        if (!response.detailTransaksi!.metodePenjualan[keyMetodeJual]) {
          response.detailTransaksi!.metodePenjualan[keyMetodeJual] = { 
            jumlah: 0, 
            total: 0, 
            laba: 0, 
            hpp: 0 
          };
        }
        response.detailTransaksi!.metodePenjualan[keyMetodeJual].jumlah++;

        // Catat detail metode pembayaran
        const metodeBayar = String(t.metode_pembayaran || 'Tunai');
        if (!response.detailTransaksi!.metodePembayaran[metodeBayar]) {
          response.detailTransaksi!.metodePembayaran[metodeBayar] = { jumlah: 0, total: 0 };
        }
        response.detailTransaksi!.metodePembayaran[metodeBayar].jumlah++;

        // Catat detail tipe harga
        const tipeHarga = String(t.tipe_harga || 'Normal');
        if (!response.detailTransaksi!.tipeHarga[tipeHarga]) {
          response.detailTransaksi!.tipeHarga[tipeHarga] = { jumlah: 0, total: 0 };
        }
        response.detailTransaksi!.tipeHarga[tipeHarga].jumlah++;

        // Ambil detail transaksi
        const details = detailMap.get(t.id_transaksi) || [];
        
        if (details.length > 0) {
          let totalTransaksiIni = 0;
          let hppTransaksiIni = 0;
          let labaTransaksiIni = 0;
          let adaRetur = false;

          details.forEach((d: any) => {
            const qty = Number(d.qty) || 0;
            const subJual = Number(d.subtotal_jual) || 0;
            const subModal = Number(d.subtotal_modal) || 0;
            const labaKotor = Number(d.laba_kotor) || (subJual - subModal);
            const namaBarang = String(d.nama_barang || '').toUpperCase();
            const isBpom = namaBarang.includes('BPOM');

            // ============ CEK RETUR (QTY NEGATIF) ============
            if (qty < 0) {
              // Ini adalah retur
              adaRetur = true;
              totalRetur += Math.abs(subJual);
              jumlahReturTransaksi++;
              
              // Retur masuk ke pengeluaran Sandi B
              if (!pengeluaranSandiMap.has('B')) {
                pengeluaranSandiMap.set('B', {
                  nominal: 0,
                  jumlahTransaksi: 0,
                  keterangan: 'Retur'
                });
              }
              const sandiB = pengeluaranSandiMap.get('B')!;
              sandiB.nominal += Math.abs(subJual);
              sandiB.jumlahTransaksi++;

              // Retur mengurangi pemasukan
              totalPemasukan -= Math.abs(subJual);
              totalHpp -= Math.abs(subModal);
              totalLabaKotor -= Math.abs(labaKotor);
              
              totalTransaksiIni -= Math.abs(subJual);
              hppTransaksiIni -= Math.abs(subModal);
              labaTransaksiIni -= Math.abs(labaKotor);

              // Update metode penjualan
              response.detailTransaksi!.metodePenjualan[keyMetodeJual].total -= Math.abs(subJual);
              response.detailTransaksi!.metodePenjualan[keyMetodeJual].hpp -= Math.abs(subModal);
              response.detailTransaksi!.metodePenjualan[keyMetodeJual].laba -= Math.abs(labaKotor);

              // Kategorisasi BPOM/Non-BPOM untuk retur
              if (isBpom) {
                response.kanan.bpom.omzet -= Math.abs(subJual);
                response.kanan.bpom.hpp -= Math.abs(subModal);
                response.kanan.bpom.laba -= Math.abs(labaKotor);
              } else {
                response.kanan.nonBpom.omzet -= Math.abs(subJual);
                response.kanan.nonBpom.hpp -= Math.abs(subModal);
                response.kanan.nonBpom.laba -= Math.abs(labaKotor);
              }

              // Kategorisasi Online/Offline untuk retur
              if (isOnline) {
                response.kanan.labaOnline -= Math.abs(labaKotor);
              } else {
                response.kanan.labaOffline -= Math.abs(labaKotor);
              }
            } else {
              // Ini penjualan normal
              totalPemasukan += subJual;
              totalHpp += subModal;
              totalLabaKotor += labaKotor;
              
              totalTransaksiIni += subJual;
              hppTransaksiIni += subModal;
              labaTransaksiIni += labaKotor;

              // Update metode penjualan
              response.detailTransaksi!.metodePenjualan[keyMetodeJual].total += subJual;
              response.detailTransaksi!.metodePenjualan[keyMetodeJual].hpp += subModal;
              response.detailTransaksi!.metodePenjualan[keyMetodeJual].laba += labaKotor;

              // Kategorisasi BPOM/Non-BPOM
              if (isBpom) {
                response.kanan.bpom.omzet += subJual;
                response.kanan.bpom.hpp += subModal;
                response.kanan.bpom.laba += labaKotor;
              } else {
                response.kanan.nonBpom.omzet += subJual;
                response.kanan.nonBpom.hpp += subModal;
                response.kanan.nonBpom.laba += labaKotor;
              }

              // Kategorisasi Online/Offline
              if (isOnline) {
                response.kanan.labaOnline += labaKotor;
              } else {
                response.kanan.labaOffline += labaKotor;
              }
            }
          });

          // ============ CATAT PEMASUKAN SANDI D (PEMASUKAN TOKO) ============
          // Semua penjualan (qty positif) masuk ke Sandi D
          if (totalTransaksiIni > 0) {
            if (!pemasukanSandiMap.has('D')) {
              pemasukanSandiMap.set('D', {
                nominal: 0,
                jumlahTransaksi: 0,
                keterangan: 'Pemasukan Toko'
              });
            }
            const sandiD = pemasukanSandiMap.get('D')!;
            sandiD.nominal += totalTransaksiIni;
            sandiD.jumlahTransaksi++;
          }

          // Update total di detail pembayaran dan tipe harga
          response.detailTransaksi!.metodePembayaran[metodeBayar].total += totalTransaksiIni;
          response.detailTransaksi!.tipeHarga[tipeHarga].total += totalTransaksiIni;

        } else {
          // Fallback jika tidak ada detail
          const totalBelanja = Number(t.total_belanja || 0);
          totalPemasukan += totalBelanja;
          
          response.detailTransaksi!.metodePenjualan[keyMetodeJual].total += totalBelanja;
          response.detailTransaksi!.metodePembayaran[metodeBayar].total += totalBelanja;
          response.detailTransaksi!.tipeHarga[tipeHarga].total += totalBelanja;
          
          if (isOnline) {
            response.kanan.labaOnline += totalBelanja;
          } else {
            response.kanan.labaOffline += totalBelanja;
          }

          // Catat pemasukan Sandi D
          if (!pemasukanSandiMap.has('D')) {
            pemasukanSandiMap.set('D', {
              nominal: 0,
              jumlahTransaksi: 0,
              keterangan: 'Pemasukan Toko'
            });
          }
          const sandiD = pemasukanSandiMap.get('D')!;
          sandiD.nominal += totalBelanja;
          sandiD.jumlahTransaksi++;
        }
      });
    }

    // ============ PROSES PEMBELIAN (RESTOK) ============
    if (restokData && restokData.length > 0) {
      restokData.forEach((r: any) => {
        const nominal = Number(r.total_tagihan || 0);
        const dibayar = Number(r.dibayar || 0);
        const sisa = Number(r.sisa_hutang_toko || 0);
        const supplierId = r.id_supplier;
        
        if (supplierId) jumlahSupplier.add(supplierId);

        totalPembelian += nominal;
        totalDibayar += dibayar;
        
        const detailPembelianIni = pembelianDtlData.filter(p => p.id_pembelian === r.id_pembelian);
        jumlahItemDibeli += detailPembelianIni.length;

        // Memasukkan restok ke Sandi E (Belanja Barang)
        if (!pengeluaranSandiMap.has('E')) {
          pengeluaranSandiMap.set('E', {
            nominal: 0,
            jumlahTransaksi: 0,
            keterangan: 'Belanja Barang/Restok'
          });
        }
        const sandiE = pengeluaranSandiMap.get('E')!;
        sandiE.nominal += nominal;
        sandiE.jumlahTransaksi++;

        if (sisa > 0) {
          response.kanan.hutangSupplier += sisa;
          sisaHutang += sisa;
        }
        
        if (dibayar > nominal) {
          response.kanan.piutangSup += (dibayar - nominal);
        }
      });
    }

    // ============ PROSES JURNAL ============
    if (jurnalData && jurnalData.length > 0) {
      jurnalData.forEach((j: any) => {
        const sandiUtuh = String(j.sandi || '').trim();
        const sandi = sandiUtuh ? sandiUtuh.charAt(0).toUpperCase() : '';
        const nominal = Number(j.nominal) || 0;
        const tipe = String(j.tipe || '').toUpperCase();
        const kategori = String(j.kategori || '').toUpperCase();
        const akunSumber = String(j.akun_sumber || j.akunSumber || '').toLowerCase();
        const keterangan = String(j.keterangan || '');

        // Pemasukan Manual
        if (tipe === 'PEMASUKAN' || tipe === 'PEMASUKAN_LAIN') {
          totalPemasukan += nominal;
          jumlahTransaksi++;
          totalLabaKotor += nominal;
          
          // Catat pemasukan per sandi
          if (sandi) {
            if (!pemasukanSandiMap.has(sandi)) {
              pemasukanSandiMap.set(sandi, {
                nominal: 0,
                jumlahTransaksi: 0,
                keterangan: keterangan || `Pemasukan Sandi ${sandi}`
              });
            }
            const sandiData = pemasukanSandiMap.get(sandi)!;
            sandiData.nominal += nominal;
            sandiData.jumlahTransaksi++;
          }
          
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

        // Pengeluaran
        if (tipe === 'PENGELUARAN' || tipe === 'BEBAN') {
          if (sandi) {
            if (!pengeluaranSandiMap.has(sandi)) {
              pengeluaranSandiMap.set(sandi, {
                nominal: 0,
                jumlahTransaksi: 0,
                keterangan: keterangan || `Sandi ${sandi}`
              });
            }
            const sandiData = pengeluaranSandiMap.get(sandi)!;
            sandiData.nominal += nominal;
            sandiData.jumlahTransaksi++;
          } else {
            if (!pengeluaranSandiMap.has('NONE')) {
              pengeluaranSandiMap.set('NONE', {
                nominal: 0,
                jumlahTransaksi: 0,
                keterangan: 'Lainnya (Tanpa Sandi)'
              });
            }
            const sandiNone = pengeluaranSandiMap.get('NONE')!;
            sandiNone.nominal += nominal;
            sandiNone.jumlahTransaksi++;
          }
        }

        // Piutang dari Jurnal
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

    // ============ PROSES MUTASI PELANGGAN ============
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
    response.kiri.totalRetur = totalRetur;

    // Konversi Map ke object untuk response
    const pemasukanObject: Record<string, number> = {};
    const pengeluaranObject: Record<string, number> = {};
    
    pemasukanSandiMap.forEach((value, key) => {
      pemasukanObject[key] = value.nominal;
    });
    
    pengeluaranSandiMap.forEach((value, key) => {
      pengeluaranObject[key] = value.nominal;
    });

    response.tengah.pemasukan = pemasukanObject;
    response.tengah.pengeluaran = pengeluaranObject;

    // Hitung total
    let totalPemasukanSandi = 0;
    pemasukanSandiMap.forEach(value => {
      totalPemasukanSandi += value.nominal;
    });
    response.tengah.totalPemasukan = totalPemasukanSandi;

    let totalPengeluaranSandi = 0;
    pengeluaranSandiMap.forEach(value => {
      totalPengeluaranSandi += value.nominal;
    });
    response.tengah.totalPengeluaran = totalPengeluaranSandi;

    // Rincian pemasukan
    response.tengah.rincianPemasukan = Array.from(pemasukanSandiMap.entries()).map(([sandi, data]) => ({
      sandi,
      keterangan: data.keterangan,
      nominal: data.nominal,
      jumlahTransaksi: data.jumlahTransaksi
    }));

    // Rincian pengeluaran
    response.tengah.rincianPengeluaran = Array.from(pengeluaranSandiMap.entries()).map(([sandi, data]) => ({
      sandi,
      keterangan: data.keterangan,
      nominal: data.nominal,
      jumlahTransaksi: data.jumlahTransaksi
    }));

    // Laba total = Laba kotor - Total pengeluaran
    response.kanan.labaTotal = totalLabaKotor - totalPengeluaranSandi;

    // Detail pembelian
    response.detailPembelian = {
      totalPembelian: totalPembelian,
      totalDibayar: totalDibayar,
      sisaHutang: sisaHutang,
      jumlahSupplier: jumlahSupplier.size,
      jumlahItemDibeli: jumlahItemDibeli
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