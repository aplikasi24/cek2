/**
 * Cloudflare Worker Backend for Aplikasi SPP
 */

export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      
      // Handle CORS for options
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      }
  
      // We handle POST requests (usually to /api or /exec)
      if (request.method === "POST") {
        return handleApiRequest(request, env);
      }
  
      // If GET, let Cloudflare Workers Assets serve the HTML/CSS/JS files
      return env.ASSETS.fetch(request);
    }
  };
  
  async function handleApiRequest(request, env) {
    let responseObj = { status: "error", message: "Unknown Error" };
    try {
      const body = await request.json();
      const action = body.action;
      const payload = body.payload || {};
      const db = env.DB;
  
      switch (action) {
        case "loginUser":
            responseObj = await loginUser(db, payload);
            break;
        case "getDataAdmin":
            responseObj = await getDataAdmin(db, payload);
            break;
        case "getDataSiswa":
            responseObj = await getDataSiswa(db, payload);
            break;
        case "getJenisPembayaran":
            responseObj = await getJenisPembayaran(db, payload);
            break;
        case "tambahJenisPembayaran":
            responseObj = await tambahJenisPembayaran(db, payload);
            break;
        case "editJenisPembayaran":
            responseObj = await editJenisPembayaran(db, payload);
            break;
        case "hapusJenisPembayaran":
            responseObj = await hapusJenisPembayaran(db, payload);
            break;
        case "simpanPembayaranList":
            responseObj = await simpanPembayaranList(db, payload);
            break;
        case "simpanPembayaranMassal":
            responseObj = await simpanPembayaranMassal(db, payload);
            break;
        case "editTransaksi":
            responseObj = await editTransaksi(db, payload);
            break;
        case "tambahSiswa":
            responseObj = await tambahSiswa(db, payload);
            break;
        case "editSiswa":
            responseObj = await editSiswa(db, payload);
            break;
        case "hapusSiswa":
            responseObj = await hapusSiswa(db, payload);
            break;
        case "tambahSiswaMassal":
            responseObj = await tambahSiswaMassal(db, payload);
            break;
        case "updateAllTagihan":
            responseObj = await updateAllTagihan(db, payload);
            break;
        case "simpanArsip":
            responseObj = await simpanArsip(db, payload);
            break;
        case "getDaftarArsip":
            responseObj = await getDaftarArsip(db, payload);
            break;
        case "getArsipData":
            responseObj = await getArsipData(db, payload);
            break;
        case "hapusArsip":
            responseObj = await hapusArsip(db, payload);
            break;
        case "restoreArsipById":
            responseObj = await restoreArsipById(db, payload);
            break;
        case "getLogs":
            responseObj = await getLogs(db, payload);
            break;
        case "clearLogs":
            responseObj = await clearLogs(db, payload);
            break;
        case "getDaftarAdmin":
            responseObj = await getDaftarAdmin(db);
            break;
        case "simpanAdmin":
            responseObj = await simpanAdmin(db, payload);
            break;
        case "hapusAdmin":
            responseObj = await hapusAdmin(db, payload);
            break;
        case "gantiPassword":
            responseObj = await gantiPassword(db, payload);
            break;
        case "clearAllData":
            responseObj = await clearAllData(db, payload);
            break;
        default:
            responseObj = { status: "error", message: "Action not implemented: " + action };
      }
    } catch (err) {
      console.error(err);
      responseObj = { status: "error", message: err.message };
    }
  
    return new Response(JSON.stringify(responseObj), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  
  // ==========================================
  // HELPER LOG
  // ==========================================
  async function logActivity(db, adminName, role, actionDetail, kelas = "") {
    try {
        const timestamp = new Date().toISOString();
        await db.prepare("INSERT INTO Logs (timestamp, adminName, role, action, detail, kelas) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(timestamp, adminName, role, 'Aktivitas', actionDetail, kelas)
          .run();
    } catch(e) { console.error("Error logging", e); }
  }
  
  // ==========================================
  // API IMPLEMENTATIONS
  // ==========================================
  
  async function loginUser(db, payload) {
    const { username, password } = payload;
    
    // Check admin
    const admin = await db.prepare("SELECT * FROM Admin WHERE username = ? AND password = ?").bind(username, password).first();
    if (admin) {
        await logActivity(db, admin.nama, 'Admin', 'Login Berhasil', admin.aksesKelas || '');
        return { status: "success", role: "admin", nama: admin.nama, aksesKelas: admin.aksesKelas || '' };
    }
    
    // Check siswa
    const siswa = await db.prepare("SELECT * FROM Siswa WHERE nis = ? AND password = ?").bind(username, password).first();
    if (siswa) {
        return { status: "success", role: "siswa", nis: siswa.nis, nama: siswa.nama, kelas: siswa.kelas };
    }
    
    return { status: "error", message: "Username/NIS atau Password salah." };
  }
  
  async function getDataAdmin(db, payload) {
    const { adminKelas } = payload;
    
    let query = "SELECT nis, nama, kelas, gender, tagihan FROM Siswa";
    const params = [];
    if (adminKelas) {
        query += " WHERE kelas = ?";
        params.push(adminKelas);
    }
    
    const siswaData = (await db.prepare(query).bind(...params).all()).results.map(s => ({
        nis: s.nis, nama: s.nama, kelas: s.kelas, gender: s.gender,
        calculatedTotal: s.tagihan, totalTerbayar: 0,
        calculatedSisa: s.tagihan, calculatedStatus: 'Belum Lunas'
    }));
    
    let trxQuery = "SELECT id, nis, namaSiswa, tanggal, jenis, jumlah, admin FROM Transaksi";
    const trxParams = [];
    if (adminKelas) {
        trxQuery = "SELECT t.id, t.nis, t.namaSiswa, t.tanggal, t.jenis, t.jumlah, t.admin FROM Transaksi t JOIN Siswa s ON t.nis = s.nis WHERE s.kelas = ?";
        trxParams.push(adminKelas);
    }
    const trxData = (await db.prepare(trxQuery).bind(...trxParams).all()).results;
    
    // Aggregate payments and build historyMap
    const paidMap = {};
    const historyMap = {};
    
    trxData.forEach(t => {
        paidMap[t.nis] = (paidMap[t.nis] || 0) + t.jumlah;
        
        if (!historyMap[t.nis]) historyMap[t.nis] = [];
        historyMap[t.nis].push({
            id: t.id,
            tanggal: t.tanggal,
            jenis: t.jenis,
            jumlah: t.jumlah,
            admin: t.admin,
            item: t.jenis
        });
    });
    
    siswaData.forEach(s => {
        const p = paidMap[s.nis] || 0;
        s.totalTerbayar = p;
        s.calculatedSisa = s.calculatedTotal - p;
        if (s.calculatedSisa < 0) s.calculatedSisa = 0;
        s.calculatedStatus = s.calculatedSisa <= 0 ? 'Lunas' : 'Belum Lunas';
    });
    
    const logsData = (await db.prepare("SELECT timestamp, adminName, action, detail FROM Logs ORDER BY id DESC LIMIT 5").all()).results;
    
    return { status: 'success', laporan: siswaData, historyMap: historyMap, historyRecent: logsData };
  }
  
  async function getDataSiswa(db, payload) {
    const nis = payload.nis || payload; // based on old logic
    
    const profil = await db.prepare("SELECT * FROM Siswa WHERE nis = ?").bind(nis).first();
    if (!profil) return { status: 'error', message: 'Siswa tidak ditemukan' };
    
    const historyData = (await db.prepare("SELECT tanggal, jenis, jumlah FROM Transaksi WHERE nis = ? ORDER BY id ASC").bind(nis).all()).results;
    
    let terbayar = 0;
    historyData.forEach(h => terbayar += h.jumlah);
    
    return {
        status: 'success',
        profil: {
            nis: profil.nis, nama: profil.nama, kelas: profil.kelas, 
            tagihan: profil.tagihan, terbayar: terbayar, totalTerbayar: terbayar
        },
        history: historyData
    };
  }
  
  async function getJenisPembayaran(db, payload) {
    const { adminKelas } = payload || {};
    let query = "SELECT * FROM JenisPembayaran";
    const params = [];
    if (adminKelas) {
        query += " WHERE kelas = '' OR kelas = ?";
        params.push(adminKelas);
    }
    const res = (await db.prepare(query).bind(...params).all()).results;
    return res.map(r => ({ jenis: r.jenis, nominal: r.nominal, kelas: r.kelas }));
  }
  
  async function tambahJenisPembayaran(db, payload) {
    const { jenis, nominal, kelas, adminName } = payload;
    await db.prepare("INSERT INTO JenisPembayaran (jenis, nominal, kelas, adminName) VALUES (?, ?, ?, ?)")
      .bind(jenis, parseInt(nominal) || 0, kelas || "", adminName || "Admin").run();
    await logActivity(db, adminName, 'Admin', `Menambah Tagihan: ${jenis} (Rp ${nominal})`, kelas);
    return { status: 'success', message: 'Item berhasil ditambahkan.' };
  }
  
  async function editJenisPembayaran(db, payload) {
    const { oldJenis, jenis, nominal, kelas, adminName } = payload;
    await db.prepare("UPDATE JenisPembayaran SET jenis = ?, nominal = ? WHERE jenis = ? AND (kelas = ? OR kelas = '')")
      .bind(jenis, parseInt(nominal)||0, oldJenis, kelas||"").run();
      
    // Update existing transactions? Usually we don't retroactively change names in D1 unless needed.
    await logActivity(db, adminName, 'Admin', `Mengedit Tagihan: ${oldJenis} menjadi ${jenis}`, kelas);
    return { status: 'success', message: 'Item berhasil diupdate.' };
  }
  
  async function hapusJenisPembayaran(db, payload) {
    const { jenis, kelas, adminName } = payload;
    await db.prepare("DELETE FROM JenisPembayaran WHERE jenis = ?").bind(jenis).run();
    // Delete history related to this item
    await db.prepare("DELETE FROM Transaksi WHERE jenis = ?").bind(jenis).run();
    await logActivity(db, adminName, 'Admin', `Menghapus Tagihan & Riwayat: ${jenis}`, kelas);
    return { status: 'success' };
  }
  
  async function simpanPembayaranList(db, payload) {
    const { nis, items, adminName } = payload;
    for (let item of items) {
        const id = 'TRX-' + Date.now() + Math.floor(Math.random()*1000);
        await db.prepare("INSERT INTO Transaksi (id, tanggal, nis, namaSiswa, jenis, jumlah, admin) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(id, item.tanggalReal || new Date().toISOString(), nis, "", item.jenis, item.nominal, adminName).run();
    }
    return { status: 'success' };
  }
  
  async function editTransaksi(db, payload) {
    const { idTrx, nis, newDate, newKet, newNominal, newJenis, adminName } = payload;
    await db.prepare("UPDATE Transaksi SET tanggal = ?, jenis = ?, jumlah = ? WHERE id = ? AND nis = ?")
        .bind(newDate, newJenis, parseInt(newNominal)||0, idTrx, nis).run();
    return { status: 'success' };
  }
  
  async function tambahSiswa(db, payload) {
    const { nis, password, nama, kelas, gender, tagihan, adminName } = payload;
    
    const existing = await db.prepare("SELECT nis FROM Siswa WHERE nis = ?").bind(nis).first();
    if (existing) return { status: 'error', message: `NIS ${nis} sudah terdaftar!` };
    
    await db.prepare("INSERT INTO Siswa (nis, password, nama, kelas, gender, tagihan) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(nis, password||"123", nama, kelas||"", gender||"L", parseInt(tagihan)||0).run();
    return { status: 'success' };
  }
  
  async function editSiswa(db, payload) {
    const { editNis, editPassword, editNama, editKelas, editGender, editTagihan, adminName } = payload;
    await db.prepare("UPDATE Siswa SET password=?, nama=?, kelas=?, gender=?, tagihan=? WHERE nis=?")
        .bind(editPassword, editNama, editKelas, editGender, parseInt(editTagihan)||0, editNis).run();
    return { status: 'success' };
  }
  
  async function hapusSiswa(db, payload) {
    const { nis, adminName, adminKelas } = payload;
    await db.prepare("DELETE FROM Siswa WHERE nis = ?").bind(nis).run();
    // Do not delete transactions based on user request (keep history)
    await logActivity(db, adminName, 'Admin', `Menghapus data siswa: ${nis}`, adminKelas);
    return { status: 'success' };
  }
  
  async function gantiPassword(db, payload) {
    const { role, identifier, oldPass, newPass } = payload;
    if (role === 'admin') {
        const r = await db.prepare("UPDATE Admin SET password = ? WHERE username = ? AND password = ?").bind(newPass, identifier, oldPass).run();
        if (r.meta.changes > 0) return { status: 'success' };
    } else {
        const r = await db.prepare("UPDATE Siswa SET password = ? WHERE nis = ? AND password = ?").bind(newPass, identifier, oldPass).run();
        if (r.meta.changes > 0) return { status: 'success' };
    }
    return { status: 'error', message: "Password lama salah." };
  }
  
  async function getDaftarAdmin(db) {
    const admins = (await db.prepare("SELECT username, nama, aksesKelas, password FROM Admin").all()).results;
    return { status: 'success', data: admins };
  }

  async function simpanAdmin(db, payload) {
    const { mode, oldUsername, username, password, nama, aksesKelas } = payload;
    try {
        if (mode === 'edit') {
            await db.prepare("UPDATE Admin SET username=?, password=?, nama=?, aksesKelas=? WHERE username=?")
                .bind(username, password, nama, aksesKelas||"", oldUsername).run();
        } else {
            await db.prepare("INSERT INTO Admin (username, password, nama, aksesKelas) VALUES (?, ?, ?, ?)")
                .bind(username, password, nama, aksesKelas||"").run();
        }
        return { status: 'success' };
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return { status: 'error', message: 'Username sudah digunakan, silakan pilih username lain.' };
        }
        throw err;
    }
  }

  async function hapusAdmin(db, payload) {
    const { username } = payload;
    await db.prepare("DELETE FROM Admin WHERE username = ?").bind(username).run();
    return { status: 'success' };
  }
  


  async function simpanArsip(db, payload) {
      const { tahunPelajaran, adminName, isReset } = payload;
      const id = 'ARSIP-' + Date.now();
      
      const siswaData = (await db.prepare("SELECT * FROM Siswa").all()).results;
      const jenisData = (await db.prepare("SELECT * FROM JenisPembayaran").all()).results;
      const trxData = (await db.prepare("SELECT * FROM Transaksi").all()).results;
      
      // format historyData similarly
      let historyMap = {};
      trxData.forEach(t => {
          if (!historyMap[t.nis]) historyMap[t.nis] = [];
          historyMap[t.nis].push({ tanggal: t.tanggal, jenis: t.jenis, jumlah: t.jumlah, admin: t.admin, item: t.jenis });
      });

      const dataToSave = JSON.stringify({
          siswaData: siswaData,
          jenisPembayaran: jenisData,
          historyData: historyMap
      });

      await db.prepare("INSERT INTO Arsip (id, tahunPelajaran, tanggal, totalSiswa, admin, data) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(id, tahunPelajaran, new Date().toISOString(), siswaData.length, adminName, dataToSave).run();
          
      if (isReset) {
          await db.prepare("DELETE FROM Siswa").run();
          await db.prepare("DELETE FROM Transaksi").run();
      }

      return { status: 'success', backupTime: new Date().toISOString(), tahun: tahunPelajaran, isReset };
  }

  async function getDaftarArsip(db, payload) {
      const arsips = (await db.prepare("SELECT id, tahunPelajaran, tanggal, totalSiswa, admin FROM Arsip ORDER BY id DESC").all()).results;
      return arsips;
  }

  async function hapusArsip(db, payload) {
      const { idArsip } = payload;
      await db.prepare("DELETE FROM Arsip WHERE id = ?").bind(idArsip).run();
      return { status: 'success' };
  }
  
  async function getArsipData(db, payload) {
      const arsip = await db.prepare("SELECT data FROM Arsip WHERE id = ?").bind(payload.idArsip || payload).first();
      if (arsip) return JSON.parse(arsip.data);
      return null;
  }

  async function clearAllData(db, payload) {
      await db.prepare("DELETE FROM Siswa").run();
      await db.prepare("DELETE FROM Transaksi").run();
      return { status: 'success', message: 'All data cleared' };
  }
  
  async function tambahSiswaMassal(db, payload) {
    const { data, adminName, adminKelas } = payload;
    if (!data || data.length === 0) return { status: 'error', message: 'Data kosong' };
    
    const batchStmts = [];
    for (let row of data) {
        batchStmts.push(db.prepare(`
            INSERT INTO Siswa (nis, password, nama, kelas, gender, tagihan) 
            VALUES (?, ?, ?, ?, ?, ?) 
            ON CONFLICT(nis) DO UPDATE SET 
                password=excluded.password, 
                nama=excluded.nama, 
                kelas=excluded.kelas, 
                gender=excluded.gender, 
                tagihan=excluded.tagihan
        `).bind(String(row.NIS), String(row.Password || "123"), row.Nama, row.Kelas || adminKelas || "", row.Gender || "L", parseInt(row.Tagihan) || 0));
    }
    
    if (batchStmts.length > 0) {
        await db.batch(batchStmts);
        await logActivity(db, adminName, 'Admin', `Import/Update massal ${data.length} siswa`, adminKelas || '');
    }
    
    return { status: 'success', message: `${data.length} siswa berhasil diimport` };
  }

  async function updateAllTagihan(db, payload) {
    const { newNominal, targetKelas, adminName } = payload;
    let query = "UPDATE Siswa SET tagihan = ?";
    const params = [parseInt(newNominal) || 0];
    if (targetKelas) {
        query += " WHERE kelas = ?";
        params.push(targetKelas);
    }
    await db.prepare(query).bind(...params).run();
    await logActivity(db, adminName, 'Admin', `Update massal tagihan menjadi Rp ${newNominal}`, targetKelas || 'Semua Kelas');
    return { status: 'success', message: 'Semua tagihan berhasil diupdate.' };
  }
  
  async function simpanPembayaranMassal(db, payload) {
    const { data, adminName } = payload;
    if (!data || data.length === 0) return { status: 'error', message: 'Data kosong' };
    
    const batchStmts = [];
    for (let row of data) {
        const id = 'TRX-' + Date.now() + Math.floor(Math.random()*1000) + '-' + row.NIS;
        batchStmts.push(db.prepare("INSERT INTO Transaksi (id, tanggal, nis, namaSiswa, jenis, jumlah, admin) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(id, row.Tanggal || new Date().toISOString(), String(row.NIS), "", row.ItemTagihan, parseInt(row.Nominal) || 0, adminName));
    }
    
    if (batchStmts.length > 0) {
        await db.batch(batchStmts);
        await logActivity(db, adminName, 'Admin', `Import massal ${data.length} pembayaran`, '');
    }
    return { status: 'success', message: `${data.length} pembayaran berhasil diimport` };
  }
  
  async function restoreArsipById(db, payload) {
      const { idArsip, adminName, adminKelas } = payload;
      const arsip = await db.prepare("SELECT data FROM Arsip WHERE id = ?").bind(idArsip).first();
      if (!arsip) return { status: 'error', message: 'Arsip tidak ditemukan' };
      
      const parsedData = JSON.parse(arsip.data);
      
      await db.prepare("DELETE FROM Siswa").run();
      await db.prepare("DELETE FROM JenisPembayaran").run();
      await db.prepare("DELETE FROM Transaksi").run();
      
      const stmts = [];
      if (parsedData.siswaData) {
          parsedData.siswaData.forEach(s => {
              stmts.push(db.prepare("INSERT INTO Siswa (nis, password, nama, kelas, gender, tagihan) VALUES (?, ?, ?, ?, ?, ?)")
                  .bind(s.nis, s.password, s.nama, s.kelas, s.gender, s.tagihan || s.calculatedTotal || 0));
          });
      }
      if (parsedData.jenisPembayaran) {
          parsedData.jenisPembayaran.forEach(j => {
              stmts.push(db.prepare("INSERT INTO JenisPembayaran (jenis, nominal, kelas, adminName) VALUES (?, ?, ?, ?)")
                  .bind(j.jenis, j.nominal, j.kelas || "", j.adminName || "System"));
          });
      }
      if (parsedData.historyData) {
          for (let nis in parsedData.historyData) {
              parsedData.historyData[nis].forEach(h => {
                  const id = 'TRX-' + Date.now() + Math.floor(Math.random()*1000) + '-' + nis;
                  stmts.push(db.prepare("INSERT INTO Transaksi (id, tanggal, nis, namaSiswa, jenis, jumlah, admin) VALUES (?, ?, ?, ?, ?, ?, ?)")
                      .bind(id, h.tanggal, nis, "", h.jenis || h.item, h.jumlah, h.admin));
              });
          }
      }
      
      if (stmts.length > 0) {
          const chunkSize = 50; 
          for (let i = 0; i < stmts.length; i += chunkSize) {
              await db.batch(stmts.slice(i, i + chunkSize));
          }
      }
      
      await logActivity(db, adminName, 'Admin', `Merestore Database dari Arsip ${idArsip}`, adminKelas || '');
      return { status: 'success', message: 'Database berhasil direstore dari Arsip.' };
  }
  
  async function getLogs(db, payload) {
      const logs = (await db.prepare("SELECT * FROM Logs ORDER BY id DESC LIMIT 100").all()).results;
      return logs.map(l => ({
          waktu: l.timestamp,
          user: l.adminName,
          aksi: l.action,
          detail: l.detail
      }));
  }
  
  async function clearLogs(db, payload) {
      const { aksesKelas } = payload;
      if (aksesKelas) return { status: 'error', message: 'Hanya Admin Utama yang bisa menghapus log' };
      await db.prepare("DELETE FROM Logs").run();
      return { status: 'success' };
  }
