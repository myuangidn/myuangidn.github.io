// GLOBALS
const supabaseUrl = 'https://pmuufdztdkaiblyflmij.supabase.co';
const supabaseKey = 'sb_publishable_M-JFpIm9PKoJjnyLSqxQWQ_cD1_vOeG';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const GEMINI_API_KEY = 'AIzaSyBTRSadDQgpPMHL1KOkQwxxOUV5QgdBnKc';
const GROQ_API_KEY = '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';

let transactions = [], savingsGoals = [], budget = null, categoryBudgets = [], currentUser = null;
let cashFlowChartInstance=null, expenseChartInstance=null, incomeExpenseChartInstance=null;
let exchangeRates = {};

// --- AUTH & DATA ---
async function loadData() {
    if (!currentUser) return;
    
    const { data: txs } = await supabaseClient.from('transactions').select('*').order('date', { ascending: true });
    transactions = txs || [];
    
    const { data: svgs } = await supabaseClient.from('savings_goals').select('*').order('date', { ascending: true });
    savingsGoals = svgs || [];
    
    const { data: bg } = await supabaseClient.from('budget').select('*').single();
    budget = bg ? { id: bg.id, limit: bg.monthly_limit } : null;
    
    const { data: cb } = await supabaseClient.from('category_budgets').select('*');
    categoryBudgets = cb ? cb.map(c => ({ id: c.id, name: c.name, limit: c.category_limit })) : [];
}

async function checkLogin() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('flex');
    } else {
        currentUser = session.user;
        const fname = currentUser.user_metadata?.full_name || 'Boss';
        document.getElementById('header-username').innerText = fname.split(' ')[0] + '!';
        document.getElementById('sidebar-username').innerText = fname.split(' ')[0] + '!';
        document.getElementById('profile-name').innerText = fname;
        document.getElementById('profile-email').innerText = currentUser.email;
        
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('flex');
        
        await loadData(); 
        updateAll();
    }
}

// --- FORMATTING (IDR) ---
function formatInputAmount(input) {
    let v = input.value.replace(/[^0-9]/g, '');
    if (v) input.value = parseInt(v, 10).toLocaleString('id-ID');
    if(input.id.includes('saving')) calculateSavingEstimate();
}
function parseFormattedAmount(str) { return str ? parseFloat(str.replace(/\./g, '')) : 0; } 
function parseVal(str) { return parseFormattedAmount(str); } 
function formatIDR(num) { return new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', minimumFractionDigits:0}).format(num); }

// --- SUBMIT HANDLERS ---
document.getElementById('income-form').addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const n = document.getElementById('income-name').value, a = parseVal(document.getElementById('income-amount').value), c = document.getElementById('income-category').value;
    if(n && a>0) { 
        const tx = { user_id: currentUser.id, name:n, amount:a, type:'income', category:c, date:new Date().toISOString() };
        const { data } = await supabaseClient.from('transactions').insert([tx]).select();
        if(data) transactions.push(data[0]); 
        updateAll(); e.target.reset(); showPage('home'); 
    }
});

document.getElementById('expense-form').addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const n = document.getElementById('expense-name').value, a = parseVal(document.getElementById('expense-amount').value), c = document.getElementById('expense-category').value;
    if(n && a>0) { 
        const tx = { user_id: currentUser.id, name:n, amount:-a, type:'expense', category:c, date:new Date().toISOString() };
        const { data } = await supabaseClient.from('transactions').insert([tx]).select();
        if(data) transactions.push(data[0]); 
        updateAll(); e.target.reset(); showPage('home'); 
    }
});

document.getElementById('saving-goal-form').addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const g = { 
        user_id: currentUser.id,
        name: document.getElementById('saving-goal-name').value, 
        target_amount: parseVal(document.getElementById('saving-target-amount').value), 
        monthly_contribution: parseVal(document.getElementById('saving-monthly-contribution').value), 
        frequency: document.getElementById('saving-frequency').value, 
        payment_day: parseInt(document.getElementById('saving-payment-day').value), 
        saved_amount: 0, 
        completed: false 
    };
    const { data } = await supabaseClient.from('savings_goals').insert([g]).select();
    if(data) savingsGoals.push(data[0]); 
    updateAll(); e.target.reset(); showPage('saving');
});

// --- CONVERTER ---
async function fetchRates() {
    try { const res=await fetch('https://open.er-api.com/v6/latest/USD'); const d=await res.json(); if(d.result==='success') exchangeRates=d.rates; document.getElementById('rate-text').textContent="Kurs Terkini"; } catch(e){ document.getElementById('rate-text').textContent="Offline Mode"; }
}
function performConversion() {
    const amt = parseFloat(document.getElementById('conv-amount').value), from = document.getElementById('conv-from').value;
    if(!amt || !exchangeRates[from]) return;
    const res = (amt / exchangeRates[from]) * exchangeRates['IDR'];
    document.getElementById('conv-result').textContent = formatIDR(res);
    document.getElementById('conv-actions').classList.remove('hidden'); document.getElementById('conv-actions').classList.add('grid');
}
function saveConversion(type) {
    const amt = parseFloat(document.getElementById('conv-amount').value), from = document.getElementById('conv-from').value;
    const res = Math.round((amt / exchangeRates[from]) * exchangeRates['IDR']);
    const note = `Konversi: ${amt} ${from}`;
    if(type==='income') { document.getElementById('income-amount').value=res.toLocaleString('id-ID'); document.getElementById('income-name').value=note; showPage('income'); }
    else { document.getElementById('expense-amount').value=res.toLocaleString('id-ID'); document.getElementById('expense-name').value=note; showPage('addExpense'); }
    document.getElementById('conv-amount').value=''; document.getElementById('conv-actions').classList.add('hidden'); document.getElementById('conv-actions').classList.remove('grid');
}


// --- FILTER LOGIC ---
let filterStartDate = null;
let filterEndDate = null;

function applyFilter() {
    filterStartDate = document.getElementById('filter-start').value || null;
    filterEndDate = document.getElementById('filter-end').value || null;
    updateAll();
}

function resetFilter() {
    document.getElementById('filter-start').value = '';
    document.getElementById('filter-end').value = '';
    filterStartDate = null;
    filterEndDate = null;
    updateAll();
}

function getFilteredTransactions() {
    let list = transactions.slice();
    if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0,0,0,0);
        list = list.filter(t => new Date(t.date) >= start);
    }
    if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23,59,59,999);
        list = list.filter(t => new Date(t.date) <= end);
    }
    return list;
}
window.applyFilter = applyFilter;
window.resetFilter = resetFilter;

// --- APP LOGIC ---
function showPage(id) {
    document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item, .sidebar-item').forEach(el => el.classList.toggle('active', el.getAttribute('onclick').includes(id)));
    if(id==='addExpense') updateCatDropdown();
    if(id==='transaction') setTimeout(renderCharts, 100);
    if(id==='investing') updateInvestmentPage(); 
    updateAll();
}
window.showPage = showPage;
function showAuthPage(id){ document.getElementById('login-page').classList.add('hidden'); document.getElementById('register-page').classList.add('hidden'); document.getElementById(id).classList.remove('hidden'); }
window.showAuthPage = showAuthPage;

function updateAll() {
    if(!currentUser) return;
    
    const bal = transactions.reduce((s,t)=>s+Number(t.amount), 0);
    document.getElementById('current-balance').innerText = formatIDR(bal);

    const list = document.getElementById('recent-transaction-list');
    list.innerHTML = transactions.slice(-3).reverse().map(t=> `<div class="flex justify-between items-center bg-white p-4 rounded-3xl mb-2 shadow-sm"><div class="flex gap-3"><div class="w-10 h-10 rounded-full ${t.type==='income'?'bg-green-100 text-green-600':'bg-red-100 text-red-600'} flex items-center justify-center"><i class="fa-solid ${t.type==='income'?'fa-arrow-down':'fa-arrow-up'}"></i></div><div><p class="font-bold text-sm text-gray-700">${t.name}</p><p class="text-xs text-gray-400">${t.category||'-'}</p></div></div><span class="font-bold text-sm ${t.type==='income'?'text-green-600':'text-red-600'}">${t.type==='income'?'+':'-'} ${formatIDR(Math.abs(t.amount))}</span></div>`).join('') || '<p class="text-center text-gray-400 text-sm py-4">Belum ada transaksi</p>';

    const fullList = document.getElementById('full-transaction-list');
    if(fullList) fullList.innerHTML = getFilteredTransactions().reverse().map(t=> `<div class="flex justify-between items-center bg-white p-4 rounded-3xl mb-2 shadow-sm"><div class="flex gap-3"><div class="w-10 h-10 rounded-full ${t.type==='income'?'bg-green-100 text-green-600':'bg-red-100 text-red-600'} flex items-center justify-center"><i class="fa-solid ${t.type==='income'?'fa-arrow-down':'fa-arrow-up'}"></i></div><div><p class="font-bold text-sm text-gray-700">${t.name}</p><p class="text-xs text-gray-400">${t.category||'-'} • ${new Date(t.date).toLocaleDateString()}</p></div></div><span class="font-bold text-sm ${t.type==='income'?'text-green-600':'text-red-600'}">${t.type==='income'?'+':'-'} ${formatIDR(Math.abs(t.amount))}</span></div>`).join('') || '<p class="text-center text-gray-400 text-sm py-4">Belum ada transaksi</p>';

    // Budget
    const bgContainer = document.getElementById('budget-dashboard-container');
    if(budget && budget.limit > 0) {
        const used = transactions.filter(t=>t.type==='expense' && new Date(t.date).getMonth()===new Date().getMonth()).reduce((s,t)=>s+Math.abs(t.amount),0);
        const pct = (used/budget.limit)*100;
        const isOver = used > budget.limit;
        const warn = document.getElementById('home-budget-warning');
        if(warn) isOver ? (warn.classList.remove('hidden'), warn.classList.add('flex')) : (warn.classList.add('hidden'), warn.classList.remove('flex'));
        bgContainer.innerHTML = `<div class="bg-white p-6 rounded-3xl shadow-card"><div class="flex justify-between mb-2"><span class="font-bold text-gray-700">Bulanan</span><button onclick="resetBudget()" class="text-xs text-red-500">Reset</button></div>${isOver?'<p class="text-red-500 text-xs font-bold mb-2">Over Budget!</p>':''}<div class="w-full bg-gray-100 rounded-full h-3 mb-2"><div class="h-3 rounded-full ${isOver?'bg-red-500':'bg-pastel-blue'}" style="width:${Math.min(pct,100)}%"></div></div><div class="flex justify-between text-xs text-gray-500"><span>${formatIDR(used)}</span><span>${formatIDR(budget.limit)}</span></div></div>`;
    } else {
        bgContainer.innerHTML = `<div class="bg-white p-6 rounded-3xl shadow-card text-center"><h3 class="font-bold text-gray-700 mb-4">Atur Budget Bulanan</h3><input id="bg-limit" class="w-full text-center text-xl font-bold bg-gray-50 p-3 rounded-2xl mb-4 outline-none" placeholder="0" oninput="formatInputAmount(this)"><button onclick="setBudget()" class="w-full bg-pastel-blue text-white font-bold py-3 rounded-2xl">Simpan</button></div>`;
    }
    renderCats(); renderSavings();
}

// --- SUB-LOGIC ---
function updateCatDropdown() {
    const s = document.getElementById('expense-category');
    const customs = categoryBudgets.map(c=>c.name);
    const allCats = [...new Set([...customs, 'Lainnya'])];
    s.innerHTML = allCats.map(c=>`<option value="${c}">${c}</option>`).join('');
}
async function setBudget(){ 
    const v=parseVal(document.getElementById('bg-limit').value); 
    if(v>0){ 
        const { data } = await supabaseClient.from('budget').insert([{ user_id: currentUser.id, monthly_limit: v }]).select();
        if(data) budget={ id: data[0].id, limit: v }; 
        updateAll(); 
    }
}
async function resetBudget(){ 
    if(confirm('Reset?') && budget){ 
        await supabaseClient.from('budget').delete().eq('id', budget.id);
        budget=null; updateAll(); 
    }
}
window.setBudget=setBudget; window.resetBudget=resetBudget;

function renderCats(){
    const el = document.getElementById('category-budget-view');
    const list = categoryBudgets.map(c=>{
        const u = transactions.filter(t=>t.type==='expense'&&t.category===c.name).reduce((s,t)=>s+Math.abs(t.amount),0);
        return `<div class="bg-white p-4 rounded-3xl shadow-sm mb-3 relative"><button onclick="delCat('${c.id}')" class="absolute top-4 right-4 text-gray-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button><h4 class="font-bold text-sm">${c.name}</h4><p class="text-xs text-gray-400 mb-2">Batas: ${formatIDR(c.limit)}</p><div class="w-full bg-gray-100 h-2 rounded-full"><div class="h-2 rounded-full bg-pastel-blue" style="width:${Math.min((u/c.limit)*100,100)}%"></div></div><p class="text-[10px] mt-1 text-gray-500">Terpakai: ${formatIDR(u)}</p></div>`;
    }).join('');
    
    el.innerHTML = `
    <div class="bg-white p-5 rounded-3xl shadow-sm mb-4 border border-gray-100">
        <h3 class="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
            <i class="fa-solid fa-tags text-pastel-blue"></i> Tambah Kategori
        </h3>
        <form onsubmit="event.preventDefault(); addCat()" class="flex flex-col gap-3">
            <input id="cat-name" placeholder="Nama Kategori" class="w-full bg-gray-50 p-3 rounded-2xl text-sm outline-none" required>
            <div class="flex gap-2">
                <input id="cat-lim" placeholder="Batas Budget (Rp)" class="flex-1 bg-gray-50 p-3 rounded-2xl text-sm outline-none" required oninput="formatInputAmount(this)">
                <button class="bg-pastel-blue text-white w-12 rounded-2xl flex items-center justify-center shadow-lg active:scale-95"><i class="fa-solid fa-plus text-lg"></i></button>
            </div>
        </form>
    </div>` + list;
}
async function addCat(){ 
    const n=document.getElementById('cat-name').value, l=parseVal(document.getElementById('cat-lim').value); 
    if(n&&l){
        const {data} = await supabaseClient.from('category_budgets').insert([{user_id: currentUser.id, name: n, category_limit: l}]).select();
        if(data) categoryBudgets.push({id: data[0].id, name:n, limit:l}); 
        updateAll();
    } 
}
async function delCat(id){ 
    if(confirm('Hapus?')){
        await supabaseClient.from('category_budgets').delete().eq('id', id);
        categoryBudgets=categoryBudgets.filter(c=>c.id!==id); 
        updateAll();
    } 
}
window.addCat=addCat; window.delCat=delCat;

function renderSavings(){
    const el = document.getElementById('saving-goals-list');
    if(!savingsGoals.length) { el.innerHTML=''; document.getElementById('saving-empty-state').classList.remove('hidden'); return; }
    document.getElementById('saving-empty-state').classList.add('hidden');
    el.innerHTML = savingsGoals.map(g => {
        const pct = (g.saved_amount/g.target_amount)*100;
        return `<div class="bg-white p-6 rounded-3xl shadow-card mb-4"><div><div class="flex justify-between mb-2"><h3 class="font-bold text-gray-800">${g.name}</h3><span class="text-pastel-blue font-bold text-sm">${pct.toFixed(0)}%</span></div><div class="w-full bg-gray-100 h-3 rounded-full mb-3"><div class="bg-pastel-blue h-3 rounded-full" style="width:${Math.min(pct,100)}%"></div></div><p class="text-xs text-gray-500 mb-4">Terkumpul: ${formatIDR(g.saved_amount)} / ${formatIDR(g.target_amount)}</p></div>${g.completed?`<div class="bg-green-100 text-green-700 text-center py-2 rounded-xl font-bold text-xs">Tercapai! 🎉</div>`:`<div class="flex gap-2"><button onclick="saveGoal('${g.id}', ${g.monthly_contribution})" class="flex-1 bg-pastel-blue text-white py-2 rounded-xl text-xs font-bold">Simpan ${formatIDR(g.monthly_contribution)}</button><button onclick="delGoal('${g.id}')" class="w-10 bg-red-50 text-red-500 rounded-xl"><i class="fa-solid fa-trash"></i></button></div>`}</div>`;
    }).join('');
}
async function saveGoal(id, amt){ 
    const g=savingsGoals.find(x=>x.id===id); 
    if(updateBalanceVal()<amt) return alert('Saldo kurang'); 
    
    g.saved_amount = Number(g.saved_amount) + amt; 
    if(g.saved_amount>=g.target_amount) g.completed=true; 
    
    // Update Supabase Saving Goal
    await supabaseClient.from('savings_goals').update({ saved_amount: g.saved_amount, completed: g.completed }).eq('id', id);
    
    // Record Transaction
    const tx = { user_id: currentUser.id, name:`Tabungan: ${g.name}`, amount:-amt, type:'saving', category:'Tabungan', date:new Date().toISOString()};
    const { data } = await supabaseClient.from('transactions').insert([tx]).select();
    if(data) transactions.push(data[0]);
    
    updateAll(); 
}
async function delGoal(id){ 
    if(confirm('Hapus target tabungan ini?')){ 
        await supabaseClient.from('savings_goals').delete().eq('id', id);
        savingsGoals=savingsGoals.filter(x=>x.id!==id); 
        updateAll(); 
    } 
}
function updateBalanceVal(){ return transactions.reduce((s,t)=>s+Number(t.amount),0); }
window.saveGoal=saveGoal; window.delGoal=delGoal;

function updateSavingLabel() {
    const freq = document.getElementById('saving-frequency').value;
    const input = document.getElementById('saving-monthly-contribution');
    if(freq === 'Harian') input.placeholder = "Nominal per Hari";
    else if(freq === 'Mingguan') input.placeholder = "Nominal per Minggu";
    else input.placeholder = "Nominal per Bulan";
}
window.updateSavingLabel = updateSavingLabel;

function calculateSavingEstimate() {
    const target = parseFormattedAmount(document.getElementById('saving-target-amount').value) || 0;
    const contribution = parseFormattedAmount(document.getElementById('saving-monthly-contribution').value) || 0;
    const estimateDiv = document.getElementById('saving-estimate');
    if (target > 0 && contribution > 0) {
        const months = Math.ceil(target / contribution);
        estimateDiv.textContent = `Tercapai dlm ± ${months} kali menabung.`;
        estimateDiv.classList.remove('hidden');
    } else {
        estimateDiv.classList.add('hidden');
    }
}

// ============================================
// === FITUR INVESTASI & AI ===
// ============================================

function openApiKeyModal(){ document.getElementById('api-key-modal').classList.remove('hidden'); }
function closeApiKeyModal(){ document.getElementById('api-key-modal').classList.add('hidden'); }
function saveApiKey(){
    const key = document.getElementById('gemini-api-key').value;
    localStorage.setItem('gemini_key', key);
    closeApiKeyModal();
    alert('API Key tersimpan! Fitur AI sekarang aktif.');
}

// --- ANALISIS STABILITAS PEKERJAAN / PENDAPATAN ---
function analyzeIncomeStability() {
    const incomes = transactions.filter(t => t.type === 'income');
    if (incomes.length === 0) return { level: 'Belum Ada Data', icon: '❓', color: 'gray', description: 'Belum ada data pemasukan untuk dianalisis.', monthlyBreakdown: [], incomeCategories: {} };

    // Kelompokkan pemasukan per bulan (key: "2026-03")
    const monthlyMap = {};
    const incomeCategories = {};
    incomes.forEach(t => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap[key] = (monthlyMap[key] || 0) + Number(t.amount);
        const cat = t.category || 'Lainnya';
        incomeCategories[cat] = (incomeCategories[cat] || 0) + Number(t.amount);
    });

    const months = Object.keys(monthlyMap).sort();
    const amounts = months.map(m => monthlyMap[m]);
    const monthlyBreakdown = months.map(m => ({ month: m, amount: monthlyMap[m] }));

    // Hitung variasi (coefficient of variation)
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / amounts.length);
    const cv = avg > 0 ? (stdDev / avg) * 100 : 0;

    // Cek apakah ada kategori "Gaji" yang dominan (>50% total income)
    const totalInc = Object.values(incomeCategories).reduce((a, b) => a + b, 0);
    const gajiAmount = incomeCategories['Gaji'] || 0;
    const gajiRatio = totalInc > 0 ? (gajiAmount / totalInc) * 100 : 0;

    // Tentukan level stabilitas
    let level, icon, color, description;

    if (months.length < 2) {
        level = 'Belum Cukup Data';
        icon = '📊';
        color = 'gray';
        description = 'Butuh minimal 2 bulan data pemasukan untuk analisis stabilitas.';
    } else if (gajiRatio >= 60 && cv < 25) {
        level = 'Sangat Stabil';
        icon = '🏢';
        color = 'green';
        description = `Pendapatan didominasi Gaji tetap (${gajiRatio.toFixed(0)}%) dengan fluktuasi rendah. Cocok untuk investasi jangka panjang.`;
    } else if (gajiRatio >= 40 && cv < 40) {
        level = 'Cukup Stabil';
        icon = '👔';
        color = 'blue';
        description = `Kombinasi pendapatan cukup teratur. Variasi ${cv.toFixed(0)}% masih wajar. Bisa mulai diversifikasi investasi.`;
    } else if (cv < 50) {
        level = 'Moderat';
        icon = '💼';
        color = 'yellow';
        description = `Pendapatan berfluktuasi moderat (CV: ${cv.toFixed(0)}%). Utamakan dana darurat sebelum investasi agresif.`;
    } else {
        level = 'Tidak Stabil';
        icon = '⚠️';
        color = 'red';
        description = `Pendapatan sangat fluktuatif (CV: ${cv.toFixed(0)}%). Prioritaskan tabungan darurat & hindari instrumen berisiko tinggi.`;
    }

    return { level, icon, color, description, monthlyBreakdown, incomeCategories, cv, gajiRatio, avgIncome: avg, totalMonths: months.length };
}

function analyzeFinancialProfile() {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const balance = totalIncome - totalExpense;
    
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    
    const categories = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        categories[t.category || 'Lainnya'] = (categories[t.category || 'Lainnya'] || 0) + Math.abs(Number(t.amount));
    });
    const topCategories = Object.entries(categories).sort((a,b) => b[1] - a[1]);
    const topCategoryName = topCategories.length > 0 ? topCategories[0][0] : "Belum ada";

    let profile = "Konservatif", score = 0;
    if (savingsRate < 10) { profile = "Sangat Hati-hati"; score = 40; }
    else if (savingsRate < 30) { profile = "Konservatif"; score = 65; }
    else if (savingsRate < 50) { profile = "Moderat"; score = 80; }
    else { profile = "Agresif"; score = 95; }

    if (transactions.length === 0) { profile = "Belum Ada Data"; score = 0; }

    // Tambahkan data stabilitas pekerjaan
    const stability = analyzeIncomeStability();

    return { totalIncome, totalExpense, balance, savingsRate, topCategories, topCategoryName, profile, score, stability };
}

function updateInvestmentPage() {
    const analysis = analyzeFinancialProfile();
    document.getElementById('health-score').innerText = analysis.score;
    document.getElementById('health-status').innerText = analysis.score > 70 ? "Sangat Sehat" : (analysis.score > 50 ? "Cukup Sehat" : "Perlu Perbaikan");
    document.getElementById('health-status').className = `text-xs mt-2 font-medium ${analysis.score > 70 ? 'text-green-500' : (analysis.score > 50 ? 'text-yellow-500' : 'text-red-500')}`;
    document.getElementById('risk-profile').innerText = analysis.profile;
    document.getElementById('invest-potential').innerText = formatIDR(Math.max(0, analysis.balance * 0.2)); 

    // Update Kartu Stabilitas Pekerjaan
    const stabilityEl = document.getElementById('job-stability-card');
    if (stabilityEl) {
        const s = analysis.stability;
        const colorMap = { green: 'text-green-600 bg-green-50', blue: 'text-blue-600 bg-blue-50', yellow: 'text-yellow-600 bg-yellow-50', red: 'text-red-600 bg-red-50', gray: 'text-gray-500 bg-gray-50' };
        const borderMap = { green: 'border-green-400', blue: 'border-blue-400', yellow: 'border-yellow-400', red: 'border-red-400', gray: 'border-gray-300' };
        stabilityEl.innerHTML = `
            <div class="bg-white p-6 rounded-3xl shadow-card border-l-4 ${borderMap[s.color] || 'border-gray-300'}">
                <p class="text-xs text-gray-400 uppercase font-bold mb-2">Stabilitas Pekerjaan</p>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-2xl">${s.icon}</span>
                    <h3 class="text-xl font-bold text-gray-800">${s.level}</h3>
                </div>
                <p class="text-xs mt-2 text-gray-500 leading-relaxed">${s.description}</p>
            </div>`;
    }

    renderPlatformSuggestions(analysis.profile);
}

function renderPlatformSuggestions(profile) {
    const container = document.getElementById('platform-list');
    const platforms = [
        { name: "Bibit", type: "Reksadana", suit: ["Konservatif", "Moderat"], desc: "Investasi otomatis & pemula.", color: "bg-green-100 text-green-700" },
        { name: "Ajaib", type: "Saham & Kripto", suit: ["Moderat", "Agresif"], desc: "Untuk yang suka trading.", color: "bg-blue-100 text-blue-700" },
        { name: "Pluang", type: "Emas & Indeks", suit: ["Konservatif", "Agresif"], desc: "Aset beragam dalam satu aplikasi.", color: "bg-yellow-100 text-yellow-700" },
        { name: "DepositoBank", type: "Simpanan", suit: ["Sangat Hati-hati"], desc: "Risiko sangat rendah.", color: "bg-gray-100 text-gray-700" }
    ];
    let filtered = platforms.filter(p => p.suit.includes(profile));
    if(profile === "Belum Ada Data") filtered = platforms; 
    if(filtered.length === 0) filtered = [platforms[0]]; 
    container.innerHTML = filtered.map(p => `<div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"><div class="flex justify-between items-start mb-2"><span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${p.color}">${p.type}</span><i class="fa-solid fa-arrow-up-right-from-square text-gray-300"></i></div><h4 class="font-bold text-gray-800">${p.name}</h4><p class="text-xs text-gray-500 mt-1">${p.desc}</p></div>`).join('');
}

// --- GENERATE AI ADVICE (DENGAN GOOGLE SEARCH GROUNDING) ---
async function generateAIAdvice() {
    const loading = document.getElementById('ai-loading');
    const content = document.getElementById('ai-content');
    const btn = document.getElementById('btn-generate-ai');
    loading.classList.remove('hidden'); content.classList.add('hidden'); btn.disabled = true; btn.classList.add('opacity-50');
    
    const analysis = analyzeFinancialProfile();
    const stability = analysis.stability;
    const apiKey = localStorage.getItem('gemini_key') || GEMINI_API_KEY;
    
    if (apiKey && analysis.totalIncome > 0) {
        try {
            // Rangkum data kategori pemasukan untuk prompt
            const incomeCatSummary = stability.incomeCategories 
                ? Object.entries(stability.incomeCategories).map(([cat, amt]) => `${cat}: ${formatIDR(amt)}`).join(', ') 
                : 'Belum ada';

            // Rangkum riwayat pemasukan per bulan
            const monthlyHistory = stability.monthlyBreakdown 
                ? stability.monthlyBreakdown.map(m => `${m.month}: ${formatIDR(m.amount)}`).join(', ') 
                : 'Belum ada';

            // Rangkum top 3 kategori pengeluaran
            const topExpenseSummary = analysis.topCategories.slice(0, 3).map(([cat, amt]) => `${cat}: ${formatIDR(amt)}`).join(', ');

            const systemPrompt = `Kamu adalah "MyUang AI Advisor", penasihat keuangan & investasi pribadi yang cerdas, berbahasa Indonesia santai tapi profesional. Tugasmu:

1. **ANALISIS STABILITAS PEKERJAAN**: Dari data pendapatan user, simpulkan apakah mereka punya pekerjaan tetap/stabil atau tidak tetap (freelance/gig). Berikan penilaianmu di AWAL jawaban.

2. **EVALUASI KESEHATAN KEUANGAN**: Analisis pola pengeluaran dan rasio tabungan mereka.

3. **REKOMENDASI INVESTASI REAL-TIME**: Gunakan kemampuan pencarian Google (Google Search) untuk mencari info terkini tentang:
   - Suku bunga deposito bank di Indonesia saat ini
   - Kinerja IHSG dan reksadana terkini
   - Harga emas hari ini
   - Platform investasi yang sedang populer di Indonesia (Bibit, Ajaib, Bareksa, Pluang, Stockbit, Tokocrypto, dll)
   - Tren pasar investasi Indonesia terbaru
   
   Sebutkan angka/data spesifik dari hasil pencarian (misal: "Deposito BCA saat ini 4.25% p.a." atau "IHSG hari ini di level 7.xxx").

4. **SARAN PERSONAL**: Berikan rekomendasi platform DAN jenis investasi yang COCOK untuk profil user ini (sesuaikan dengan stabilitas pekerjaannya dan kondisi keuangannya).

Format jawaban dalam **Markdown** yang rapi dengan heading, bullet points, dan emoji. Buat ringkas tapi informatif (maks 400 kata).`;

            const userPrompt = `Berikut data keuangan saya:

📊 **Ringkasan Keuangan:**
- Total Pemasukan: ${formatIDR(analysis.totalIncome)}
- Total Pengeluaran: ${formatIDR(analysis.totalExpense)}
- Saldo Tersisa: ${formatIDR(analysis.balance)}
- Rasio Tabungan: ${analysis.savingsRate.toFixed(1)}%
- Profil Risiko: ${analysis.profile}

💼 **Data Pendapatan (Stabilitas Karir):**
- Stabilitas saat ini: ${stability.level}
- Riwayat pemasukan per bulan: ${monthlyHistory}
- Kategori pemasukan: ${incomeCatSummary}
- Jumlah bulan tercatat: ${stability.totalMonths || 0}
${stability.cv !== undefined ? `- Variasi pendapatan (CV): ${stability.cv.toFixed(1)}%` : ''}
${stability.gajiRatio !== undefined ? `- Rasio gaji tetap: ${stability.gajiRatio.toFixed(0)}%` : ''}

💸 **Top Kategori Pengeluaran:** ${topExpenseSummary || 'Belum ada'}

Tolong analisis kondisi keuangan saya dan rekomendasikan investasi yang sesuai, termasuk platform dan jenis investasi spesifik berdasarkan kondisi pasar HARI INI.`;

            // === STRATEGI MULTI-PROVIDER: Gemini dulu, lalu Groq sebagai fallback ===
            const geminiModels = [
                { name: 'gemini-2.0-flash', useGrounding: true },
                { name: 'gemini-2.0-flash-lite', useGrounding: true },
                { name: 'gemini-1.5-flash', useGrounding: false }
            ];

            let aiSuccess = false;

            // --- TAHAP 1: Coba semua model Gemini ---
            for (const model of geminiModels) {
                try {
                    console.log(`[MyUang AI] Mencoba Gemini: ${model.name}...`);
                    
                    const requestBody = {
                        system_instruction: {
                            parts: [{ text: systemPrompt }]
                        },
                        contents: [{ 
                            role: 'user',
                            parts: [{ text: userPrompt }] 
                        }]
                    };

                    if (model.useGrounding) {
                        requestBody.tools = [{ google_search: {} }];
                    }

                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${model.name}:generateContent?key=${apiKey}`, 
                        { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json' }, 
                            body: JSON.stringify(requestBody) 
                        }
                    );
                    const data = await response.json();
                    
                    if (data.error) {
                        console.warn(`[MyUang AI] Gemini ${model.name} gagal:`, data.error.message);
                        continue;
                    }

                    const textParts = data.candidates[0].content.parts.filter(p => p.text).map(p => p.text);
                    const fullText = textParts.join('\n');
                    content.innerHTML = marked.parse(fullText);

                    content.innerHTML += `<div class="mt-3 flex items-center gap-2"><span class="text-[10px] bg-purple-50 text-ai-purple px-2 py-1 rounded-full font-medium"><i class="fa-solid fa-microchip mr-1"></i>${model.name}${model.useGrounding ? ' + Google Search' : ''}</span></div>`;

                    const groundingMeta = data.candidates[0].groundingMetadata;
                    if (groundingMeta && groundingMeta.searchEntryPoint && groundingMeta.searchEntryPoint.renderedContent) {
                        content.innerHTML += `<div class="mt-4 pt-4 border-t border-purple-100">${groundingMeta.searchEntryPoint.renderedContent}</div>`;
                    } else if (groundingMeta && groundingMeta.groundingChunks && groundingMeta.groundingChunks.length > 0) {
                        const sources = groundingMeta.groundingChunks
                            .filter(c => c.web)
                            .slice(0, 5)
                            .map(c => `<a href="${c.web.uri}" target="_blank" class="text-ai-purple hover:underline text-[11px]">${c.web.title || c.web.uri}</a>`)
                            .join(' • ');
                        if (sources) {
                            content.innerHTML += `<div class="mt-4 pt-4 border-t border-purple-100"><p class="text-[10px] text-gray-400 mb-1"><i class="fa-solid fa-globe mr-1"></i>Sumber data real-time:</p><div class="flex flex-wrap gap-1">${sources}</div></div>`;
                        }
                    }

                    aiSuccess = true;
                    console.log(`[MyUang AI] Berhasil dengan Gemini: ${model.name}`);
                    break;

                } catch (fetchError) {
                    console.warn(`[MyUang AI] Error Gemini ${model.name}:`, fetchError);
                    continue;
                }
            }

            // --- TAHAP 2: Fallback ke Groq (Llama) jika semua Gemini gagal ---
            if (!aiSuccess) {
                try {
                    console.log('[MyUang AI] Semua Gemini gagal, mencoba Groq (Llama 3.3 70B)...');
                    
                    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${GROQ_API_KEY}`
                        },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: userPrompt }
                            ],
                            temperature: 0.7,
                            max_tokens: 1500
                        })
                    });
                    const groqData = await groqResponse.json();

                    if (groqData.error) throw new Error(groqData.error.message);

                    const groqText = groqData.choices[0].message.content;
                    content.innerHTML = marked.parse(groqText);
                    content.innerHTML += `<div class="mt-3 flex items-center gap-2"><span class="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded-full font-medium"><i class="fa-solid fa-bolt mr-1"></i>Llama 3.3 70B via Groq</span></div>`;
                    
                    aiSuccess = true;
                    console.log('[MyUang AI] Berhasil dengan Groq!');

                } catch (groqError) {
                    console.error('[MyUang AI] Groq juga gagal:', groqError);
                }
            }

            if (!aiSuccess) {
                throw new Error('Semua provider AI (Gemini & Groq) tidak tersedia saat ini');
            }

        } catch (error) { 
            console.error('AI Advice Error:', error); 
            content.innerHTML = `<p class="text-red-500 text-xs mb-3"><i class="fa-solid fa-circle-exclamation mr-1"></i>Gagal menghubungi AI: ${error.message}. Menggunakan saran offline.</p>` + generateOfflineAdvice(analysis); 
        }
    } else { 
        await new Promise(r => setTimeout(r, 1500)); 
        content.innerHTML = generateOfflineAdvice(analysis); 
    }
    loading.classList.add('hidden'); content.classList.remove('hidden'); btn.disabled = false; btn.classList.remove('opacity-50');
}
window.generateAIAdvice = generateAIAdvice;

function generateOfflineAdvice(data) {
    if (data.totalIncome === 0) return "<p>Halo! Yuk catat pemasukan dan pengeluaranmu dulu agar saya bisa memberikan saran investasi yang akurat!</p>";
    
    let advice = "";
    
    // Tambahkan info stabilitas pekerjaan di saran offline
    if (data.stability && data.stability.level !== 'Belum Ada Data' && data.stability.level !== 'Belum Cukup Data') {
        advice += `<div class="bg-purple-50 border border-purple-100 rounded-2xl p-4 mb-4"><p class="text-xs font-bold text-ai-purple mb-1">${data.stability.icon} Stabilitas Pekerjaan: ${data.stability.level}</p><p class="text-xs text-gray-600">${data.stability.description}</p></div>`;
    }

    if (data.savingsRate < 10) {
        advice += `<p><strong>Waduh, hati-hati!</strong> Tabunganmu di bawah 10%. Kategori <strong>${data.topCategoryName}</strong> terlihat boros. Kurangi jajan ya.</p><p class="mt-2">💡 <strong>Saran:</strong> Fokus Dana Darurat di <strong>Reksadana Pasar Uang</strong>.</p>`;
    } else if (data.savingsRate < 40) {
        advice += `<p><strong>Kerja bagus!</strong> Keuangan stabil. Kamu menyisihkan ${data.savingsRate.toFixed(0)}%.</p><p class="mt-2">💡 <strong>Saran:</strong> Cicil <strong>Emas</strong> atau <strong>Reksadana Obligasi</strong>.</p>`;
    } else {
        advice += `<p><strong>Luar biasa!</strong> Cashflow sehat (Surplus > 40%).</p><p class="mt-2">💡 <strong>Saran:</strong> Coba instrumen agresif seperti <strong>Saham Bluechip</strong>.</p>`;
    }

    advice += `<p class="mt-3 text-xs text-gray-400 italic"><i class="fa-solid fa-info-circle mr-1"></i>Masukkan Gemini API Key untuk mendapatkan analisis AI real-time dengan data pasar terkini.</p>`;
    return advice;
}

function renderCharts(){
    if(cashFlowChartInstance) cashFlowChartInstance.destroy();
    if(incomeExpenseChartInstance) incomeExpenseChartInstance.destroy();
    if(expenseChartInstance) expenseChartInstance.destroy();
    const ctx1 = document.getElementById('cashFlowChart');
    if(ctx1){
        const d = [0,0,0,0,0,0].map((_,i)=>{ 
            const dt=new Date(); dt.setMonth(dt.getMonth()-i); 
            const inc = transactions.filter(t=>t.type==='income'&&new Date(t.date).getMonth()===dt.getMonth()).reduce((s,t)=>s+Number(t.amount),0); 
            const exp = transactions.filter(t=>t.type==='expense'&&new Date(t.date).getMonth()===dt.getMonth()).reduce((s,t)=>s+Math.abs(Number(t.amount)),0); 
            return {l:dt.toLocaleString('id-ID',{month:'short'}), i:inc, e:exp}; 
        }).reverse();
        cashFlowChartInstance = new Chart(ctx1, {type:'bar', data:{labels:d.map(x=>x.l), datasets:[{label:'Masuk',data:d.map(x=>x.i),backgroundColor:'#a3bffa'},{label:'Keluar',data:d.map(x=>x.e),backgroundColor:'#ffb3c1'}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{borderDash:[5,5]}}}}});
    }
    const ctx2 = document.getElementById('incomeExpenseChart');
    if(ctx2){
        const i = transactions.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0); const e = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+Math.abs(Number(t.amount)),0);
        incomeExpenseChartInstance = new Chart(ctx2, {type:'doughnut', data:{labels:['Masuk','Keluar'], datasets:[{data:[i,e], backgroundColor:['#4ade80','#ef4444'], borderWidth:0}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}}});
    }
    const ctx3 = document.getElementById('expenseBreakdownChart');
    if(ctx3){
        const cats = {}; transactions.filter(t=>t.type==='expense').forEach(t=>{ const c=t.category||'Lainnya'; cats[c]=(cats[c]||0)+Math.abs(Number(t.amount)); }); const l=Object.keys(cats), d=Object.values(cats);
        expenseChartInstance = new Chart(ctx3, {type:'doughnut', data:{labels:l.length?l:['Kosong'], datasets:[{data:l.length?d:[1], backgroundColor:l.length?['#304674','#E60073','#d1d5db','#fbbf24']:['#f3f4f6'], borderWidth:0}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}}});
    }
}

// ============================================
// === FITUR EXPORT (CSV & PDF) ===
// ============================================

function exportCSV() {
    if(getFilteredTransactions().length === 0) return alert('Belum ada transaksi untuk dieksport di periode ini!');
    
    // Headers
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Tanggal,Tipe,Kategori,Keterangan,Nominal (Rp)\n";
    
    // Rows
    getFilteredTransactions().sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(tx => {
        const date = new Date(tx.date).toLocaleDateString();
        const type = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        const nominal = Math.abs(Number(tx.amount));
        const row = `"${date}","${type}","${tx.category || '-'}","${tx.name}","${nominal}"`;
        csvContent += row + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "MyUang_Transaksi.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
window.exportCSV = exportCSV;

function exportPDF() {
    if(getFilteredTransactions().length === 0) return alert('Belum ada transaksi untuk dieksport di periode ini!');
    if (!window.jspdf || !window.jspdf.jsPDF) return alert('Plugin PDF sedang loading, coba lagi sebentar lagi.');
    
    const doc = new window.jspdf.jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text("Laporan Transaksi MyUang", 14, 22);

    let yPos = 30;
    if (filterStartDate || filterEndDate) {
        const sDate = filterStartDate ? new Date(filterStartDate).toLocaleDateString('id-ID') : 'Awal';
        const eDate = filterEndDate ? new Date(filterEndDate).toLocaleDateString('id-ID') : 'Sekarang';
        doc.setFontSize(10);
        doc.text(`Periode  : ${sDate} s/d ${eDate}`, 14, 30);
        yPos = 36;
    }
    doc.setFontSize(11);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, yPos);
    doc.text(`Dicetak oleh: ${currentUser?.user_metadata?.full_name || 'Boss'}`, 14, yPos + 6);

    
    // Table Headers
    const head = [['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Nominal']];
    
    // Table Body
    const body = getFilteredTransactions().sort((a,b) => new Date(a.date) - new Date(b.date)).map(tx => {
        const date = new Date(tx.date).toLocaleDateString();
        const type = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        const nominal = formatIDR(Math.abs(Number(tx.amount)));
        return [date, type, tx.category || '-', tx.name, nominal];
    });
    
    // AutoTable generating
    doc.autoTable({
        startY: (filterStartDate || filterEndDate) ? 48 : 42,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [48, 70, 116] }, // pastel-blue color
        margin: { top: 10 }
    });
    
    // Total Summary
    const finalY = doc.lastAutoTable.finalY + 10;
    const totalIncome = getFilteredTransactions().filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = getFilteredTransactions().filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const saldoAkhir = totalIncome - totalExpense;
    
    doc.setFontSize(12);
    doc.text(`Total Pemasukan: ${formatIDR(totalIncome)}`, 14, finalY);
    doc.text(`Total Pengeluaran: ${formatIDR(totalExpense)}`, 14, finalY + 8);
    doc.text(`Saldo Bersih: ${formatIDR(saldoAkhir)}`, 14, finalY + 16);
    
    doc.save('MyUang_Transaksi.pdf');
}
window.exportPDF = exportPDF;

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}
window.logout = logout;

window.onload = () => { checkLogin(); fetchRates(); };
