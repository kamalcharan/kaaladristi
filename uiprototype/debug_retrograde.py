import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(script_dir, 'output')

# Load positions
with open(os.path.join(output_path, 'planetary_positions.json'), 'r') as f:
    positions = json.load(f)

# Check Mars retrograde data
mars_positions = [p for p in positions if p['planet'] == 'Mars']

print("=== MARS RETROGRADE DEBUG ===\n")

# Check data type
sample = mars_positions[0]
print(f"Sample record: {sample['date']}")
print(f"  retrograde value: {sample['retrograde']}")
print(f"  retrograde type: {type(sample['retrograde'])}")
print(f"  speed value: {sample['speed']}")

# Count retrogrades
retro_true = [p for p in mars_positions if p['retrograde'] == True]
retro_false = [p for p in mars_positions if p['retrograde'] == False]
retro_string_true = [p for p in mars_positions if p['retrograde'] == 'True']
retro_string_false = [p for p in mars_positions if p['retrograde'] == 'False']

print(f"\n  retrograde == True: {len(retro_true)}")
print(f"  retrograde == False: {len(retro_false)}")
print(f"  retrograde == 'True' (string): {len(retro_string_true)}")
print(f"  retrograde == 'False' (string): {len(retro_string_false)}")

# Find actual retrograde periods (negative speed)
negative_speed = [p for p in mars_positions if p['speed'] < 0]
print(f"\n  Days with negative speed: {len(negative_speed)}")

# Show some retrograde days
print(f"\n=== SAMPLE MARS RETROGRADE DAYS ===")
for p in negative_speed[:5]:
    print(f"  {p['date']}: speed={p['speed']:.4f}, retrograde={p['retrograde']}")

# Show transitions
print(f"\n=== CHECKING TRANSITIONS ===")
dates = sorted(set(p['date'] for p in mars_positions))
transitions = []

for i in range(1, min(len(dates), 1000)):  # Check first 1000 days
    prev_date = dates[i-1]
    curr_date = dates[i]
    
    prev_pos = next(p for p in mars_positions if p['date'] == prev_date)
    curr_pos = next(p for p in mars_positions if p['date'] == curr_date)
    
    prev_retro = prev_pos['speed'] < 0  # Use speed directly
    curr_retro = curr_pos['speed'] < 0
    
    if prev_retro != curr_retro:
        direction = "DIRECT → RETRO" if curr_retro else "RETRO → DIRECT"
        transitions.append({
            'date': curr_date,
            'direction': direction,
            'prev_speed': prev_pos['speed'],
            'curr_speed': curr_pos['speed']
        })

print(f"  Found {len(transitions)} transitions in first 1000 days")
for t in transitions[:5]:
    print(f"    {t['date']}: {t['direction']} (speed: {t['prev_speed']:.4f} → {t['curr_speed']:.4f})")