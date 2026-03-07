#!/usr/bin/env python3
import os
import re
from pathlib import Path
from collections import defaultdict

def check_css_file(filepath):
    """Comprehensive CSS syntax check"""
    try:
        content = filepath.read_text(errors='ignore')
    except:
        return []
    
    issues = []
    lines = content.split('\n')
    
    # Check 1: Track braces for unclosed issues
    open_braces = 0
    in_comment = False
    
    for i, line in enumerate(lines, 1):
        # Handle multi-line comments
        if '/*' in line:
            in_comment = True
        if '*/' in line:
            in_comment = False
            continue
        
        if in_comment:
            continue
        
        # Remove single-line comments
        working_line = line.split('//')[0]
        
        # Count braces (excluding those in strings, which is a simplification)
        open_count = working_line.count('{')
        close_count = working_line.count('}')
        open_braces += open_count - close_count
        
        stripped = working_line.strip()
        if not stripped:
            continue
        
        # Check 2: Double closing braces }} (malformed)
        if '}}' in working_line:
            issues.append((i, 'ERROR: Double closing braces }}', working_line.strip()[:100]))
        
        # Check 3: Double opening braces {{ (malformed)
        if '{{' in working_line:
            issues.append((i, 'ERROR: Double opening braces {{', working_line.strip()[:100]))
        
        # Check 4: Empty selectors { }
        if re.search(r'{\s*}', working_line) and '@' not in working_line:
            issues.append((i, 'ERROR: Empty selector with no properties', working_line.strip()[:100]))
        
        # Check 5: Malformed @media queries
        if '@media' in working_line and '{' in working_line and '}' in working_line:
            # Complete media query on one line - check if valid
            if not re.match(r'@media\s*\([^)]*\)\s*\{', working_line):
                issues.append((i, 'WARNING: Potentially malformed @media query', working_line.strip()[:100]))
        
        # Check 6: Properties without selector
        if ':' in working_line and not any(x in working_line for x in ['{', '}', '@', '*', '.']):
            # Could be a stray property
            if stripped.endswith(';') and not stripped.startswith('.') and open_braces == 0:
                issues.append((i, 'WARNING: Property without selector', working_line.strip()[:100]))
    
    # Check 7: Unclosed braces
    if open_braces > 0:
        issues.append((len(lines), 'ERROR: Unclosed braces - missing } (count: %d)' % open_braces, ''))
    elif open_braces < 0:
        issues.append((len(lines), 'ERROR: Extra closing braces - too many } (count: %d)' % abs(open_braces), ''))
    
    # Check 8: Find duplicate selectors
    selectors = defaultdict(list)
    current_selector = None
    
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if '{' in stripped and not '@' in stripped and not '//' in stripped:
            # Extract selector
            parts = stripped.split('{')
            if parts[0].strip():
                selector = parts[0].strip()
                if selector not in ['.', '', '@media']:
                    selectors[selector].append(i)
    
    for selector, line_numbers in selectors.items():
        if len(line_numbers) > 1:
            issues.append((line_numbers[0], 'WARNING: Duplicate selector (appears %d times at lines: %s)' % 
                          (len(line_numbers), ', '.join(map(str, line_numbers))), selector[:80]))
    
    return issues

# Main execution
css_files = list(Path('frontend/src').rglob('*.css'))
all_issues = {}

print("=" * 80)
print("COMPREHENSIVE CSS SYNTAX ANALYSIS")
print("=" * 80 + "\n")

for css_file in sorted(css_files):
    issues = check_css_file(css_file)
    if issues:
        all_issues[css_file] = issues

if all_issues:
    print(f"Found issues in {len(all_issues)} file(s):\n")
    for css_file, issues in sorted(all_issues.items()):
        print(f"\nFILE: {css_file.relative_to('.')}")
        print("-" * 80)
        for line_num, issue_type, content in issues:
            print(f"LINES: {line_num}")
            print(f"ISSUE: {issue_type}")
            if content:
                print(f"       {content}\n")
else:
    print(f"✓ SUCCESS: No CSS syntax errors found in {len(css_files)} CSS files\n")
    print("Summary:")
    print(f"  - Total CSS files checked: {len(css_files)}")
    print(f"  - Unclosed/extra braces: 0")
    print(f"  - Malformed selectors: 0")
    print(f"  - Double braces: 0")
    print(f"  - Duplicate selectors: 0 (or intentional overrides)")
    print(f"  - Malformed @media queries: 0\n")

print("=" * 80)
