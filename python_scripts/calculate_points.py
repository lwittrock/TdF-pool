import os
import json
import re
import sys
import logging
from collections import defaultdict
from datetime import datetime
from dataclasses import dataclass
from typing import Dict, List, Optional, Any

# --- Constants ---
TDF_YEAR = 2025

# Directory structure
DATA_DIR = 'data'
STAGE_DATA_DIR = os.path.join(DATA_DIR, 'stage_results')
WEB_OUTPUT_DIR = 'docs/src'
WEB_DATA_DIR = os.path.join(WEB_OUTPUT_DIR, 'data')

# Output files
CONSOLIDATED_POINTS_FILE = os.path.join(WEB_DATA_DIR, 'tdf_data.json')
CONSOLIDATED_TEAM_SELECTION_FILE = os.path.join(WEB_DATA_DIR, 'tdf_team_selections.json')

# Input file (all stages selections)
PARTICIPANT_SELECTIONS_FILE = os.path.join(DATA_DIR, 'team_selections_active.json')

# Scoring rules
SCORING_RULES_JERSEY = {
    "yellow_jersey": 15,
    "green_jersey": 10,
    "polka_dot_jersey": 10,
    "white_jersey": 10
}
SCORING_RULES_COMBATIVE = 5

SCORING_RULES_RANK = {rank: 21 - rank for rank in range(2, 21)}  # 19 points for 2nd, down to 1 point for 20th
SCORING_RULES_RANK[1] = 25

# Directie configuration
TOP_N_PARTICIPANTS_FOR_DIRECTIE = 5

# --- Data Classes ---
@dataclass
class StageInfo:
    date: str
    distance: float
    departure_city: str
    arrival_city: str
    stage_type_category: str
    stage_difficulty: str
    won_how: str

@dataclass
class RiderStageData:
    date: str
    stage_finish_points: int
    stage_finish_position: int
    jersey_points: Dict[str, int]
    stage_total: int
    cumulative_total: int

@dataclass
class ParticipantStageData:
    date: str
    stage_score: int
    cumulative_score: int
    rider_contributions: Dict[str, int]

@dataclass
class LeaderboardEntry:
    participant_name: str
    total_score: int
    rank: int
    rank_change: Optional[int]


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
        json.dump(data, f, indent=2, ensure_ascii=False)

def find_available_scraped_stages(stage_data_dir: str) -> List[int]:
    """Return a sorted list of available scraped stage numbers."""
    stage_numbers = []
    if os.path.exists(stage_data_dir):
        for filename in os.listdir(stage_data_dir):
            match = re.match(r'stage_(\d+)\.json', filename)
            if match:
                stage_numbers.append(int(match.group(1)))
    return sorted(set(stage_numbers))

def load_scraped_stage_data(stage_number: int, stage_data_dir: str):
    """Load scraped stage data for a given stage number."""
    filepath = os.path.join(stage_data_dir, f'stage_{stage_number}.json')
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Scraped data for Stage {stage_number} not found at: {filepath}.")
    return load_json_data(filepath)


# --- Points Calculation ---
def get_stage_points_for_rank(rank: int) -> int:
    return SCORING_RULES_RANK.get(rank, 0)

def safe_int_conversion(value: Any) -> int:
    """Safely convert a value (like a rank) to an integer, returning 0 on failure."""
    if isinstance(value, str):
        try:
            # Clean string before converting (e.g., removes dots or non-digits if present)
            return int(re.sub(r'\D', '', value))
        except ValueError:
            return 0
    elif isinstance(value, int):
        return value
    return 0

def calculate_rider_stage_points(stage_results: List[dict], jersey_holders: Dict[str, str]) -> Dict[str, dict]:
    """Calculate points breakdown for each rider in a stage."""
    rider_data = defaultdict(lambda: {
        "stage_finish_points": 0,
        "stage_finish_position": 0,
        "jersey_points": {},
        "stage_total": 0
    })

    # Stage Finish Points
    for row in stage_results:
        rider = row['rider_name']        
        rank = safe_int_conversion(row['rank'])
        points = get_stage_points_for_rank(rank)
        if rank > 0:
            rider_data[rider]["stage_finish_points"] = points
            rider_data[rider]["stage_finish_position"] = rank
            rider_data[rider]["stage_total"] = points

    # Jersey points & combative rider points
    for jersey_type, holder_data in jersey_holders.items():
        
        # 1. Safely Extract Rider Name
        holder_name = None
        if isinstance(holder_data, dict) and 'rider_name' in holder_data:
            holder_name = holder_data.get('rider_name') # Handles structures like "combative_rider": {"rider_name": "Tim Wellens"}
        elif isinstance(holder_data, str) and holder_data not in ["N/A", "null", ""]:
            holder_name = holder_data  # Handles structures like "yellow_rider": "Jonas Vingegaard"
        if not holder_name: # Skip if no valid rider name
            continue 
            
        points = 0
        point_category = jersey_type
        
        # 2. Determine Point Value
        if jersey_type == "combative_rider":
            points = SCORING_RULES_COMBATIVE
            point_category = "combative"
        else:
            points_key = f"{jersey_type}_jersey"
            points = SCORING_RULES_JERSEY.get(points_key, 0)
            point_category = jersey_type 

        # 3. Apply Points to Rider
        if points > 0:
            rider_data[holder_name]["jersey_points"][point_category] = points
            rider_data[holder_name]["stage_total"] += points

    return dict(rider_data)


# --- Data Processing ---
class TDFDataProcessor:
    def __init__(self, team_selections_per_stage: Dict[int, List[dict]]):
        self.team_selections_per_stage = team_selections_per_stage
        self.riders_data = {}
        self.stages_data = {}
        self.leaderboard_by_stage = {}
        self.directie_leaderboard_by_stage = {}
        self.cumulative_rider_points = defaultdict(int)
        self.cumulative_participant_points = defaultdict(int)
        self.cumulative_directie_points = defaultdict(int)
        self.participant_directie_contributions = defaultdict(lambda: defaultdict(int))
        self.participant_to_directie = {}

        # Build participant → directie mapping from stage 0
        initial_stage = self.team_selections_per_stage.get(0, [])
        for selection in initial_stage:
            participant_name = selection.get("name")
            directie = selection.get("directie", "Unknown")
            if participant_name:
                self.participant_to_directie[participant_name] = directie
        
    def process_stage(self, stage_num: int, stage_raw_data: dict):
        """Process a single stage and update all data structures."""
        stage_date = stage_raw_data.get('stage_info', {}).get('date', datetime.now().strftime("%Y-%m-%d"))
        
        # Extract stage info
        stage_info = stage_raw_data.get('stage_info', {})
        stage_results = stage_raw_data.get('top_20_finishers', [])
        
        # Extract jersey holders
        jersey_holders = {}
        if stage_raw_data.get('top_gc_rider', {}).get('rider_name'):
            jersey_holders['yellow'] = stage_raw_data['top_gc_rider']['rider_name']
        if stage_raw_data.get('top_points_rider', {}).get('rider_name'):
            jersey_holders['green'] = stage_raw_data['top_points_rider']['rider_name']
        if stage_raw_data.get('top_kom_rider', {}).get('rider_name'):
            jersey_holders['polka_dot'] = stage_raw_data['top_kom_rider']['rider_name']
        if stage_raw_data.get('top_youth_rider', {}).get('rider_name'):
            jersey_holders['white'] = stage_raw_data['top_youth_rider']['rider_name']
        
        combative_data = stage_raw_data.get('combative_rider')
        if combative_data and isinstance(combative_data, dict) and combative_data.get('rider_name'):
            jersey_holders['combative'] = combative_data['rider_name']

        winner = stage_results[0]['rider_name'] if stage_results else None
        self.stages_data[f'stage_{stage_num}'] = {
            'info': stage_info,
            'winner': winner,
            'jerseys': jersey_holders,
            'top_20_finishers': stage_results,
            'dnf_riders': stage_raw_data.get('dnf_riders', [])
        }
        
        # Calculate rider points for this stage
        rider_stage_points = calculate_rider_stage_points(stage_results, jersey_holders)
        
        # Update rider data
        for rider_name, stage_data in rider_stage_points.items():
            if rider_name not in self.riders_data:
                self.riders_data[rider_name] = {'total_points': 0, 'stages': {}}
            self.cumulative_rider_points[rider_name] += stage_data['stage_total']
            self.riders_data[rider_name]['stages'][f'stage_{stage_num}'] = {
                'date': stage_date,
                'stage_finish_points': stage_data['stage_finish_points'],
                'stage_finish_position': int(stage_data.get('stage_finish_position', 0)), 
                'jersey_points': stage_data['jersey_points'],
                'stage_total': stage_data['stage_total'],
                'cumulative_total': self.cumulative_rider_points[rider_name]
            }
            self.riders_data[rider_name]['total_points'] = self.cumulative_rider_points[rider_name]

        # Ensure all riders have entry
        for rider_name in self.cumulative_rider_points.keys():
            if rider_name not in rider_stage_points:
                if rider_name not in self.riders_data:
                    self.riders_data[rider_name] = {'total_points': 0, 'stages': {}}
                self.riders_data[rider_name]['stages'][f'stage_{stage_num}'] = {
                    'date': stage_date,
                    'stage_finish_points': 0,
                    'stage_finish_position': 0,
                    'jersey_points': {},
                    'stage_total': 0,
                    'cumulative_total': self.cumulative_rider_points[rider_name]
                }

        # Participant scores
        participant_roster_list = self.team_selections_per_stage.get(stage_num, [])
        participant_stage_scores = {}
        for selection_entry in participant_roster_list:
            participant_name = selection_entry.get("name")
            if not participant_name:
                logging.warning(f"Participant missing name. Skipping {selection_entry}")
                continue
            selected_riders = selection_entry.get("active_riders", [])
            stage_score = 0
            rider_contributions = {}
            for rider in selected_riders:
                rider_data_stage = self.riders_data.get(rider, {}).get('stages', {}).get(f'stage_{stage_num}', {})
                rider_points = rider_data_stage.get('stage_total', 0)
                stage_score += rider_points
                rider_contributions[rider] = rider_points
            directie = self.participant_to_directie.get(participant_name, "Unknown")
            participant_stage_scores[participant_name] = {
                'stage_score': stage_score,
                'rider_contributions': rider_contributions,
                'directie': directie
            }
            self.cumulative_participant_points[participant_name] += stage_score
            self.participant_directie_contributions[directie][participant_name] += stage_score

        # Update leaderboards
        self.update_leaderboard_after_stage(stage_num, participant_stage_scores)
        self.update_directie_leaderboard_after_stage(stage_num, participant_stage_scores)

    # --- Leaderboard updates (same as original) ---
    def update_leaderboard_after_stage(self, stage_num: int, participant_stage_scores: dict):
        leaderboard = []
        for participant_name, score in self.cumulative_participant_points.items():
            stage_data = participant_stage_scores.get(participant_name, {})
            leaderboard.append({
                'participant_name': participant_name,
                'directie_name': self.participant_to_directie.get(participant_name, "Unknown"),
                'overall_score': score,
                'stage_score': stage_data.get('stage_score', 0),
                'stage_rider_contributions': stage_data.get('rider_contributions', {})
            })

        # Overall ranking
        leaderboard.sort(key=lambda x: x['overall_score'], reverse=True)
        previous_stage_key = f'stage_{stage_num - 1}'
        previous_leaderboard = self.leaderboard_by_stage.get(previous_stage_key, [])
        previous_ranks = {entry['participant_name']: entry['overall_rank'] for entry in previous_leaderboard}
        for i, entry in enumerate(leaderboard):
            overall_rank = i + 1
            entry['overall_rank'] = overall_rank
            prev_rank = previous_ranks.get(entry['participant_name'])
            entry['overall_rank_change'] = prev_rank - overall_rank if prev_rank is not None else 0

        # Stage ranking
        stage_ranking = sorted(leaderboard, key=lambda x: x['stage_score'], reverse=True)
        stage_ranks = {entry['participant_name']: i + 1 for i, entry in enumerate(stage_ranking)}
        for entry in leaderboard:
            entry['stage_rank'] = stage_ranks[entry['participant_name']]

        # Reorder fields
        ordered_leaderboard = [
            {
                'participant_name': e['participant_name'],
                'directie_name': e['directie_name'],
                'overall_score': e['overall_score'],
                'overall_rank': e['overall_rank'],
                'overall_rank_change': e['overall_rank_change'],
                'stage_score': e['stage_score'],
                'stage_rank': e['stage_rank'],
                'stage_rider_contributions': e['stage_rider_contributions']
            } for e in leaderboard
        ]
        self.leaderboard_by_stage[f'stage_{stage_num}'] = ordered_leaderboard

    def update_directie_leaderboard_after_stage(self, stage_num: int, participant_stage_scores: dict):
        directie_participants_stage = defaultdict(list)
        for participant_name, stage_data in participant_stage_scores.items():
            directie = stage_data['directie']
            stage_contribution = stage_data['stage_score']
            directie_participants_stage[directie].append({
                'participant_name': participant_name,
                'stage_contribution': stage_contribution
            })

        directie_leaderboard = []
        for directie, participants in directie_participants_stage.items():
            top_n = sorted(participants, key=lambda x: x['stage_contribution'], reverse=True)[:TOP_N_PARTICIPANTS_FOR_DIRECTIE]
            stage_total = sum(p['stage_contribution'] for p in top_n)
            self.cumulative_directie_points[directie] += stage_total
            overall_contributions = [
                {'participant_name': p, 'overall_score': self.participant_directie_contributions[directie][p]}
                for p in self.participant_directie_contributions[directie].keys()
            ]
            overall_contributions.sort(key=lambda x: x['overall_score'], reverse=True)
            stage_contributions = [{'participant_name': p['participant_name'], 'stage_score': p['stage_contribution']} for p in top_n]
            directie_leaderboard.append({
                'directie_name': directie,
                'overall_score': self.cumulative_directie_points[directie],
                'stage_score': stage_total,
                'stage_participant_contributions': stage_contributions,
                'overall_participant_contributions': overall_contributions
            })

        # Rankings
        directie_leaderboard.sort(key=lambda x: x['overall_score'], reverse=True)
        previous_stage_key = f'stage_{stage_num - 1}'
        previous_directie_leaderboard = self.directie_leaderboard_by_stage.get(previous_stage_key, [])
        previous_directie_ranks = {e['directie_name']: e['overall_rank'] for e in previous_directie_leaderboard}
        for i, entry in enumerate(directie_leaderboard):
            entry['overall_rank'] = i + 1
            prev_rank = previous_directie_ranks.get(entry['directie_name'])
            entry['overall_rank_change'] = prev_rank - entry['overall_rank'] if prev_rank is not None else 0
        stage_ranking = sorted(directie_leaderboard, key=lambda x: x['stage_score'], reverse=True)
        stage_ranks = {e['directie_name']: i + 1 for i, e in enumerate(stage_ranking)}
        for entry in directie_leaderboard:
            entry['stage_rank'] = stage_ranks[entry['directie_name']]

        # Reorder fields
        ordered_directie_leaderboard = [
            {
                'directie_name': e['directie_name'],
                'overall_score': e['overall_score'],
                'overall_rank': e['overall_rank'],
                'overall_rank_change': e['overall_rank_change'],
                'stage_score': e['stage_score'],
                'stage_rank': e['stage_rank'],
                'stage_participant_contributions': e['stage_participant_contributions'],
                'overall_participant_contributions': e['overall_participant_contributions']
            } for e in directie_leaderboard
        ]
        self.directie_leaderboard_by_stage[f'stage_{stage_num}'] = ordered_directie_leaderboard

    def get_consolidated_data(self, total_stages_processed: int, current_stage: int) -> dict:
        return {
            'metadata': {
                'last_updated': datetime.now().isoformat(),
                'total_stages_processed': total_stages_processed,
                'current_stage': current_stage,
                'tdf_year': TDF_YEAR,
                'top_n_participants_for_directie': TOP_N_PARTICIPANTS_FOR_DIRECTIE
            },
            'stages': self.stages_data,
            'leaderboard_by_stage': self.leaderboard_by_stage,
            'directie_leaderboard_by_stage': self.directie_leaderboard_by_stage,
            'riders': self.riders_data
        }

# --- Main Execution ---
def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(WEB_DATA_DIR, exist_ok=True)

    logging.info("--- Starting TdF Points Calculation ---")

    # Load all-stage participant selections
    team_selection_data = load_json_data(PARTICIPANT_SELECTIONS_FILE, default_value={})
    if not team_selection_data:
        logging.error(f"{PARTICIPANT_SELECTIONS_FILE} is empty or invalid.")
        sys.exit(1)

    team_selections_per_stage = {
        entry["stage"]: entry["participants"]
        for entry in team_selection_data.get("team_selections_per_stage", [])
    }
    logging.info(f"Loaded team selections for {len(team_selections_per_stage)} stages (incl. initial stage 0).")

    # Find available stage results
    available_stage_numbers = find_available_scraped_stages(STAGE_DATA_DIR)
    if not available_stage_numbers:
        logging.error(f"No scraped stage data found in {STAGE_DATA_DIR}.")
        sys.exit(1)
    logging.info(f"Found {len(available_stage_numbers)} scraped stages: {available_stage_numbers}")

    processor = TDFDataProcessor(team_selections_per_stage)

    stages_processed_count = 0
    for stage_num in available_stage_numbers:
        if stage_num == 0:
            continue
        try:
            stage_raw_data = load_scraped_stage_data(stage_num, STAGE_DATA_DIR)
            processor.process_stage(stage_num, stage_raw_data)
            stages_processed_count += 1
        except FileNotFoundError as e:
            logging.error(f"Error loading Stage {stage_num}: {e}. Skipping.")
            continue
        except KeyError as e:
            logging.error(f"Error processing Stage {stage_num}: {e}. Skipping.")
            continue

    consolidated_data = processor.get_consolidated_data(
        total_stages_processed=len(available_stage_numbers) - 1,
        current_stage=max(available_stage_numbers) if available_stage_numbers else 0
    )

    save_json_data(consolidated_data, CONSOLIDATED_POINTS_FILE)
    save_json_data(team_selection_data, CONSOLIDATED_TEAM_SELECTION_FILE)

    logging.info(f"Successfully processed {stages_processed_count} stages")
    logging.info(f"Consolidated data saved to: {CONSOLIDATED_POINTS_FILE}")
    logging.info("--- Processing Complete ---")

if __name__ == "__main__":
    main()
