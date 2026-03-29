# MyUang - Personal Finance Management Web App

![Project Type](https://img.shields.io/badge/Type-Web%20Application-blue)
![Tech](https://img.shields.io/badge/Tech-HTML%20%7C%20CSS%20%7C%20JavaScript-orange)
![Status](https://img.shields.io/badge/Status-Complete-green)

---

## 📱 Project Overview

**MyUang** adalah aplikasi web manajemen keuangan pribadi yang dirancang untuk membantu pengguna mengatur pemasukan, pengeluaran, budget, dan target tabungan mereka. Dilengkapi dengan fitur AI Advisor yang memberikan rekomendasi investasi berdasarkan pola keuangan pengguna.

---

## 🎯 Problem Statement

Banyak orang kesulitan melacak pengeluaran harian dan mengatur keuangan pribadi mereka. MyUang hadir sebagai solusi all-in-one yang mudah digunakan, tanpa perlu instalasi, dan bekerja langsung di browser.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 💰 **Dashboard Keuangan** | Ringkasan saldo, pemasukan, dan pengeluaran dalam satu tampilan |
| 📊 **Visualisasi Data** | Grafik interaktif untuk analisis cashflow dan kategori pengeluaran |
| 🎯 **Budget Tracker** | Atur batas pengeluaran per kategori dengan peringatan over-budget |
| 🐷 **Savings Goal** | Buat target tabungan dengan tracking progress |
| 💱 **Konversi Mata Uang** | Konversi real-time dari berbagai mata uang asing ke Rupiah |
| 🤖 **AI Financial Advisor** | Saran investasi cerdas berbasis profil risiko pengguna |
| 🔐 **User Authentication** | Sistem login/register dengan data tersimpan lokal |

---

## 🛠️ Tech Stack

### Front-End
```
HTML5          → Semantic markup structure
CSS3           → Custom styling & animations
JavaScript     → Application logic & interactivity
TailwindCSS    → Utility-first CSS framework
```

### Libraries & APIs
```
Chart.js       → Interactive data visualization
Marked.js      → Markdown parsing for AI responses
Font Awesome   → Icon library
Google Fonts   → Poppins typography

Open ER-API    → Real-time currency exchange rates
Google Gemini  → AI-powered financial recommendations
```

### Client-Side Storage
```
LocalStorage   → Persistent data storage (no backend required)
```

---

## 💡 Technical Highlights

### 1. Single Page Application (SPA) Architecture
Navigasi tanpa page reload menggunakan JavaScript murni, memberikan pengalaman seperti native app.

### 2. Responsive Design
- Mobile-first approach dengan breakpoints untuk tablet dan desktop
- Adaptive navigation (bottom nav untuk mobile, sidebar untuk desktop)
- Safe area support untuk perangkat iOS

### 3. Offline-First Capability
Semua data tersimpan di localStorage, aplikasi tetap berfungsi tanpa koneksi internet (kecuali fitur konversi mata uang dan AI).

### 4. Progressive Enhancement
- AI Advisor bekerja tanpa API key (rule-based fallback)
- Graceful degradation jika API tidak tersedia

### 5. Real-Time Data Visualization
- Bar chart untuk arus kas 6 bulan terakhir
- Doughnut chart untuk breakdown kategori pengeluaran
- Progress bar untuk budget dan savings tracking

---

## 📸 Screenshots

> *Tambahkan screenshot aplikasi di sini*

---

## 🎨 Design Approach

- **Clean & Minimalist UI** dengan card-based layout
- **Pastel Color Palette** (Pastel Blue #304674 sebagai primary color)
- **Micro-interactions** untuk feedback visual yang responsif
- **Smooth Transitions** dengan CSS animations

---

## 📚 Skills Demonstrated

### Hard Skills
- ✅ Front-End Web Development (HTML, CSS, JavaScript)
- ✅ CSS Framework (TailwindCSS)
- ✅ API Integration (REST API consumption)
- ✅ Data Visualization (Chart.js)
- ✅ State Management (Vanilla JS)
- ✅ Client-Side Storage (LocalStorage)
- ✅ Responsive & Mobile-First Design
- ✅ AI Integration (Google Gemini API)

### Soft Skills
- ✅ Problem Solving
- ✅ UI/UX Thinking
- ✅ Attention to Detail
- ✅ User-Centric Design

---

## 🚀 Future Improvements

- [ ] PWA Support (offline mode penuh + installable)
- [ ] Backend Integration (database untuk multi-device sync)
- [ ] Export data ke PDF/Excel
- [ ] Dark Mode
- [ ] Multi-currency wallet

---

## 📂 Project Structure

```
MyUang/
├── index.html          # Landing page
├── loginregister.html  # Authentication page
├── mainapp.html        # Main application (SPA)
└── image/
    └── logo.png        # App logo
```

---

## 🔗 Links

- **Live Demo**: [Tambahkan URL jika di-deploy]
- **Repository**: [Tambahkan URL GitHub]

---

## 👤 Developer

**[Nama Kamu]**  
Aspiring Web Developer

---

*© 2024 MyUang Platform. Built with ❤️ for personal finance management.*
