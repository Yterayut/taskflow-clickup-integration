#!/usr/bin/env python3

# Read the original backend file
with open('/Users/teerayutyeerahem/team-workload/single_login_backend.js', 'w') as f:
    # This will be downloaded from server and modified
    pass

import subprocess
import tempfile

# Download current backend
result = subprocess.run([
    'ssh', 'one-climate@192.168.20.10', 
    'cd /home/one-climate/team-workload && cat single_login_backend.js'
], capture_output=True, text=True)

backend_content = result.stdout

# Read auth verify endpoint
with open('/Users/teerayutyeerahem/team-workload/auth_verify_endpoint.txt', 'r') as f:
    auth_verify_code = f.read()

# Split backend into lines
lines = backend_content.split('\n')

# Find the insertion point (after line with "});") around line 852
insert_line = -1
for i, line in enumerate(lines):
    if i > 840 and i < 860 and line.strip() == '});':
        # Check if next non-empty line starts with "// Component Data APIs"
        for j in range(i+1, min(i+10, len(lines))):
            if lines[j].strip():
                if 'Component Data APIs' in lines[j]:
                    insert_line = i
                    break
                break
        if insert_line != -1:
            break

if insert_line == -1:
    print("Could not find insertion point")
    exit(1)

print(f"Inserting auth verify endpoint after line {insert_line+1}")

# Insert the auth verify code
new_lines = lines[:insert_line+1] + [''] + auth_verify_code.split('\n') + [''] + lines[insert_line+1:]

# Write modified content
modified_content = '\n'.join(new_lines)

with open('/Users/teerayutyeerahem/team-workload/single_login_backend_modified.js', 'w') as f:
    f.write(modified_content)

print("Modified backend saved to single_login_backend_modified.js")