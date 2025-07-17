import os
import json
import re
from collections import defaultdict
from datetime import datetime
import shutil

# --- Configuration ---
SCORING_RULES = {
    "yellow_jersey": 10,
    "green_jersey": 5,
    "polka_dot_jersey": 5,
    "white_jersey": 5,
}

DATA_DIR = 'data'
# New: Directory where scraped real stage results (stage_N.json) are directly stored
SCRAPED_STAGES_DATA_DIR = os.path.join(DATA_DIR, 'stage_results')
# Although not used for file paths here, TDF_YEAR is still relevant for context
# and might be used in other scripts (e.g., the scraper itself).
TDF_YEAR = 2025 # <<< IMPORTANT: Set the Tour de France year here if it changes!

# Output file paths remain the same
RIDER_CUMULATIVE_POINTS_FILE = os.path.join(DATA_DIR, 'rider_cumulative_points.json')
PARTICIPANT_CUMULATIVE_POINTS_FILE = os.path.join(DATA_DIR, 'participant_cumulative_points.json') # This is the cumulative leaderboard

RIDER_STAGE_POINTS_HISTORY_FILE = os.path.join(DATA_DIR, 'rider_stage_points.json') # Detailed per-rider, per-stage
PARTICIPANT_STAGE_POINTS_HISTORY_FILE = os.path.join(DATA_DIR, 'participant_stage_points.json') # Detailed per-participant, per-stage

PARTICIPANT_SELECTIONS_FILE = os.path.join(DATA_DIR, 'participant_selections.json')

WEB_OUTPUT_DIR = 'docs'
WEB_DATA_DIR = os.path.join(WEB_OUTPUT_DIR, 'data')

# --- Helper Functions ---
def load_json_data(filepath, default_value=None):
    if default_value is None:
        default_value = {}
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
        else:
            json.dump([], f)

# Modified: Load scraped stage data (no 'year' in path)
def load_scraped_stage_data(stage_number, scraped_stages_data_dir):
    # Construct the path for the real scraped data file directly in the specified directory
    filepath = os.path.join(scraped_stages_data_dir, f'stage_{stage_number}.json')
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Scraped data for Stage {stage_number} not found at: {filepath}.")
    return load_json_data(filepath)

# Modified: Find available scraped stages (no 'year' in path scanning)
def find_available_scraped_stages(scraped_stages_data_dir):
    stage_numbers = []
    if os.path.exists(scraped_stages_data_dir):
        for filename in os.listdir(scraped_stages_data_dir):
            # Regex to match 'stage_N.json'
            match = re.match(r'stage_(\d+)\.json', filename)
            if match:
                stage_numbers.append(int(match.group(1)))
    return sorted(set(stage_numbers))

def _get_stage_points_for_rank(rank):
    if 1 <= rank <= 20:
        return 25 if rank == 1 else (20 - (rank - 1))
    return 0

def calculate_rider_stage_points_breakdown(stage_results, gc_standings, jersey_holders, scoring_rules):
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

    # Calculate jersey points (detailed)
    # gc_standings is typically just the leader from the scraped data for daily points
    if gc_standings and gc_standings[0]: # Ensure it's not empty and has a rider
        gc_leader = gc_standings[0]['rider_name']
        points = scoring_rules["yellow_jersey"]
        if gc_leader and gc_leader != 'N/A':
            rider_stage_data[gc_leader]["jersey_points"]["yellow"] = points
            rider_stage_data[gc_leader]["stage_total"] += points

    for jersey_type, holder_name in jersey_holders.items():
        points = scoring_rules.get(f"{jersey_type}_jersey", 0)
        if points > 0 and holder_name and holder_name != "N/A":
            # Ensure the key exists and add points. If a rider holds multiple jerseys, they will accumulate.
            # Convert to string for consistent keys if jersey_type is not already.
            rider_stage_data[holder_name]["jersey_points"][str(jersey_type)] = \
                rider_stage_data[holder_name]["jersey_points"].get(str(jersey_type), 0) + points
            rider_stage_data[holder_name]["stage_total"] += points
            
    return dict(rider_stage_data) # Convert defaultdict to dict for JSON serialization


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

        # Add stage specific data
        detailed_history[rider_name][f"stage_{current_stage_num}"] = {
            "date": current_date,
            "stage_finish_points": stage_data["stage_finish_points"],
            "jersey_points": stage_data["jersey_points"],
            "stage_total": stage_data["stage_total"],
            "cumulative_total_after_stage": cumulative_rider_points[rider_name] # This is the cumulative after this stage
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
                "cumulative_total_after_stage": current_cumulative # Their cumulative score remains the same if they scored 0
            }


    save_json_data(detailed_history, detailed_rider_history_file)
    save_json_data(cumulative_rider_points, RIDER_CUMULATIVE_POINTS_FILE)
    return detailed_history, cumulative_rider_points


def calculate_participant_scores_and_contributions(participant_selections, detailed_rider_history, current_stage_num, previous_cumulative_leaderboard=None):
    participant_stage_scores = defaultdict(int)
    participant_cumulative_scores = defaultdict(int)
    participant_rider_contributions = defaultdict(dict)

    # Load previous cumulative scores to build current cumulative correctly
    # If starting fresh, previous_cumulative_leaderboard will be an empty list or None
    previous_scores_map = {entry['participant_name']: entry['total_score'] for entry in previous_cumulative_leaderboard or []}

    for participant, selection in participant_selections.items():
        selected_riders = selection.get("main_riders", []) # Assuming 'main_riders' holds the selected riders

        current_stage_contribution_total = 0
        current_stage_rider_contributions = {}

        for rider in selected_riders:
            rider_stage_data = detailed_rider_history.get(rider, {}).get(f"stage_{current_stage_num}", {})
            rider_stage_total = rider_stage_data.get("stage_total", 0)
            
            current_stage_contribution_total += rider_stage_total
            current_stage_rider_contributions[rider] = rider_stage_total
        
        participant_stage_scores[participant] = current_stage_contribution_total
        participant_rider_contributions[participant] = current_stage_rider_contributions

        # Calculate cumulative score
        # Previous cumulative score + current stage score
        participant_cumulative_scores[participant] = previous_scores_map.get(participant, 0) + current_stage_contribution_total
        

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
        PARTICIPANT_SELECTIONS = load_json_data(PARTICIPANT_SELECTIONS_FILE)
        if not PARTICIPANT_SELECTIONS:
            print(f"Error: {PARTICIPANT_SELECTIONS_FILE} is empty or invalid. Please ensure participant selections are set up.")
            exit()
        print(f"Loaded {len(PARTICIPANT_SELECTIONS)} participant selections.")
    except FileNotFoundError:
        print(f"Error: {PARTICIPANT_SELECTIONS_FILE} not found. Please ensure participant selections are set up.")
        exit()

    # Changed to find available scraped stages directly in SCRAPED_STAGES_DATA_DIR
    available_stage_numbers = find_available_scraped_stages(SCRAPED_STAGES_DATA_DIR)
    if not available_stage_numbers:
        print(f"No scraped stage data found in {SCRAPED_STAGES_DATA_DIR}. Please run the scraping script first.")
        exit()
    print(f"Found {len(available_stage_numbers)} scraped stages: {available_stage_numbers}")

    # Initialize history structures (loaded and updated iteratively)
    detailed_rider_history_in_memory = load_json_data(RIDER_STAGE_POINTS_HISTORY_FILE, default_value={})
    detailed_participant_history_in_memory = load_json_data(PARTICIPANT_STAGE_POINTS_HISTORY_FILE, default_value={})
    previous_cumulative_leaderboard = load_json_data(PARTICIPANT_CUMULATIVE_POINTS_FILE, default_value=[]) # Needed for rank change and cumulative scores for participants

    for stage_num in available_stage_numbers:
        # Use current date for history entry or extract from stage data if available
        current_date = datetime.now().strftime("%Y-%m-%d") 
        print(f"\n--- Processing Stage {stage_num} ({current_date}) ---")

        try:
            # Changed to load scraped data directly from SCRAPED_STAGES_DATA_DIR
            full_stage_data = load_scraped_stage_data(stage_num, SCRAPED_STAGES_DATA_DIR)
            
            # The structure of `full_stage_data` from your scraper is different from simulated data.
            # We map these to what `calculate_rider_stage_points_breakdown` expects.
            
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

            # GC standings for daily points calculation is typically just the leader
            gc_standings = [full_stage_data['top_gc_rider']] if full_stage_data.get('top_gc_rider') else []

            print(f"Loaded scraped data for Stage {stage_num}.")
        except FileNotFoundError as e:
            print(f"Error loading data for Stage {stage_num}: {e}. Skipping.")
            continue
        except KeyError as e:
            print(f"Error accessing expected data fields for Stage {stage_num} from scraped data: {e}. Skipping. Data structure might be incomplete.")
            continue

        # --- Rider Calculations ---
        rider_stage_data_breakdown = calculate_rider_stage_points_breakdown(stage_results, gc_standings, jersey_holders, SCORING_RULES)
        
        # Update detailed_rider_history_in_memory and rider_cumulative_points
        detailed_rider_history_in_memory, cumulative_rider_points = update_detailed_rider_history(
            stage_num,
            current_date,
            rider_stage_data_breakdown,
            RIDER_STAGE_POINTS_HISTORY_FILE # This function also saves cumulative_rider_points
        )
        print(f"Rider stage points and cumulative points updated for Stage {stage_num}.")
        
        # --- Participant Calculations ---
        # Need the *latest* cumulative rider points for participant score calculation
        current_cumulative_rider_points_map = load_json_data(RIDER_CUMULATIVE_POINTS_FILE) # Reload to ensure it's up-to-date with current stage

        participant_cumulative_leaderboard, participant_stage_scores, participant_rider_contributions = \
            calculate_participant_scores_and_contributions(
                PARTICIPANT_SELECTIONS,
                detailed_rider_history_in_memory, # Pass the in-memory detailed rider history to get stage-specific points
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
            participant_cumulative_leaderboard, # Pass the full leaderboard to extract cumulative scores
            PARTICIPANT_STAGE_POINTS_HISTORY_FILE
        )
        print(f"Participant stage points history updated for Stage {stage_num}.")

        # Update previous leaderboard for next stage's rank change calculation
        previous_cumulative_leaderboard = participant_cumulative_leaderboard


    print("\n--- Full Points Recalculation Complete ---")
    print(f"Detailed rider stage points history saved to: {RIDER_STAGE_POINTS_HISTORY_FILE}")
    print(f"Rider cumulative points saved to: {RIDER_CUMULATIVE_POINTS_FILE}")
    print(f"Detailed participant stage points history saved to: {PARTICIPANT_STAGE_POINTS_HISTORY_FILE}")
    print(f"Participant cumulative leaderboard saved to: {PARTICIPANT_CUMULATIVE_POINTS_FILE}")


    print(f"\n--- Copying data for web display to {WEB_DATA_DIR} ---")
    try:
        files_to_copy = [
            RIDER_CUMULATIVE_POINTS_FILE,
            PARTICIPANT_CUMULATIVE_POINTS_FILE,
            RIDER_STAGE_POINTS_HISTORY_FILE,
            PARTICIPANT_STAGE_POINTS_HISTORY_FILE,
            PARTICIPANT_SELECTIONS_FILE
        ]
        for f_path in files_to_copy:
            shutil.copy(f_path, WEB_DATA_DIR)
            print(f"Copied {os.path.basename(f_path)}")
        
        # New: Copy the real scraped stages directory to the web output
        src_real_stages_dir = SCRAPED_STAGES_DATA_DIR
        dest_real_stages_dir = os.path.join(WEB_DATA_DIR, 'stage_results') # Copy directly to stage_results in web output

        if os.path.exists(dest_real_stages_dir):
            shutil.rmtree(dest_real_stages_dir)
            print(f"Removed existing '{dest_real_stages_dir}'")
        if os.path.exists(src_real_stages_dir):
            shutil.copytree(src_real_stages_dir, dest_real_stages_dir)
            print(f"Copied real stages directory.")
        else:
            print(f"Warning: Source real stages directory '{src_real_stages_dir}' does not exist. Skipping copy.")
        
        # Remove simulated stages directory from web output if it exists
        dest_sim_stages_dir = os.path.join(WEB_DATA_DIR, 'simulated_stages')
        if os.path.exists(dest_sim_stages_dir):
            shutil.rmtree(dest_sim_stages_dir)
            print(f"Removed old simulated stages directory from web output.")

    except Exception as e:
        print(f"Error copying files to web directory: {e}")

    print("\nTo run again for new stages, ensure the scraping script has generated their data.")
    print(f"Remember to commit and push changes in the '{WEB_OUTPUT_DIR}' folder to update GitHub Pages!")