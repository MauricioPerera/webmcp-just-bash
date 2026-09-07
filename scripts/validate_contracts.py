#!/usr/bin/env python3
"""
validate_contracts.py - KDD / CCDD Task Contract Deterministic Validator
Validates frontmatter, mandatory OKF+CCDD fields, and frozen test oracle SHA-256 hashes.
"""

import sys
import os
import hashlib
import re

REQUIRED_OKF_KEYS = {'type', 'title', 'description', 'tags'}
REQUIRED_CCDD_KEYS = {'task', 'intent', 'target', 'signature', 'test_command', 'budget', 'tests', 'touch_only', 'tests_sha256'}

def parse_yaml_frontmatter(content):
    if not content.startswith('---'):
        return None, "Document does not start with YAML frontmatter '---'"
    
    parts = content.split('---', 2)
    if len(parts) < 3:
        return None, "Malformed frontmatter delimiters"
    
    fm_raw = parts[1]
    data = {}
    
    # Simple zero-dependency YAML parser for key-values, lists, and dicts
    lines = fm_raw.splitlines()
    current_key = None
    
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
            
        if ':' in line and not stripped.startswith('-'):
            k, v = line.split(':', 1)
            k = k.strip()
            v = v.strip()
            current_key = k
            if v == '' or v == '{':
                data[k] = {}
            elif v.startswith('[') and v.endswith(']'):
                # inline list: ['a', 'b']
                items = [item.strip().strip("'\"") for item in v[1:-1].split(',') if item.strip()]
                data[k] = items
            else:
                data[k] = v.strip("'\"")
        elif stripped.startswith('-') and current_key:
            val = stripped[1:].strip().strip("'\"")
            if not isinstance(data[current_key], list):
                data[current_key] = []
            data[current_key].append(val)
        elif current_key and isinstance(data.get(current_key), dict) and ':' in stripped:
            subk, subv = stripped.split(':', 1)
            data[current_key][subk.strip()] = subv.strip().strip("'\"")
            
    return data, None

def calculate_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def validate_contract_file(filepath):
    errors = []
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    fm, err = parse_yaml_frontmatter(content)
    if err:
        return [f"{filepath}: {err}"]
        
    # Check OKF Keys
    for k in REQUIRED_OKF_KEYS:
        if k not in fm:
            errors.append(f"{filepath}: Missing mandatory OKF key '{k}'")
            
    if fm.get('type') != 'Task Contract':
        errors.append(f"{filepath}: 'type' must be 'Task Contract', got '{fm.get('type')}'")
        
    # Check CCDD Keys
    for k in REQUIRED_CCDD_KEYS:
        if k not in fm:
            errors.append(f"{filepath}: Missing mandatory CCDD key '{k}'")
            
    # Check frozen tests hash
    tests_file = fm.get('tests')
    expected_hash = fm.get('tests_sha256')
    
    if tests_file and expected_hash:
        # Find project root by searching upwards for package.json or tests dir
        curr = os.path.dirname(os.path.abspath(filepath))
        project_root = curr
        for _ in range(5):
            if os.path.exists(os.path.join(curr, 'tests')) or os.path.exists(os.path.join(curr, 'package.json')):
                project_root = curr
                break
            parent = os.path.dirname(curr)
            if parent == curr:
                break
            curr = parent
        full_test_path = os.path.normpath(os.path.join(project_root, tests_file))
        
        if not os.path.exists(full_test_path):
            errors.append(f"{filepath}: Test oracle '{tests_file}' does not exist at {full_test_path}")
        else:
            actual_hash = calculate_sha256(full_test_path)
            if actual_hash.lower() != expected_hash.lower():
                errors.append(
                    f"{filepath}: tests_sha256 mismatch for '{tests_file}'. "
                    f"Expected {expected_hash}, got {actual_hash}"
                )
                
    return errors

def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else 'knowledge/contracts'
    if not os.path.exists(target_dir):
        print(f"[Error] Directory not found: {target_dir}")
        sys.exit(1)
        
    contract_files = [
        os.path.join(target_dir, f) for f in os.listdir(target_dir)
        if f.endswith('.md') and not f.startswith('.')
    ]
    
    if not contract_files:
        print(f"[Warning] No markdown contract files found in {target_dir}")
        sys.exit(0)
        
    total_errors = []
    print(f"Validating {len(contract_files)} CCDD task contracts in '{target_dir}'...")
    
    for f in sorted(contract_files):
        errs = validate_contract_file(f)
        if errs:
            total_errors.extend(errs)
            print(f"  [FAIL] {os.path.basename(f)}")
            for e in errs:
                print(f"         - {e}")
        else:
            print(f"  [PASS] {os.path.basename(f)}")
            
    if total_errors:
        print(f"\nValidation failed with {len(total_errors)} error(s).")
        sys.exit(1)
    else:
        print("\nAll CCDD task contracts passed Level-1 deterministic validation successfully!")
        sys.exit(0)

if __name__ == '__main__':
    main()
