#!/usr/bin/env python3
"""
Smart CSS duplicate consolidator - removes true duplicates, preserves media queries.
"""

import re
from pathlib import Path

def parse_css_blocks(content):
    """Parse CSS into blocks preserving context."""
    blocks = []
    current_pos = 0
    
    # Find all CSS rules (selectors + declarations)
    pattern = r'([^{}]+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}'
    
    for match in re.finditer(pattern, content):
        selector = match.group(1).strip()
        declarations = match.group(2).strip()
        start = match.start()
        end = match.end()
        
        blocks.append({
            'selector': selector,
            'declarations': declarations,
            'full': match.group(0),
            'start': start,
            'end': end,
            'is_media': '@media' in selector.lower(),
            'is_keyframes': '@keyframes' in selector.lower()
        })
    
    return blocks

def normalize_selector(selector):
    """Normalize selector for comparison."""
    return ' '.join(selector.split()).lower()

def is_identical_block(block1, block2):
    """Check if two blocks are truly identical (not just same selector)."""
    sel1 = normalize_selector(block1['selector'])
    sel2 = normalize_selector(block2['selector'])
    
    decl1 = ' '.join(block1['declarations'].split()).lower()
    decl2 = ' '.join(block2['declarations'].split()).lower()
    
    return sel1 == sel2 and decl1 == decl2

def find_true_duplicates(blocks):
    """Find blocks that are 100% identical (not media queries or keyframes)."""
    duplicates = []
    seen = {}
    
    for i, block in enumerate(blocks):
        if block['is_media'] or block['is_keyframes']:
            continue  # Don't remove media queries or animations
        
        key = (normalize_selector(block['selector']), 
               ' '.join(block['declarations'].split()).lower())
        
        if key in seen:
            # Found duplicate
            duplicates.append((seen[key], i))  # (original_index, duplicate_index)
        else:
            seen[key] = i
    
    return duplicates

def fix_css_file(filepath):
    """Fix a single CSS file by removing true duplicates."""
    print(f"\nProcessing: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_len = len(content)
    blocks = parse_css_blocks(content)
    duplicates = find_true_duplicates(blocks)
    
    if not duplicates:
        print(f"  ✅ No true duplicates found")
        return False
    
    # Sort duplicates by position (descending) to remove from end first
    duplicates.sort(key=lambda x: blocks[x[1]]['start'], reverse=True)
    
    # Remove duplicates
    for original_idx, dup_idx in duplicates:
        dup_block = blocks[dup_idx]
        sel = dup_block['selector'][:40]
        print(f"  🗑️  Removing duplicate: {sel}...")
        
        # Remove from content
        content = content[:dup_block['start']] + content[dup_block['end']:]
    
    # Clean up extra whitespace
    content = re.sub(r'\n\n\n+', '\n\n', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    new_len = len(content)
    saved = original_len - new_len
    print(f"  ✅ Removed {len(duplicates)} duplicate blocks ({saved} bytes saved)")
    return True

# Process all CSS files
css_dir = Path('frontend/src')
css_files = sorted(css_dir.rglob('*.css'))

print(f"Processing {len(css_files)} CSS files...\n")

fixed_count = 0
for css_file in css_files:
    try:
        if fix_css_file(str(css_file)):
            fixed_count += 1
    except Exception as e:
        print(f"  ❌ Error: {e}")

print(f"\n✅ Fixed {fixed_count} files with true duplicates")
