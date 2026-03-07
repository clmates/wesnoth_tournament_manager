#!/usr/bin/env python3
import os
import re
from pathlib import Path

def check_css_file(filepath):
    """Check a CSS file for syntax errors"""
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    errors = []
    lines = content.split('\n')
    
    # Count braces
    open_braces = content.count('{')
    close_braces = content.count('}')
    
    if open_braces != close_braces:
        errors.append(f"Brace mismatch: {open_braces} opening, {close_braces} closing")
    
    # Check for duplicate selectors
    selectors = re.findall(r'^[^{]*(?={)', content, re.MULTILINE)
    selector_dict = {}
    for selector in selectors:
        selector = selector.strip()
        if selector in selector_dict:
            selector_dict[selector] += 1
        else:
            selector_dict[selector] = 1
    
    for selector, count in selector_dict.items():
        if count > 1 and selector:  # Multiple definitions of same selector
            errors.append(f"Duplicate selector: '{selector}' appears {count} times")
    
    # Check for unclosed blocks
    in_rule = False
    brace_level = 0
    for i, line in enumerate(lines, 1):
        brace_level += line.count('{') - line.count('}')
        if brace_level < 0:
            errors.append(f"Line {i}: More closing braces than opening")
            brace_level = 0
    
    # Check for common issues
    if '}}' in content:
        errors.append("Found '}}' - possible extra closing brace")
    
    if '{  ' in content or '{   ' in content:
        errors.append("Empty or malformed CSS rule")
    
    return errors

# Check all CSS files
css_dir = Path('frontend/src')
css_files = list(css_dir.glob('**/*.css'))

print(f"Checking {len(css_files)} CSS files...\n")

all_errors = {}
for css_file in sorted(css_files):
    errors = check_css_file(str(css_file))
    if errors:
        all_errors[str(css_file)] = errors
        print(f"❌ {css_file}")
        for error in errors:
            print(f"   - {error}")
    else:
        print(f"✅ {css_file}")

if all_errors:
    print(f"\n⚠️  Found {sum(len(e) for e in all_errors.values())} total CSS errors")
else:
    print("\n✅ No CSS syntax errors found!")
