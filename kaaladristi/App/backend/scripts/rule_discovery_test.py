import subprocess, sys

print("Running rule discovery for 2026 only (test mode)...")
result = subprocess.run(
    [sys.executable, 'rule_discovery.py', '2026'],
    capture_output=True, text=True
)
print(result.stdout)
if result.stderr:
    print("ERRORS:", result.stderr)
