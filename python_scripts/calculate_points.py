import os
import json
import re
from collections import defaultdict
from datetime import datetime
import shutil

# --- Constants ---
TDF_YEAR = 2025

# Directory structure
DATA_DIR = 'data'
STAGE_DATA_DIR = os.path.join(DATA_DIR, 'stage_results')
CALC_POINTS_DIR = os.path.join(DATA_DIR, 'points')

WEB_OUTPUT_DIR = 'docs'
WEB_DATA_DIR = os.path.join(WEB_OUTPUT_DIR, 'data')

# Output file paths
RIDER_CUMULATIVE_POINTS_FILE = os.path.join(CALC_POINTS_DIR, 'rider_cumulative_points.json')
PARTICIPANT_CUMULATIVE_POINTS_FILE = os.path.join(CALC_POINTS_DIR, 'participant_cumulative_points.json')

RIDER_STAGE_POINTS_HISTORY_FILE = os.path.join(CALC_POINTS_DIR, 'rider_stage_points.json')
PARTICIPANT_STAGE_POINTS_HISTORY_FILE = os.path.join(CALC_POINTS_DIR, 'participant_stage_points.json')

# Input file path
PARTICIPANT_SELECTIONS_FILE = os.path.join(DATA_DIR, 'participant_selections_anon.json')


# --- Helper Functions ---
def load_json_data(filepath, default_value=None):
    # This function needs to be aware if it's loading a list or a dict
    # For PARTICIPANT_SELECTIONS_FILE, the default should now be an empty list
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return default_value

def save_json_data(data, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def clear_json_file(filepath, default_value_type=dict):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        if default_value_type == dict:
            json.dump({}, f)
        else: # For lists
            json.dump([], f)

# Load scraped stage data
def load_scraped_stage_data(stage_number, STAGE_DATA_DIR):
    filepath = os.path.join(STAGE_DATA_DIR, f'stage_{stage_number}.json')
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Scraped data for Stage {stage_number} not found at: {filepath}.")
    return load_json_data(filepath)

# Find available scraped stages
def find_available_scraped_stages(STAGE_DATA_DIR):
    stage_numbers = []
    if os.path.exists(STAGE_DATA_DIR):
        for filename in os.listdir(STAGE_DATA_DIR):
            match = re.match(r'stage_(\d+)\.json', filename)
            if match:
                stage_numbers.append(int(match.group(1)))
    return sorted(set(stage_numbers))

# --- Calculate points per rider based on stage results ---
SCORING_RULES = {
    "yellow_jersey": 10,
    "green_jersey": 5,
    "polka_dot_jersey": 5,
    "white_jersey": 5,
    "combative_rider": 5,
    "team_stage": 6,
}

def _get_stage_points_for_rank(rank):
    if 1 <= rank <= 20:
        return 25 if rank == 1 else (20 - (rank - 1))
    return 0

def calculate_rider_stage_points_breakdown(stage_results, jersey_holders, scoring_rules):
    rider_stage_data = defaultdict(lambda: {
        "stage_finish_points": 0,
        "jersey_points": {},
        "stage_total": 0
    })

    # Calculate stage finish points
    for row in stage_results:
        rider = row['rider_name']
        rank = row['rank']
        points = _get_stage_points_for_rank(rank)
        rider_stage_data[rider]["stage_finish_points"] += points
        rider_stage_data[rider]["stage_total"] += points

    # Add points for jerseys. If a rider holds multiple jerseys, they will accumulate.
    for jersey_type, holder_name in jersey_holders.items():
        points_key = f"{jersey_type}_jersey" if jersey_type != "combative_rider" else jersey_type
        points = scoring_rules.get(points_key, 0)
        if points > 0 and holder_name and holder_name != "N/A":
            rider_stage_data[holder_name]["jersey_points"][str(jersey_type)] = \
                rider_stage_data[holder_name]["jersey_points"].get(str(jersey_type), 0) + points
            rider_stage_data[holder_name]["stage_total"] += points
            
    return dict(rider_stage_data)


# --- Calculate cumulative points for each rider for all stages ---
def update_detailed_rider_history(current_stage_num, current_date, rider_stage_data, detailed_rider_history_file):
    detailed_history = load_json_data(detailed_rider_history_file, default_value={})
    cumulative_rider_points = load_json_data(RIDER_CUMULATIVE_POINTS_FILE, default_value={})

    for rider_name, stage_data in rider_stage_data.items():
        if rider_name not in detailed_history:
            detailed_history[rider_name] = {}
        
        # Ensure rider exists in cumulative points
        if rider_name not in cumulative_rider_points:
            cumulative_rider_points[rider_name] = 0

        # Update cumulative points for the rider
        cumulative_rider_points[rider_name] += stage_data["stage_total"]

        # Data added to json file
        detailed_history[rider_name][f"stage_{current_stage_num}"] = {
            "date": current_date,
            "stage_finish_points": stage_data["stage_finish_points"],
            "jersey_points": stage_data["jersey_points"],
            "stage_total": stage_data["stage_total"],
            "cumulative_total_after_stage": cumulative_rider_points[rider_name]
        }
    
    # Also update riders who scored 0 for the stage (or haven't appeared yet) to ensure they show up with 0 daily and their existing cumulative
    all_riders_in_history = set(detailed_history.keys()) | set(cumulative_rider_points.keys())
    for rider_name in all_riders_in_history:
        if f"stage_{current_stage_num}" not in detailed_history.get(rider_name, {}):
            if rider_name not in detailed_history:
                detailed_history[rider_name] = {} # Initialize if new rider from cumulative
            
            # Ensure cumulative_rider_points is up-to-date for this rider
            current_cumulative = cumulative_rider_points.get(rider_name, 0)
            
            # Add entry for this stage with zero points
            detailed_history[rider_name][f"stage_{current_stage_num}"] = {
                "date": current_date,
                "stage_finish_points": 0,
                "jersey_points": {},
                "stage_total": 0,
                "cumulative_total_after_stage": current_cumulative
            }


    save_json_data(detailed_history, detailed_rider_history_file)
    save_json_data(cumulative_rider_points, RIDER_CUMULATIVE_POINTS_FILE)
    return detailed_history, cumulative_rider_points


# --- Calculate cumulative points for each participant ---
def calculate_participant_scores_and_contributions(participant_selections_list, detailed_rider_history, current_stage_num, previous_cumulative_leaderboard=None):
    participant_stage_scores = defaultdict(int)
    participant_cumulative_scores = defaultdict(int)
    participant_rider_contributions = defaultdict(dict)

    # Load previous cumulative scores to build current cumulative correctly
    previous_scores_map = {entry['participant_name']: entry['total_score'] for entry in previous_cumulative_leaderboard or []}

    # Iterate through the list of participant dictionaries
    for selection_entry in participant_selections_list:
        participant_name = selection_entry.get("name") # Get the participant's name from the 'name' field
        selected_riders = selection_entry.get("main_riders", [])

        if not participant_name:
            print(f"Warning: Participant entry missing 'name' field. Skipping entry: {selection_entry}")
            continue

        current_stage_contribution_total = 0
        current_stage_rider_contributions = {}

        for rider in selected_riders:
            rider_stage_data = detailed_rider_history.get(rider, {}).get(f"stage_{current_stage_num}", {})
            rider_stage_total = rider_stage_data.get("stage_total", 0)
            
            current_stage_contribution_total += rider_stage_total
            current_stage_rider_contributions[rider] = rider_stage_total
            
        participant_stage_scores[participant_name] = current_stage_contribution_total
        participant_rider_contributions[participant_name] = current_stage_rider_contributions

        # Calculate cumulative score
        # Previous cumulative score + current stage score
        participant_cumulative_scores[participant_name] = previous_scores_map.get(participant_name, 0) + current_stage_contribution_total
        

    # Create leaderboard for the current cumulative state
    leaderboard = [
        {"participant_name": name, "total_score": score}
        for name, score in participant_cumulative_scores.items()
    ]
    leaderboard_sorted = sorted(leaderboard, key=lambda x: x['total_score'], reverse=True)

    # Calculate rank change
    previous_ranks = {entry['participant_name']: entry['rank'] for entry in previous_cumulative_leaderboard or []}
    for i, entry in enumerate(leaderboard_sorted):
        entry['rank'] = i + 1
        prev_rank = previous_ranks.get(entry['participant_name'])
        entry['rank_change'] = (prev_rank - entry['rank']) if prev_rank is not None else None
    
    return leaderboard_sorted, dict(participant_stage_scores), dict(participant_rider_contributions)


def update_detailed_participant_history(current_stage_num, current_date, participant_stage_scores, participant_rider_contributions, participant_cumulative_leaderboard, detailed_participant_history_file):
    detailed_history = load_json_data(detailed_participant_history_file, default_value={})

    for participant_name, stage_score in participant_stage_scores.items():
        if participant_name not in detailed_history:
            detailed_history[participant_name] = {}
        
        # Find the cumulative score for this participant from the current leaderboard
        cumulative_score_after_stage = 0
        for entry in participant_cumulative_leaderboard:
            if entry['participant_name'] == participant_name:
                cumulative_score_after_stage = entry['total_score']
                break

        detailed_history[participant_name][f"stage_{current_stage_num}"] = {
            "date": current_date,
            "stage_participant_score": stage_score, # Renamed from daily_participant_score
            "cumulative_participant_score_after_stage": cumulative_score_after_stage,
            "rider_contributions": participant_rider_contributions.get(participant_name, {})
        }
    
    # Ensure all participants have an entry for the current stage, even if they scored 0
    all_participants = set(detailed_history.keys()) | set(participant_stage_scores.keys())
    for participant_name in all_participants:
        if f"stage_{current_stage_num}" not in detailed_history.get(participant_name, {}):
            if participant_name not in detailed_history:
                detailed_history[participant_name] = {}
            
            # Find the cumulative score for this participant from the current leaderboard
            cumulative_score_after_stage = 0
            for entry in participant_cumulative_leaderboard:
                if entry['participant_name'] == participant_name:
                    cumulative_score_after_stage = entry['total_score']
                    break
            
            detailed_history[participant_name][f"stage_{current_stage_num}"] = {
                "date": current_date,
                "stage_participant_score": 0,
                "cumulative_participant_score_after_stage": cumulative_score_after_stage,
                "rider_contributions": {}
            }

    save_json_data(detailed_history, detailed_participant_history_file)
    return detailed_history


# --- Main Execution ---
if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(WEB_DATA_DIR, exist_ok=True)

    print("--- Starting Full Points Recalculation for All Available Stages ---")

    # Clear all relevant data files
    clear_json_file(RIDER_CUMULATIVE_POINTS_FILE, dict)
    clear_json_file(PARTICIPANT_CUMULATIVE_POINTS_FILE, list)
    clear_json_file(RIDER_STAGE_POINTS_HISTORY_FILE, dict) # New detailed rider history
    clear_json_file(PARTICIPANT_STAGE_POINTS_HISTORY_FILE, dict) # New detailed participant history
    
    print("Previous data cleared.")

    try:
        # !!! CHANGE HERE !!! Load as a list by setting default_value to []
        PARTICIPANT_SELECTIONS = load_json_data(PARTICIPANT_SELECTIONS_FILE, default_value=[])
        if not PARTICIPANT_SELECTIONS:
            print(f"Error: {PARTICIPANT_SELECTIONS_FILE} is empty or invalid. Please ensure participant selections are set up.")
            exit()
        print(f"Loaded {len(PARTICIPANT_SELECTIONS)} participant selections.")
    except FileNotFoundError:
        print(f"Error: {PARTICIPANT_SELECTIONS_FILE} not found. Please ensure participant selections are set up.")
        exit()

    # Changed to find available scraped stages directly in STAGE_DATA_DIR
    available_stage_numbers = find_available_scraped_stages(STAGE_DATA_DIR)
    if not available_stage_numbers:
        print(f"No scraped stage data found in {STAGE_DATA_DIR}. Please run the scraping script first.")
        exit()
    print(f"Found {len(available_stage_numbers)} scraped stages: {available_stage_numbers}")

    # Initialize history structures (loaded and updated iteratively)
    detailed_rider_history_in_memory = load_json_data(RIDER_STAGE_POINTS_HISTORY_FILE, default_value={})
    detailed_participant_history_in_memory = load_json_data(PARTICIPANT_STAGE_POINTS_HISTORY_FILE, default_value={})
    previous_cumulative_leaderboard = load_json_data(PARTICIPANT_CUMULATIVE_POINTS_FILE, default_value=[]) # Needed for rank change and cumulative scores for participants

    # Point calculation loop for each available stage
    for stage_num in available_stage_numbers:
        current_date = datetime.now().strftime("%Y-%m-%d") 
        print(f"\n--- Processing Stage {stage_num} ({current_date}) ---")

        try:
            full_stage_data = load_scraped_stage_data(stage_num, STAGE_DATA_DIR)
            
            stage_results = full_stage_data.get('top_20_finishers', []) # Use 'top_20_finishers' for results
            
            # Extract jersey holders from the 'top_X_rider' fields
            jersey_holders = {}
            if full_stage_data.get('top_gc_rider') and full_stage_data['top_gc_rider'].get('rider_name'):
                jersey_holders['yellow'] = full_stage_data['top_gc_rider'].get('rider_name')
            if full_stage_data.get('top_points_rider') and full_stage_data['top_points_rider'].get('rider_name'):
                jersey_holders['green'] = full_stage_data['top_points_rider'].get('rider_name')
            if full_stage_data.get('top_kom_rider') and full_stage_data['top_kom_rider'].get('rider_name'):
                jersey_holders['polka_dot'] = full_stage_data['top_kom_rider'].get('rider_name')
            if full_stage_data.get('top_youth_rider') and full_stage_data['top_youth_rider'].get('rider_name'):
                jersey_holders['white'] = full_stage_data['top_youth_rider'].get('rider_name')

            print(f"Loaded scraped data for Stage {stage_num}.")
        except FileNotFoundError as e:
            print(f"Error loading data for Stage {stage_num}: {e}. Skipping.")
            continue
        except KeyError as e:
            print(f"Error accessing expected data fields for Stage {stage_num} from scraped data: {e}. Skipping. Data structure might be incomplete.")
            continue

        # --- Rider Calculations ---
        rider_stage_data_breakdown = calculate_rider_stage_points_breakdown(stage_results, jersey_holders, SCORING_RULES)
        
        # Update detailed_rider_history_in_memory and rider_cumulative_points
        detailed_rider_history_in_memory, cumulative_rider_points = update_detailed_rider_history(
            stage_num,
            current_date,
            rider_stage_data_breakdown,
            RIDER_STAGE_POINTS_HISTORY_FILE
        )
        print(f"Rider stage points and cumulative points updated for Stage {stage_num}.")
        
        # --- Participant Calculations ---
        # No change needed for current_cumulative_rider_points_map as it's for riders

        participant_cumulative_leaderboard, participant_stage_scores, participant_rider_contributions = \
            calculate_participant_scores_and_contributions(
                PARTICIPANT_SELECTIONS, # Pass the list directly
                detailed_rider_history_in_memory,
                stage_num,
                previous_cumulative_leaderboard=previous_cumulative_leaderboard
            )
        
        save_json_data(participant_cumulative_leaderboard, PARTICIPANT_CUMULATIVE_POINTS_FILE)
        print(f"Participant cumulative leaderboard updated for Stage {stage_num}.")

        # Update detailed_participant_history_in_memory
        detailed_participant_history_in_memory = update_detailed_participant_history(
            stage_num,
            current_date,
            participant_stage_scores,
            participant_rider_contributions,
            participant_cumulative_leaderboard,
            PARTICIPANT_STAGE_POINTS_HISTORY_FILE
        )
        print(f"Participant stage points history updated for Stage {stage_num}.")

        # Update previous leaderboard for next stage's rank change calculation
        previous_cumulative_leaderboard = participant_cumulative_leaderboard