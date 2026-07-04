@echo off
color 0A
title Deploy Aplikasi SPP
echo =======================================================
echo        Memulai Proses Deploy ke Cloudflare...
echo =======================================================
echo.

call npx wrangler deploy

echo.
echo =======================================================
echo Deploy Selesai!
echo Silakan cek perubahan terbaru di browser Anda.
echo (Jangan lupa tekan Ctrl + F5 jika tampilan belum berubah)
echo =======================================================
pause
