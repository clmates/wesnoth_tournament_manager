#!/usr/bin/env python3
"""
Auto-fix script for removing duplicate CSS selectors and fixing brace mismatches.
"""

import re
import os
from pathlib import Path

def remove_duplicate_selectors(content):
    """Remove duplicate CSS selector blocks."""
    # Split into individual selectors
    lines = content.split('\n')
    seen_blocks = {}
    output = []
    current_block = []
    in_selector = False
    brace_count = 0
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Track braces
        brace_count += line.count('{') - line.count('}')
        
        # Start of a new selector
        if '{' in line and not in_selector:
            in_selector = True
            current_block = [line]
            i += 1
            continue
        
        if in_selector:
            current_block.append(line)
            
            # End of selector block
            if '}' in line and brace_count == 0:
                in_selector = False
                block_text = '\n'.join(current_block).strip()
                
                # Extract selector name
                selector = re.match(r'^([^{]+)', block_text)
                if selector:
                    selector_name = selector.group(1).strip()
                    
                    # Skip if duplicate
                    if selector_name not in seen_blocks:
                        output.extend(current_block)
                        seen_blocks[selector_name] = True
                    else:
                        print(f"  Removing duplicate: {selector_name[:50]}...")
                
                current_block = []
                i += 1
                continue
        else:
            output.append(line)
        
        i += 1
    
    return '\n'.join(output)

def fix_brace_mismatch(content):
    """Remove excess closing braces at end of file."""
    lines = content.rstrip().split('\n')
    
    # Count braces in the entire file
    total_open = content.count('{')
    total_close = content.count('}')
    
    if total_close > total_open:
        excess = total_close - total_open
        # Remove excess closing braces from the end
        while excess > 0 and lines:
            if lines[-1].strip() == '}':
                lines.pop()
                excess -= 1
            else:
                break
    
    return '\n'.join(lines)

def fix_css_file(filepath):
    """Fix a single CSS file."""
    print(f"\nProcessing: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_len = len(content)
    
    # Fix brace mismatches first
    content = fix_brace_mismatch(content)
    
    # Remove duplicates
    content = remove_duplicate_selectors(content)
    
    # Save fixed file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    new_len = len(content)
    if new_len != original_len:
        print(f"  ✅ Fixed (reduced from {original_len} to {new_len} bytes)")
        return True
    return False

# Find and fix all CSS files
css_dir = Path('frontend/src')
css_files = []

for css_file in css_dir.rglob('*.css'):
    css_files.append(css_file)

print(f"Found {len(css_files)} CSS files to process\n")

fixed_count = 0
for css_file in sorted(css_files):
    if fix_css_file(str(css_file)):
        fixed_count += 1

print(f"\n✅ Fixed {fixed_count} files with issues")
