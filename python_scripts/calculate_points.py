import os
import json
import re
import pandas as pd
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

# --- File Paths for Persistence ---
DATA_DIR = 'data'
SIMULATED_DATA_DIR = os.path.join(DATA_DIR, 'simulated_stages')
CUMULATIVE_RIDER_POINTS_FILE = os.path.join(DATA_DIR, 'cumulative_rider_points.json')
CUMULATIVE_LEADERBOARD_FILE = os.path.join(DATA_DIR, 'cumulative_leaderboard.json')
RIDER_POINTS_HISTORY_FILE = os.path.join(DATA_DIR, 'rider_points_history.json')
LEADERBOARD_HISTORY_FILE = os.path.join(DATA_DIR, 'leaderboard_history.json')
PARTICIPANT_SELECTIONS_FILE = os.path.join(DATA_DIR, 'participant_selections.json')


# Web output directory for GitHub Pages (now confirmed as 'docs')
WEB_OUTPUT_DIR = 'docs'
WEB_DATA_DIR = os.path.join(WEB_OUTPUT_DIR, 'data')


# --- Helper Functions for JSON Persistence ---

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
        json.dump(data, f, indent=4, ensure_ascii=False) # ensure_ascii=False for Dutch characters

def append_to_json_history(new_entry, filepath):
    history = load_json_data(filepath, default_value=[])
    history.append(new_entry)
    save_json_data(history, filepath)

def clear_json_file(filepath, default_value_type=dict):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        if default_value_type == dict:
            json.dump({}, f)
        else:
            json.dump([], f)

def load_simulated_stage_data(stage_number, simulated_data_dir):
    filepath = os.path.join(simulated_data_dir, f'stage_{stage_number}_data.json')
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Simulated data for Stage {stage_number} not found at: {filepath}.")
    data = load_json_data(filepath)
    # Return the full data dictionary, including new fields
    return data 

def find_available_stages(simulated_data_dir):
    stage_numbers = []
    if os.path.exists(simulated_data_dir):
        for filename in os.listdir(simulated_data_dir):
            match = re.match(r'stage_(\d+)_data\.json', filename)
            if match:
                stage_numbers.append(int(match.group(1)))
    return sorted(list(set(stage_numbers)))

# --- Rider Point Calculation Functions ---

def _get_stage_points_for_rank(rank):
    if 1 <= rank <= 20:
        if rank == 1:
            return 25
        else:
            return (20 - (rank - 1))
    return 0

def calculate_rider_stage_points(stage_results):
    rider_points = defaultdict(int)
    stage_df = pd.DataFrame(stage_results)
    for _, row in stage_df.iterrows():
        rider = row['rider_name']
        rank = row['rank']
        rider_points[rider] += _get_stage_points_for_rank(rank)
    return rider_points

def calculate_rider_gc_jersey_points(gc_standings, jersey_holders, scoring_rules):
    rider_points = defaultdict(int)
    if gc_standings:
        gc_leader = gc_standings[0]['rider_name']
        rider_points[gc_leader] += scoring_rules["yellow_jersey"]

    for jersey_type, holder_name in jersey_holders.items():
        points_to_add = 0
        if jersey_type == 'green':
            points_to_add = scoring_rules["green_jersey"]
        elif jersey_type == 'polka_dot':
            points_to_add = scoring_rules["polka_dot_jersey"]
        elif jersey_type == 'white':
            points_to_add = scoring_rules["white_jersey"]
        if points_to_add > 0:
            if holder_name and holder_name != "N/A":
                rider_points[holder_name] += points_to_add
    return rider_points

def get_all_rider_points_for_current_stage(stage_results, gc_standings, jersey_holders):
    daily_rider_points = defaultdict(int)
    stage_rider_points = calculate_rider_stage_points(stage_results)
    for rider, points in stage_rider_points.items():
        daily_rider_points[rider] += points
    gc_jersey_rider_points = calculate_rider_gc_jersey_points(gc_standings, jersey_holders, SCORING_RULES)
    for rider, points in gc_jersey_rider_points.items():
        daily_rider_points[rider] += points
    return daily_rider_points

def update_cumulative_rider_points(daily_rider_points, cumulative_file_path):
    cumulative_points = load_json_data(cumulative_file_path, default_value={})
    for rider, points in daily_rider_points.items():
        cumulative_points[rider] = cumulative_points.get(rider, 0) + points
    save_json_data(cumulative_points, cumulative_file_path)
    return cumulative_points

# --- Participant Score Calculation ---

def calculate_participant_scores(participant_selections_data, all_cumulative_rider_points, daily_rider_points_for_current_stage):
    """
    Calculates total scores for each participant based on their chosen main riders' cumulative total points.
    Also calculates daily scores for participants based on daily rider points.
    Returns a tuple: (sorted_cumulative_leaderboard_list, daily_participant_scores_dict)
    """
    participant_cumulative_scores = defaultdict(int)
    participant_daily_scores = defaultdict(int)

    for participant_name, selection_details in participant_selections_data.items():
        main_riders = selection_details.get("main_riders", []) # Get main riders
        
        for rider in main_riders: # Only use main riders for current scoring
            participant_cumulative_scores[participant_name] += all_cumulative_rider_points.get(rider, 0)
            participant_daily_scores[participant_name] += daily_rider_points_for_current_stage.get(rider, 0)

    # Prepare cumulative leaderboard
    leaderboard = []
    for participant_name, score in participant_cumulative_scores.items():
        leaderboard.append({
            "participant_name": participant_name,
            "total_score": score,
        })
    leaderboard_sorted = sorted(leaderboard, key=lambda x: x['total_score'], reverse=True)
    for i, entry in enumerate(leaderboard_sorted):
        entry['rank'] = i + 1

    return leaderboard_sorted, dict(participant_daily_scores)

# --- Main Execution ---

if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(WEB_DATA_DIR, exist_ok=True)

    print(f"--- Starting Full Points Recalculation for All Available Stages ---")

    print("Clearing previous cumulative data and history...")
    clear_json_file(CUMULATIVE_RIDER_POINTS_FILE, dict)
    clear_json_file(CUMULATIVE_LEADERBOARD_FILE, list)
    clear_json_file(RIDER_POINTS_HISTORY_FILE, list)
    clear_json_file(LEADERBOARD_HISTORY_FILE, list)
    print("Previous data cleared.")

    # Load participant selections
    try:
        PARTICIPANT_SELECTIONS = load_json_data(PARTICIPANT_SELECTIONS_FILE)
        if not PARTICIPANT_SELECTIONS:
            print(f"Error: {PARTICIPANT_SELECTIONS_FILE} is empty or invalid. Please run simulate_selections.py first.")
            exit()
        print(f"Loaded {len(PARTICIPANT_SELECTIONS)} participant selections from {PARTICIPANT_SELECTIONS_FILE}.")
    except FileNotFoundError:
        print(f"Error: {PARTICIPANT_SELECTIONS_FILE} not found. Please run simulate_selections.py first.")
        exit()


    available_stage_numbers = find_available_stages(SIMULATED_DATA_DIR)

    if not available_stage_numbers:
        print(f"No simulated stage data found in {SIMULATED_DATA_DIR}.")
        print("Please ensure you have run the simulation script (`python -m python_scripts.scrape_pcs` or the helper stage data script) to generate the stage data first.")
        exit()

    print(f"Found {len(available_stage_numbers)} stages: {available_stage_numbers}")

    daily_rider_points_for_history = {}

    for stage_num in available_stage_numbers:
        current_date_for_stage = datetime.now().strftime("%Y-%m-%d")

        print(f"\n--- Processing Stage {stage_num} ({current_date_for_stage}) ---")

        try:
            # Load full stage data dictionary now
            full_stage_data = load_simulated_stage_data(stage_num, SIMULATED_DATA_DIR)
            current_stage_results = full_stage_data.get('stage_results', [])
            current_gc_standings = full_stage_data.get('gc_standings', [])
            current_jersey_holders = full_stage_data.get('jersey_holders', {})
            print(f"Successfully loaded simulated data for Stage {stage_num}.")
        except FileNotFoundError as e:
            print(f"Error loading data for Stage {stage_num}: {e}. Skipping this stage.")
            continue

        daily_rider_points_for_history = get_all_rider_points_for_current_stage(
            current_stage_results,
            current_gc_standings,
            current_jersey_holders
        )

        cumulative_rider_points = update_cumulative_rider_points(
            daily_rider_points_for_history,
            CUMULATIVE_RIDER_POINTS_FILE
        )

        print("Cumulative Individual Rider Points (current after this stage):")
        for rider, points in sorted(cumulative_rider_points.items(), key=lambda item: item[1], reverse=True)[:5]:
            if points > 0:
                print(f"  {rider}: {points} cumulative points")

        rider_history_entry = {
            "stage_number": stage_num,
            "date": current_date_for_stage,
            "daily_rider_points": dict(daily_rider_points_for_history),
            "cumulative_rider_points": dict(cumulative_rider_points)
        }
        append_to_json_history(rider_history_entry, RIDER_POINTS_HISTORY_FILE)
        print(f"Rider points for Stage {stage_num} saved to history (cumulative & daily).")

        # Pass the loaded PARTICIPANT_SELECTIONS to the calculation function
        current_leaderboard, daily_participant_scores = calculate_participant_scores(
            PARTICIPANT_SELECTIONS, # Use the loaded selections
            cumulative_rider_points,
            daily_rider_points_for_history
        )

        save_json_data(current_leaderboard, CUMULATIVE_LEADERBOARD_FILE)

        print("Current Leaderboard (after this stage):")
        for entry in current_leaderboard:
            print(f"  Rang {entry['rank']}: {entry['participant_name']} - {entry['total_score']} punten") # Translated output

        leaderboard_history_entry = {
            "stage_number": stage_num,
            "date": current_date_for_stage,
            "leaderboard": current_leaderboard,
            "daily_participant_scores": daily_participant_scores
        }
        append_to_json_history(leaderboard_history_entry, LEADERBOARD_HISTORY_FILE)
        print(f"Leaderboard for Stage {stage_num} saved to history (cumulative & daily participant scores).")

        print("-" * 50)

    print("\n--- Full Points Recalculation Complete ---")
    print(f"Final cumulative leaderboard saved to: {CUMULATIVE_LEADERBOARD_FILE}")
    print(f"Final cumulative rider points saved to: {CUMULATIVE_RIDER_POINTS_FILE}")
    print(f"Rider points history saved to: {RIDER_POINTS_HISTORY_FILE}")
    print(f"Leaderboard history saved to: {LEADERBOARD_HISTORY_FILE}")

    # Copy generated JSONs and simulated stages to the web-accessible data directory
    print(f"\n--- Copying data for web display to {WEB_DATA_DIR} ---")
    try:
        # Copy individual JSON files
        files_to_copy = [
            CUMULATIVE_LEADERBOARD_FILE,
            RIDER_POINTS_HISTORY_FILE,
            CUMULATIVE_RIDER_POINTS_FILE,
            LEADERBOARD_HISTORY_FILE,
            PARTICIPANT_SELECTIONS_FILE
        ]
        for f_path in files_to_copy:
            shutil.copy(f_path, WEB_DATA_DIR)
            print(f"Copied {os.path.basename(f_path)}")

        # Copy the entire simulated_stages directory
        src_sim_stages_dir = SIMULATED_DATA_DIR
        dest_sim_stages_dir = os.path.join(WEB_DATA_DIR, 'simulated_stages')

        if os.path.exists(dest_sim_stages_dir):
            shutil.rmtree(dest_sim_stages_dir) # Remove existing to avoid errors on copytree
            print(f"Removed existing '{dest_sim_stages_dir}'")

        if os.path.exists(src_sim_stages_dir):
            shutil.copytree(src_sim_stages_dir, dest_sim_stages_dir)
            print(f"Copied entire simulated stages directory from '{src_sim_stages_dir}' to '{dest_sim_stages_dir}'")
        else:
            print(f"Warning: Source simulated stages directory '{src_sim_stages_dir}' does not exist. Skipping copy.")

    except Exception as e:
        print(f"Error copying files to web directory: {e}")

    print("\nTo run again for new stages, ensure the simulation script has generated their data.")
    print(f"Remember to commit and push changes in the '{WEB_OUTPUT_DIR}' folder to update GitHub Pages!")