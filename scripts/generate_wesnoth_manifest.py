import os
import json
from pathlib import Path

root = Path('frontend/public/wesnoth-units')
manifest = []
seen = {}
for path in sorted(root.rglob('*.png')):
    rel = path.relative_to(root)
    parts = rel.parts
    era = parts[0] if len(parts) > 1 else 'misc'
    base = rel.stem
    prefix = base.split('-')[0]
    if prefix in seen:
        continue
    seen[prefix] = True
    friendly = prefix.replace('_', ' ').replace('+', ' ').title()
    slug = '-'.join(prefix.replace('+', '_').split('-'))
    manifest.append({
        'id': slug,
        'name': friendly,
        'era': era,
        'path': f'/wesnoth-units/{rel.as_posix()}'
    })

manifest_path = root / 'manifest.json'
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f"Wrote {len(manifest)} avatar entries to {manifest_path}")