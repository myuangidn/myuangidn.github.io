import sys
files = ['index.html', 'loginregister.html']

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        if line.startswith('<<<<<<< HEAD'):
            continue
        if line.startswith('======='):
            break
        new_lines.append(line)
    
    html = "".join(new_lines)
    with open(file, 'w', encoding='utf-8') as f:
        f.write(html)
