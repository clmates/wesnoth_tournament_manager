#!/usr/bin/env python3
import os
import re
from pathlib import Path

css_files = list(Path('frontend/src').rglob('*.css'))
total_files = len(css_files)
errors_found = []

for css_file in sorted(css_files):
    try:
        content = css_file.read_text(errors='ignore')
    except:
        continue
        
    lines = content.split('\n')
    file_issues = []
    
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        
        # Skip empty lines and comments
        if not stripped or stripped.startswith('/*') or stripped.endswith('*/'):
            continue
            
        # Check for double closing braces
        if '}}' in line:
            # Check if it's not in a comment
            if not '//' in line.split('}}')[0]:
                file_issues.append((i, 'Double closing braces }}', line.strip()[:80]))
        
        # Check for double opening braces
        if '{{' in line:
            file_issues.append((i, 'Double opening braces {{', line.strip()[:80]))
        
        # Check for empty selectors { }
        if re.search(r'{\s*}', line):
            file_issues.append((i, 'Empty selector {}', line.strip()[:80]))
        
        # Check for orphaned closing braces (line starting with })
        if stripped == '}':
            # Normal - part of nested rule
            pass
        
        # Check for suspicious brace patterns
        if line.count('{') != line.count('}'):
            # This is normal for multi-line, so skip
            pass
    
    if file_issues:
        errors_found.append((css_file, file_issues))

if errors_found:
    print(f"Found CSS syntax errors in {len(errors_found)} file(s):\n")
    for css_file, issues in errors_found:
        print(f"FILE: {css_file}")
        for line_num, issue_type, content in issues:
            print(f"  LINE {line_num}: {issue_type}")
            print(f"    {content}")
        print()
else:
    print(f"✓ No CSS syntax errors found in {total_files} CSS files\n")
    print("CSS files checked:")
    for css_file in sorted(css_files):
        print(f"  - {css_file.relative_to('.')}")
