🧪 VS Code Testing Commands Reference
📋 Quick Commands List
🚀 Setup & Start
# Quick setup (recommended)
./test-setup.sh
# untuk memulai vsc agar bisa di gunakan dan koneksi dengan github lancar
# Install Node.js dari browser pilih untuk windowd LTC
✔ Install → centang:
✔ Add to PATH
✔ Install npm
node -v
npm -v

# Install Git
# Download dari git-scm.com
✔ Saat install:
✔ pilih: Use Git from command line
✔ pilih: Use OpenSSL
✔ pilih: Checkout Windows-style
git --version

# Setup Git (WAJIB)
git config --global user.name "Nama Kamu"
git config --global user.email "email@gmail.com"
# cek hasil
git config --list

# Cara cek REMOTE
git remote -v
git remote add origin https://github.com/username/repo.git
# cek lagi Hasilnya
git remote -v
# origin  https://github.com/meyza-DKV/Bisik.In.git (fetch)
# origin  https://github.com/meyza-DKV/Bisik.In.git (push)

# Jika Ingin LANGKAH CLONE (BERSIH & AMAN)
# Buka PowerSheel dan masuk ke Drive dimana file kamu berada
# Contoh project D:/Bisik.In maka di power sheel kamu harus masuk ke Drive D
cd D:\
git clone https://github.com/username/repo.In.git

# Jika Ingin Update file VSC dari Github
git stash
git branch -r
#  origin/HEAD -> origin/main
git fetch origin
git reset --hard origin/main
# Manual setup local jika hapus Cache (next,node,lock)
npm install
npx prisma generate
npx tsc --noEmit --pretty false
# jika ada yang belum terinstal automatis lakukan instal manual 
# contoh tailwind.config.ts(2,32): error TS2307: Cannot find module 'tailwindcss-animate' or its corresponding type declarations.
npm install tailwindcss-animate
npm run build
npm run dev
# jika File awal ambil dari Back up
npm install
npm install -D tailwindcss-animate
npm install -D tailwindcss postcss autoprefixer @tailwindcss/postcss
npm install dotenv
npm install @supabase/ssr
npm install @supabase/supabase-js
npm install @prisma/client
# jika ada perubahan prisma
npx prisma generate               :  WAJIB dijalankan setiap kali kamu mengubah file prisma/schema.prisma.
npx prisma db push                : HATI-HATI! Perintah ini menerapkan perubahan schema ke database. 
npx prisma studio                                    JANGAN pernah jalankan ini jika kamu
# perintah Cek 
npx tsc --noEmit --pretty false   : Ini untuk mengecek error TypeScript. Bagus dijalankan sebelum build.
npm run lint
npm run build                     : Ini untuk membangun aplikasi versi production.
# perintah 1x di 1 komputer
npm install -g prisma
npm install -g vercel

# perintah debug
node check-env.js
node debug-local-data.js
note test-api.js
node test-setup.sh

# jalankan lokal
npm run dev

# Build for production
npm run build

Hak akses
git init
git rm -r --cached .
git add .
git commit -m " "
git push origin main
git push origin main --force 
git status
git checkout main
Hapus .next lalu bisa jalan jalan hehehehehehe



pindah kamar git checkout -b fitur-panduan-guru
git checkout main 
git merge fitur-panduan-guru
git push origin main
git branch -d fitur-panduan-guru