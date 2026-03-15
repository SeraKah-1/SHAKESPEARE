# SETUP.md - AI Novel Engine Infrastructure Blueprint

**Role:** Lead DevOps & Database Administrator  
**System:** AI Novel Engine (Full-Stack Architecture)  
**Mode:** INFRASTRUCTURE ONLY  

---

## BAGIAN 1: DATABASE SCHEMA (SUPABASE)

Jalankan blok SQL murni di bawah ini pada SQL Editor di dashboard Supabase Anda. Skema ini sudah dilengkapi dengan UUID generation otomatis dan relasi `ON DELETE CASCADE` / `SET NULL` untuk menjaga integritas data.

```sql
-- Mengaktifkan ekstensi pgcrypto untuk UUID (opsional jika gen_random_uuid() sudah didukung secara native)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabel Collections (Rak Buku / Folder)
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel Stories (Metadata Novel & AI Memory State)
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'Untitled Story',
    tags TEXT[] DEFAULT '{}',
    ai_memory_state JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabel Chapters (Isi Bab & Ringkasan AI)
CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    ai_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Trigger untuk auto-update kolom updated_at pada tabel stories
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stories_modtime
    BEFORE UPDATE ON stories
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
```

---

## BAGIAN 2: ENVIRONMENT VARIABLES ARCHITECTURE

Berikut adalah arsitektur variabel lingkungan (Environment Variables) yang dibutuhkan oleh sistem. 

*(Catatan: Karena implementasi kita menggunakan Next.js sebagai Full-Stack framework, variabel frontend menggunakan prefix `NEXT_PUBLIC_` agar terekspos ke klien, sementara variabel tanpa prefix hanya dapat diakses oleh backend/API routes).*

### Tabel A: BACKEND ENV VARS (.env / Server Settings)

| Nama Variable | Tipe/Contoh Value | Platform Penyedia | Deskripsi/Fungsi |
| :--- | :--- | :--- | :--- |
| `GROQ_API_KEY` | `gsk_12345abcdef...` | Groq Console | Kunci API untuk mengakses model LLM Groq (Llama 3, Mixtral) di backend. |
| `GEMINI_API_KEY` | `AIzaSyD...` | Google AI Studio | Kunci API untuk mengakses model Gemini (opsional/fallback) di backend. |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1Ni...` | Supabase | Kunci admin Supabase (Bypass RLS). **HANYA** untuk backend, jangan pernah diekspos ke klien. |

### Tabel B: FRONTEND & SHARED ENV VARS (.env.local / Vercel Settings)

| Nama Variable | Tipe/Contoh Value | Deskripsi/Fungsi |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xyz.supabase.co` | URL endpoint REST API Supabase project Anda. Dibutuhkan oleh klien dan server. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1Ni...` | Kunci publik/anonim Supabase untuk operasi database standar dari klien (tunduk pada RLS). |

---

## BAGIAN 3: PRE-FLIGHT CHECKLIST

Lakukan 5 langkah berurutan ini sebelum memulai penulisan kode aplikasi:

1. **Supabase Setup:** Buat project baru di Supabase, buka menu **SQL Editor**, *copy-paste* dan *Run* skema SQL dari Bagian 1. Pastikan ketiga tabel (`collections`, `stories`, `chapters`) berhasil dibuat.
2. **Supabase Keys:** Buka menu **Project Settings > API** di Supabase. Salin `Project URL`, `anon / public key`, dan `service_role / secret key` ke catatan sementara Anda.
3. **Groq & Gemini Setup:** Login ke Groq Console dan Google AI Studio. Buat API Key baru di masing-masing platform dan simpan kuncinya.
4. **Local Environment:** Buat file `.env.local` di *root* folder proyek lokal Anda. Isi dengan kelima variabel dari Tabel A dan Tabel B menggunakan kunci yang sudah Anda kumpulkan.
5. **Vercel/Hosting Deployment:** Buat project baru di Vercel, hubungkan dengan repositori Git Anda. Sebelum menekan tombol *Deploy*, masuk ke menu **Environment Variables** dan masukkan semua kunci dari Tabel A dan Tabel B.
