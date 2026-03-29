-- Buka dashboard Supabase Boss
-- Cari menu "SQL Editor" di bilah menu kiri (logo </> )
-- Klik "New Query", hapus isi kode lama, paste semua kode di bawah ini, lalu jalankan dengan nge-klik tombol RUN (warna hijau) atau tekan CMD/CTRL + Enter

-- 1. Table Transaksi
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL, -- 'income', 'expense', 'saving'
    category TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table Target Tabungan
CREATE TABLE savings_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC NOT NULL,
    monthly_contribution NUMERIC NOT NULL,
    frequency TEXT NOT NULL,
    payment_day INTEGER,
    saved_amount NUMERIC DEFAULT 0,
    completed BOOLEAN DEFAULT false
);

-- 3. Table Budget Utama
CREATE TABLE budget (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    monthly_limit NUMERIC NOT NULL
);

-- 4. Table Budget Kategori
CREATE TABLE category_budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category_limit NUMERIC NOT NULL
);

-- 5. Row Level Security (RLS) agar user hanya bisa akses datanya sendiri (TIDAK BOCOR KE ORANG LAIN)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own transactions" ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own savings" ON savings_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own budget" ON budget FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own category budgets" ON category_budgets FOR ALL USING (auth.uid() = user_id);
