import re

with open('loginregister.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add Supabase CDN
html = html.replace('<script src="https://cdn.tailwindcss.com"></script>', '<script src="https://cdn.tailwindcss.com"></script>\\n    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>')

# 2. Replace script block
new_script = """    <script>
        const supabaseUrl = 'https://pmuufdztdkaiblyflmij.supabase.co';
        const supabaseKey = 'sb_publishable_M-JFpIm9PKoJjnyLSqxQWQ_cD1_vOeG';
        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

        function toggleAuth(page) {
            document.getElementById(page === 'register' ? 'login-page' : 'register-page').classList.add('hidden');
            document.getElementById(page === 'register' ? 'register-page' : 'login-page').classList.remove('hidden');
        }

        function redirectUser() {
            window.location.href = 'mainapp.html';
        }

        // --- LOGIN LOGIC ---
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'Loading...';
            btn.disabled = true;

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');

            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            btn.innerText = originalText;
            btn.disabled = false;

            if (error) {
                errorEl.textContent = error.message;
                errorEl.classList.remove('hidden');
            } else {
                redirectUser();
            }
        });

        // --- REGISTER LOGIC ---
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'Loading...';
            btn.disabled = true;

            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const errorEl = document.getElementById('register-error');

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: name } }
            });
            
            btn.innerText = originalText;
            btn.disabled = false;

            if (error) {
                errorEl.textContent = error.message;
                errorEl.classList.remove('hidden');
            } else {
                alert('Registrasi sukses! Silakan login.');
                toggleAuth('login');
            }
        });

        window.onload = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                redirectUser();
                return;
            }
        }
    </script>"""

script_pattern = re.compile(r'<script>\s*function toggleAuth.*?<\/script>', re.DOTALL)
html = script_pattern.sub(new_script.replace('\\', '\\\\'), html)

with open('loginregister.html', 'w', encoding='utf-8') as f:
    f.write(html)
