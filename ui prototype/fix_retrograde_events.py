import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(script_dir, 'output')

# Load existing data
with open(os.path.join(output_path, 'planetary_positions.json'), 'r') as f:
    positions = json.load(f)

with open(os.path.join(output_path, 'events.json'), 'r') as f:
    events = json.load(f)

# Group positions by date and planet
by_date_planet = {}
for pos in positions:
    key = (pos['date'], pos['planet'])
    by_date_planet[key] = pos

# Get sorted unique dates
dates = sorted(set(pos['date'] for pos in positions))

# Planets that can go retrograde
RETROGRADE_PLANETS = ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']

retrograde_events = []

for i in range(1, len(dates)):
    prev_date = dates[i - 1]
    curr_date = dates[i]
    
    for planet_name in RETROGRADE_PLANETS:
        prev_key = (prev_date, planet_name)
        curr_key = (curr_date, planet_name)
        
        if prev_key not in by_date_planet or curr_key not in by_date_planet:
            continue
        
        prev_retro = by_date_planet[prev_key]['retrograde']
        curr_retro = by_date_planet[curr_key]['retrograde']
        
        # Detect transition
        if prev_retro == False and curr_retro == True:
            retrograde_events.append({
                'event_date': curr_date,
                'event_type': 'retrograde_start',
                'planet': planet_name,
                'from_value': 'direct',
                'to_value': 'retrograde',
                'severity': 'high'
            })
        elif prev_retro == True and curr_retro == False:
            retrograde_events.append({
                'event_date': curr_date,
                'event_type': 'retrograde_end',
                'planet': planet_name,
                'from_value': 'retrograde',
                'to_value': 'direct',
                'severity': 'high'
            })

print(f"Found {len(retrograde_events)} retrograde stations")

# Show breakdown
for planet in RETROGRADE_PLANETS:
    starts = len([e for e in retrograde_events if e['planet'] == planet and e['event_type'] == 'retrograde_start'])
    ends = len([e for e in retrograde_events if e['planet'] == planet and e['event_type'] == 'retrograde_end'])
    print(f"  {planet}: {starts} retrograde starts, {ends} retrograde ends")

# Add to existing events
events.extend(retrograde_events)

# Save updated events
with open(os.path.join(output_path, 'events.json'), 'w') as f:
    json.dump(events, f, indent=2)

print(f"\nUpdated events.json with {len(events)} total events")