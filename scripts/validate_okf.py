#!/usr/bin/env python3
"""
validate_okf.py - Validates OKF knowledge nodes frontmatter and link integrity.
"""

import sys
import os

REQUIRED_OKF_FIELDS = {'type', 'title', 'description', 'tags'}

def parse_frontmatter(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if not content.startswith('---'):
        return None, "Missing YAML frontmatter '---'"
    parts = content.split('---', 2)
    if len(parts) < 3:
        return None, "Malformed frontmatter delimiters"
    
    data = {}
    for line in parts[1].splitlines():
        line = line.strip()
        if ':' in line and not line.startswith('#'):
            k, v = line.split(':', 1)
            data[k.strip()] = v.strip().strip("'\"")
    return data, None

def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else 'knowledge'
    print(f"Validating OKF knowledge nodes in '{target_dir}'...")
    errors = []
    
    for root, _, files in os.walk(target_dir):
        if 'contracts' in root:
            continue # Contracts validated separately
        for file in files:
            if file.endswith('.md'):
                path = os.path.join(root, file)
                fm, err = parse_frontmatter(path)
                if err:
                    errors.append(f"{path}: {err}")
                    print(f"  [FAIL] {file}: {err}")
                    continue
                missing = [k for k in REQUIRED_OKF_FIELDS if k not in fm]
                if missing:
                    errors.append(f"{path}: Missing keys {missing}")
                    print(f"  [FAIL] {file}: Missing {missing}")
                else:
                    print(f"  [PASS] {file}")
                    
    if errors:
        print(f"\nOKF validation failed with {len(errors)} error(s).")
        sys.exit(1)
    else:
        print("\nAll OKF knowledge nodes are valid!")
        sys.exit(0)

if __name__ == '__main__':
    main()
