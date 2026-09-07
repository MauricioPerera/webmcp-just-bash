#!/usr/bin/env python3
"""
validate_specs.py - Validates project specifications in specs/
"""

import sys
import os

REQUIRED_SPEC_FIELDS = {'title', 'status', 'version', 'date', 'tags'}

def parse_frontmatter(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if not content.startswith('---'):
        return None, "Missing YAML frontmatter"
    parts = content.split('---', 2)
    if len(parts) < 3:
        return None, "Malformed frontmatter"
    data = {}
    for line in parts[1].splitlines():
        line = line.strip()
        if ':' in line and not line.startswith('#'):
            k, v = line.split(':', 1)
            data[k.strip()] = v.strip().strip("'\"")
    return data, None

def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else 'specs'
    print(f"Validating specifications in '{target_dir}'...")
    errors = []
    
    for file in os.listdir(target_dir):
        if file.endswith('.md'):
            path = os.path.join(target_dir, file)
            fm, err = parse_frontmatter(path)
            if err:
                errors.append(f"{path}: {err}")
                print(f"  [FAIL] {file}: {err}")
                continue
            missing = [k for k in REQUIRED_SPEC_FIELDS if k not in fm]
            if missing:
                errors.append(f"{path}: Missing keys {missing}")
                print(f"  [FAIL] {file}: Missing {missing}")
            else:
                print(f"  [PASS] {file}")
                
    if errors:
        print(f"\nSpec validation failed with {len(errors)} error(s).")
        sys.exit(1)
    else:
        print("\nAll specifications passed validation!")
        sys.exit(0)

if __name__ == '__main__':
    main()
