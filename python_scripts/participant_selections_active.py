import json
import os
from datetime import datetime

# --- Configuration ---
DATA_DIR = 'data'
STAGE_RESULTS_DIR = os.path.join(DATA_DIR, 'stage_results')
INITIAL_TEAMS_FILE = os.path.join(DATA_DIR, 'participant_selections_anon.json')
OUTPUT_FILE = os.path.join(DATA_DIR, 'team_selections_active.json')

def load_initial_selections():
    """Load and preprocess initial participant selections."""
    try:
        with open(INITIAL_TEAMS_FILE, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
        
        participants = []
        for participant in raw_data:
            processed = {
                'name': participant.get('name'),
                'directie': participant.get('directie', 'Unknown'),
                'active_riders': participant.get('main_riders', []).copy(),
                'reserve_rider': participant.get('reserve_rider', None), 
                'has_substituted': False,
                'substitution': None 
            }
            participants.append(processed)
        
        return participants
    
    except FileNotFoundError:
        print(f"❌ Error: Initial selections file '{INITIAL_TEAMS_FILE}' not found.")
        return None
    except json.JSONDecodeError as e:
        print(f"❌ Error: Could not decode JSON from '{INITIAL_TEAMS_FILE}'")
        print(f"   {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error loading initial selections: {e}")
        return None

def load_stage_results(stage_num):
    """Load stage results, return None if not found."""
    stage_filepath = os.path.join(STAGE_RESULTS_DIR, f'stage_{stage_num}.json')
    try:
        with open(stage_filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as e:
        print(f"⚠️  Warning: Could not decode stage {stage_num} results: {e}")
        return None
    except Exception as e:
        print(f"⚠️  Warning: Error loading stage {stage_num}: {e}")
        return None

def process_stage_substitutions(participants, stage_num, dnf_riders):
    """
    Process substitutions for a single stage.
    Returns updated participants and a summary of changes.
    """
    stage_changes = {
        'stage': stage_num,
        'dnf_riders': sorted(list(dnf_riders)),
        'participants_affected': []
    }
    
    for participant in participants:
        participant_name = participant['name']
        active_riders = participant['active_riders']
        reserve_rider = participant['reserve_rider']
        
        # Find which active riders DNF'd
        dnf_from_team = [rider for rider in active_riders if rider in dnf_riders]
        
        if not dnf_from_team:
            continue
        
        participant_change = {
            'name': participant_name,
            'riders_lost': dnf_from_team,
            'substitution_made': None
        }
        
        # Remove DNF riders
        for dnf_rider in dnf_from_team:
            active_riders.remove(dnf_rider)
        
        # Attempt substitution for the first lost rider (if reserve available and not already used)
        if dnf_from_team and reserve_rider and not participant['has_substituted']:
            replacement = reserve_rider
            active_riders.append(replacement)
            
            # Mark substitution as made
            participant['has_substituted'] = True
            participant['substitution'] = {
                'stage': stage_num,
                'out_rider': dnf_from_team[0],
                'in_rider': replacement
            }
            participant['reserve_rider'] = None  # Reserve is now used
            
            participant_change['substitution_made'] = {
                'out': dnf_from_team[0],
                'in': replacement
            }
        
        stage_changes['participants_affected'].append(participant_change)
    
    return participants, stage_changes

def generate_stage_snapshot(participants, stage_num):
    """Generate a snapshot of all team selections at a specific stage."""
    return {
        'stage': stage_num,
        'participants': [
            {
                'name': p['name'],
                'directie': p.get('directie', 'Unknown'),
                'active_riders': p['active_riders'].copy(),
                'reserve_rider': p['reserve_rider'],
                'team_size': len(p['active_riders']),
                'has_substituted': p['has_substituted']
            }
            for p in participants
        ]
    }

def manage_rosters(up_to_stage_number):
    """
    Main function to manage team selections across all stages.
    Creates a single JSON file with complete tracking information.
    """
    # Ensure directories exist
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"Processing team selection changes up to stage {up_to_stage_number}\n")
    
    # Load initial data
    participants = load_initial_selections()
    if participants is None:
        return
    
    print(f"✓ Loaded {len(participants)} participants")
    
    # Initialize output structure
    output_data = {
        'metadata': {
            'last_updated': datetime.now().isoformat(),
            'stages_processed': 0,
            'participants_with_substitutions': 0
        },
        'team_selections_per_stage': [],
        'stage_changes': [],
        'participants_summary': []
    }
    
    # Add initial state (before any stages)
    output_data['team_selections_per_stage'].append(generate_stage_snapshot(participants, 0))
    
    # Process each stage
    for stage_num in range(1, up_to_stage_number + 1):
        print(f"\n--- Stage {stage_num} ---")
        
        stage_data = load_stage_results(stage_num)
        
        if stage_data is None:
            print(f"⚠️  No results file found for stage {stage_num}, stopping here.")
            break
        
        dnf_riders = set(stage_data.get('dnf_riders', []))
        
        if dnf_riders:
            print(f"  Riders out: {len(dnf_riders)} ({', '.join(sorted(dnf_riders))})")
        else:
            print(f"  No riders out this stage")
        
        # Process substitutions
        participants, stage_summary = process_stage_substitutions(
            participants, stage_num, dnf_riders
        )
        
        # Report changes
        if stage_summary['participants_affected']:
            print(f"  Participants affected: {len(stage_summary['participants_affected'])}")

        # Store summary and snapshot
        output_data['stage_changes'].append(stage_summary)
        output_data['team_selections_per_stage'].append(generate_stage_snapshot(participants, stage_num))
        output_data['metadata']['stages_processed'] = stage_num
    
    # Add detailed participant information
    for participant in participants:
        output_data['participants_summary'].append({
            'name': participant['name'],
            'current_active_riders': participant['active_riders'],
            'current_reserve_rider': participant['reserve_rider'],
            'current_team_size': len(participant['active_riders']),
            'has_substituted': participant['has_substituted'],
            'substitution': participant['substitution']
        })
    
    # Count participants with substitutions
    output_data['metadata']['participants_with_substitutions'] = sum(
        1 for p in participants if p['has_substituted']
    )
    
    # Save to single output file
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n{'='*50}")
        print(f"✓ Team selection tracking saved to: {OUTPUT_FILE}")
        print(f"\nSummary:")
        print(f"  - Stages processed: {output_data['metadata']['stages_processed']}")
        print(f"  - Participants who made substitutions: {output_data['metadata']['participants_with_substitutions']}")
        
        # Show current team sizes
        team_sizes = {}
        for p in output_data['participants_summary']:
            size = p['current_team_size']
            team_sizes[size] = team_sizes.get(size, 0) + 1
        
        print(f"\nCurrent team sizes:")
        for size in sorted(team_sizes.keys(), reverse=True):
            print(f"  - {size} riders: {team_sizes[size]} participants")
        
    except Exception as e:
        print(f"❌ Error saving output file: {e}")

if __name__ == "__main__":
    # Set to the latest stage number available
    LATEST_STAGE = 12
    manage_rosters(LATEST_STAGE)