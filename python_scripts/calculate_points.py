import os
import json
import re
import sys
import logging
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
def load_json_data(filepath: str, default_value=None):
    """Load JSON data from a file, or return default_value if file does not exist."""
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return default_value

def save_json_data(data, filepath: str):
    """Save data as JSON to a file, creating directories as needed."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def clear_json_file(filepath: str, default_value_type=dict):
    """Clear a JSON file, writing an empty dict or list as specified."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        if default_value_type == dict:
            json.dump({}, f)
        else:
            json.dump([], f)

def write_json_with_backup(data, filepath: str):
    """Write JSON data to a file, backing up the previous file if it exists."""
    if os.path.exists(filepath):
        backup_path = filepath + '.bak'
        shutil.copy(filepath, backup_path)
        logging.info(f"Backup created: {backup_path}")
    save_json_data(data, filepath)

# Load scraped stage data
def load_scraped_stage_data(stage_number: int, STAGE_DATA_DIR: str):
    """Load scraped stage data for a given stage number."""
    filepath = os.path.join(STAGE_DATA_DIR, f'stage_{stage_number}.json')
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Scraped data for Stage {stage_number} not found at: {filepath}.")
    return load_json_data(filepath)

# Find available scraped stages
def find_available_scraped_stages(STAGE_DATA_DIR: str) -> list:
    """Return a sorted list of available scraped stage numbers."""
    stage_numbers = []
    if os.path.exists(STAGE_DATA_DIR):
        for filename in os.listdir(STAGE_DATA_DIR):
            match = re.match(r'stage_(\d+)\.json', filename)
            if match:
                stage_numbers.append(int(match.group(1)))
    return sorted(set(stage_numbers))

# --- Calculate points per rider based on stage results ---
SCORING_RULES = {
    "yellow_jersey": 15,
    "green_jersey": 10,
    "polka_dot_jersey": 10,
    "white_jersey": 10,
    "combative_rider": 5,
    "team_stage": 6,
}

def _get_stage_points_for_rank(rank: int) -> int:
    """Return points for a rider's rank in a stage."""
    if 1 <= rank <= 20:
        return 25 if rank == 1 else (20 - (rank - 1))
    return 0

def calculate_rider_stage_points_breakdown(stage_results: list, jersey_holders: dict, scoring_rules: dict) -> dict:
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
def update_detailed_rider_history(current_stage_num: int, current_date: str, rider_stage_data: dict, detailed_rider_history_file: str):
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
def calculate_participant_scores_and_contributions(
    participant_selections_list: list,
    detailed_rider_history: dict,
    current_stage_num: int,
    previous_cumulative_leaderboard: list = None
) -> tuple:
    participant_stage_scores = defaultdict(int)
    participant_cumulative_scores = defaultdict(int)
    participant_rider_contributions = defaultdict(dict)

    # Load previous cumulative scores to build current cumulative correctly
    previous_scores_map = {entry['participant_name']: entry['total_score'] for entry in previous_cumulative_leaderboard or []}

    # Instead of using initial selections, load per-stage active roster file
    roster_file = os.path.join(DATA_DIR, 'selection', f'participant_selection_active_stage_{current_stage_num}.json')
    if os.path.exists(roster_file):
        participant_roster_list = load_json_data(roster_file, default_value=[])
    else:
        print(f"Warning: Active roster file not found for stage {current_stage_num}: {roster_file}. Using initial selections.")
        participant_roster_list = participant_selections_list

    for selection_entry in participant_roster_list:
        participant_name = selection_entry.get("name")
        selected_riders = selection_entry.get("active_riders", [])

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

        participant_cumulative_scores[participant_name] = previous_scores_map.get(participant_name, 0) + current_stage_contribution_total

    leaderboard = [
        {"participant_name": name, "total_score": score}
        for name, score in participant_cumulative_scores.items()
    ]
    leaderboard_sorted = sorted(leaderboard, key=lambda x: x['total_score'], reverse=True)

    previous_ranks = {entry['participant_name']: entry['rank'] for entry in previous_cumulative_leaderboard or []}
    for i, entry in enumerate(leaderboard_sorted):
        entry['rank'] = i + 1
        prev_rank = previous_ranks.get(entry['participant_name'])
        entry['rank_change'] = (prev_rank - entry['rank']) if prev_rank is not None else None

    return leaderboard_sorted, dict(participant_stage_scores), dict(participant_rider_contributions)


def update_detailed_participant_history(
    current_stage_num: int,
    current_date: str,
    participant_stage_scores: dict,
    participant_rider_contributions: dict,
    participant_cumulative_leaderboard: list,
    detailed_participant_history_file: str
) -> dict:
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
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(WEB_DATA_DIR, exist_ok=True)

    logging.info("--- Starting Full Points Recalculation for All Available Stages ---")

    # Clear all relevant data files
    clear_json_file(RIDER_CUMULATIVE_POINTS_FILE, dict)
    clear_json_file(PARTICIPANT_CUMULATIVE_POINTS_FILE, list)
    clear_json_file(RIDER_STAGE_POINTS_HISTORY_FILE, dict)
    clear_json_file(PARTICIPANT_STAGE_POINTS_HISTORY_FILE, dict)
    logging.info("Previous data cleared.")

    try:
        PARTICIPANT_SELECTIONS = load_json_data(PARTICIPANT_SELECTIONS_FILE, default_value=[])
        if not PARTICIPANT_SELECTIONS:
            logging.error(f"{PARTICIPANT_SELECTIONS_FILE} is empty or invalid. Please ensure participant selections are set up.")
            sys.exit(1)
        logging.info(f"Loaded {len(PARTICIPANT_SELECTIONS)} participant selections.")
    except FileNotFoundError:
        logging.error(f"{PARTICIPANT_SELECTIONS_FILE} not found. Please ensure participant selections are set up.")
        sys.exit(1)

    available_stage_numbers = find_available_scraped_stages(STAGE_DATA_DIR)
    if not available_stage_numbers:
        logging.error(f"No scraped stage data found in {STAGE_DATA_DIR}. Please run the scraping script first.")
        sys.exit(1)
    logging.info(f"Found {len(available_stage_numbers)} scraped stages: {available_stage_numbers}")

    detailed_rider_history_in_memory = load_json_data(RIDER_STAGE_POINTS_HISTORY_FILE, default_value={})
    detailed_participant_history_in_memory = load_json_data(PARTICIPANT_STAGE_POINTS_HISTORY_FILE, default_value={})
    previous_cumulative_leaderboard = load_json_data(PARTICIPANT_CUMULATIVE_POINTS_FILE, default_value=[])

    for stage_num in available_stage_numbers:
        current_date = datetime.now().strftime("%Y-%m-%d")
        logging.info(f"--- Processing Stage {stage_num} ({current_date}) ---")

        try:
            full_stage_data = load_scraped_stage_data(stage_num, STAGE_DATA_DIR)
            stage_results = full_stage_data.get('top_20_finishers', [])
            jersey_holders = {}
            if full_stage_data.get('top_gc_rider') and full_stage_data['top_gc_rider'].get('rider_name'):
                jersey_holders['yellow'] = full_stage_data['top_gc_rider'].get('rider_name')
            if full_stage_data.get('top_points_rider') and full_stage_data['top_points_rider'].get('rider_name'):
                jersey_holders['green'] = full_stage_data['top_points_rider'].get('rider_name')
            if full_stage_data.get('top_kom_rider') and full_stage_data['top_kom_rider'].get('rider_name'):
                jersey_holders['polka_dot'] = full_stage_data['top_kom_rider'].get('rider_name')
            if full_stage_data.get('top_youth_rider') and full_stage_data['top_youth_rider'].get('rider_name'):
                jersey_holders['white'] = full_stage_data['top_youth_rider'].get('rider_name')
            logging.info(f"Loaded scraped data for Stage {stage_num}.")
        except FileNotFoundError as e:
            logging.error(f"Error loading data for Stage {stage_num}: {e}. Skipping.")
            continue
        except KeyError as e:
            logging.error(f"Error accessing expected data fields for Stage {stage_num} from scraped data: {e}. Skipping. Data structure might be incomplete.")
            continue

        rider_stage_data_breakdown = calculate_rider_stage_points_breakdown(stage_results, jersey_holders, SCORING_RULES)
        detailed_rider_history_in_memory, cumulative_rider_points = update_detailed_rider_history(
            stage_num,
            current_date,
            rider_stage_data_breakdown,
            RIDER_STAGE_POINTS_HISTORY_FILE
        )
        logging.info(f"Rider stage points and cumulative points updated for Stage {stage_num}.")

        participant_cumulative_leaderboard, participant_stage_scores, participant_rider_contributions = \
            calculate_participant_scores_and_contributions(
                PARTICIPANT_SELECTIONS,
                detailed_rider_history_in_memory,
                stage_num,
                previous_cumulative_leaderboard=previous_cumulative_leaderboard
            )
        save_json_data(participant_cumulative_leaderboard, PARTICIPANT_CUMULATIVE_POINTS_FILE)
        logging.info(f"Participant cumulative leaderboard updated for Stage {stage_num}.")

        detailed_participant_history_in_memory = update_detailed_participant_history(
            stage_num,
            current_date,
            participant_stage_scores,
            participant_rider_contributions,
            participant_cumulative_leaderboard,
            PARTICIPANT_STAGE_POINTS_HISTORY_FILE
        )
        logging.info(f"Participant stage points history updated for Stage {stage_num}.")

        previous_cumulative_leaderboard = participant_cumulative_leaderboard