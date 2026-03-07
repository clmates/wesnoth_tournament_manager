import urllib.request
import json
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass
url = 'https://restcountries.com/v3.1/all?fields=cca2,name,flag'
with urllib.request.urlopen(url) as resp:
    data = json.load(resp)
entries = []
for item in data:
    code = item.get('cca2')
    if not code or len(code) != 2:
        continue
    name = item.get('name', {}).get('common')
    flag = item.get('flag')
    if not name or not flag:
        continue
    entries.append((code.upper(), name.replace("'", "''"), flag))
entries.sort(key=lambda x: x[1])
output_path = 'scripts/countries_insert.sql'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('INSERT INTO countries (code, name, flag_emoji, is_active) VALUES\n')
    for i, (code, name, flag) in enumerate(entries):
        comma = ',' if i < len(entries) - 1 else ';'
        f.write(f"  ('{code}', '{name}', '{flag}', true){comma}\n")
print(f'Wrote {len(entries)} countries to {output_path}')
