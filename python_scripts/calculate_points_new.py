import os
import json
import re
import sys
import logging
from collections import defaultdict
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional

# --- Constants ---
TDF_YEAR = 2025

# Directory structure
DATA_DIR = 'data'
STAGE_DATA_DIR = os.path.join(DATA_DIR, 'stage_results')
WEB_OUTPUT_DIR = 'frontend-app/src'
WEB_DATA_DIR = os.path.join(WEB_OUTPUT_DIR, 'data')

# Output file
CONSOLIDATED_OUTPUT_FILE = os.path.join(WEB_DATA_DIR, 'tdf_data.json')

# Input files
PARTICIPANT_SELECTIONS_FILE = os.path.join(DATA_DIR, 'participant_selections_anon.json')

# Scoring rules
SCORING_RULES = {
    "yellow_jersey": 15,
    "green_jersey": 10,
    "polka_dot_jersey": 10,
    "white_jersey": 10,
    "combative_rider": 5,
}

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
    """Return points for a rider's rank in a stage."""
    if 1 <= rank <= 20:
        return 25 if rank == 1 else (20 - (rank - 1))
    return 0

def calculate_rider_stage_points(stage_results: List[dict], jersey_holders: Dict[str, str]) -> Dict[str, dict]:
    """Calculate points breakdown for each rider in a stage."""
    rider_data = defaultdict(lambda: {
        "stage_finish_points": 0,
        "jersey_points": {},
        "stage_total": 0
    })

    # Stage finish points
    for row in stage_results:
        rider = row['rider_name']
        rank = row['rank']
        points = get_stage_points_for_rank(rank)
        rider_data[rider]["stage_finish_points"] = points
        rider_data[rider]["stage_total"] = points

    # Jersey points
    for jersey_type, holder_name in jersey_holders.items():
        points_key = f"{jersey_type}_jersey" if jersey_type != "combative_rider" else jersey_type
        points = SCORING_RULES.get(points_key, 0)
        if points > 0 and holder_name and holder_name != "N/A":
            rider_data[holder_name]["jersey_points"][jersey_type] = points
            rider_data[holder_name]["stage_total"] += points
            
    return dict(rider_data)


# --- Data Processing ---
class TDFDataProcessor:
    def __init__(self, participant_selections: List[dict]):
        self.participant_selections = participant_selections
        self.riders_data = {}
        self.stages_data = {}
        self.leaderboard_by_stage = {}
        self.directie_leaderboard_by_stage = {}
        self.cumulative_rider_points = defaultdict(int)
        self.cumulative_participant_points = defaultdict(int)
        self.cumulative_directie_points = defaultdict(int)
        
        # Track participant contributions to directie over time
        self.participant_directie_contributions = defaultdict(lambda: defaultdict(int))
        
        # Build participant to directie mapping
        self.participant_to_directie = {}
        for selection in participant_selections:
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
        if stage_raw_data.get('combative_rider'):
            jersey_holders['combative'] = stage_raw_data['combative_rider']
        
        # Store stage data
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
                'jersey_points': stage_data['jersey_points'],
                'stage_total': stage_data['stage_total'],
                'cumulative_total': self.cumulative_rider_points[rider_name]
            }
            self.riders_data[rider_name]['total_points'] = self.cumulative_rider_points[rider_name]
        
        # Ensure all riders have an entry for this stage (even if 0 points)
        for rider_name in self.cumulative_rider_points.keys():
            if rider_name not in rider_stage_points:
                if rider_name not in self.riders_data:
                    self.riders_data[rider_name] = {'total_points': 0, 'stages': {}}
                
                self.riders_data[rider_name]['stages'][f'stage_{stage_num}'] = {
                    'date': stage_date,
                    'stage_finish_points': 0,
                    'jersey_points': {},
                    'stage_total': 0,
                    'cumulative_total': self.cumulative_rider_points[rider_name]
                }
        
        # Load active roster for this stage
        roster_file = os.path.join(DATA_DIR, 'selection', f'participant_selection_active_stage_{stage_num}.json')
        if os.path.exists(roster_file):
            participant_roster_list = load_json_data(roster_file, default_value=[])
        else:
            logging.warning(f"Active roster file not found for stage {stage_num}. Using initial selections.")
            participant_roster_list = self.participant_selections
        
        # Calculate participant scores for this stage
        participant_stage_scores = {}
        for selection_entry in participant_roster_list:
            participant_name = selection_entry.get("name")
            selected_riders = selection_entry.get("active_riders", [])
            
            if not participant_name:
                logging.warning(f"Participant entry missing 'name' field. Skipping: {selection_entry}")
                continue
            
            stage_score = 0
            rider_contributions = {}
            
            for rider in selected_riders:
                rider_stage_data = self.riders_data.get(rider, {}).get('stages', {}).get(f'stage_{stage_num}', {})
                rider_points = rider_stage_data.get('stage_total', 0)
                stage_score += rider_points
                rider_contributions[rider] = rider_points
            
            participant_stage_scores[participant_name] = {
                'stage_score': stage_score,
                'rider_contributions': rider_contributions,
                'directie': self.participant_to_directie.get(participant_name, "Unknown")
            }
            
            self.cumulative_participant_points[participant_name] += stage_score
            
            # Track contribution to directie
            directie = self.participant_to_directie.get(participant_name, "Unknown")
            self.participant_directie_contributions[directie][participant_name] += stage_score
        
        # Update leaderboards after processing all participants
        self.update_leaderboard_after_stage(stage_num, participant_stage_scores)
        self.update_directie_leaderboard_after_stage(stage_num, participant_stage_scores)
    
    def update_leaderboard_after_stage(self, stage_num: int, participant_stage_scores: dict):
        """Update leaderboard with overall and stage-specific rankings."""
        # Build leaderboard entries
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
        
        # Sort by overall score for overall rankings
        leaderboard.sort(key=lambda x: x['overall_score'], reverse=True)
        
        # Get previous stage for rank change calculation
        previous_stage_key = f'stage_{stage_num - 1}'
        previous_leaderboard = self.leaderboard_by_stage.get(previous_stage_key, [])
        previous_ranks = {entry['participant_name']: entry['overall_rank'] for entry in previous_leaderboard}
        
        # Assign overall ranks
        for i, entry in enumerate(leaderboard):
            overall_rank = i + 1
            entry['overall_rank'] = overall_rank
            prev_rank = previous_ranks.get(entry['participant_name'])
            entry['overall_rank_change'] = prev_rank - overall_rank if prev_rank is not None else 0
        
        # Calculate stage rankings (sort by stage_score)
        stage_ranking = sorted(leaderboard, key=lambda x: x['stage_score'], reverse=True)
        stage_ranks = {}
        for i, entry in enumerate(stage_ranking):
            stage_ranks[entry['participant_name']] = i + 1
        
        # Add stage ranks to leaderboard
        for entry in leaderboard:
            entry['stage_rank'] = stage_ranks[entry['participant_name']]
        
        # Reorder fields for clarity
        ordered_leaderboard = []
        for entry in leaderboard:
            ordered_leaderboard.append({
                'participant_name': entry['participant_name'],
                'directie_name': entry['directie_name'],
                'overall_score': entry['overall_score'],
                'overall_rank': entry['overall_rank'],
                'overall_rank_change': entry['overall_rank_change'],
                'stage_score': entry['stage_score'],
                'stage_rank': entry['stage_rank'],
                'stage_rider_contributions': entry['stage_rider_contributions']
            })
        
        self.leaderboard_by_stage[f'stage_{stage_num}'] = ordered_leaderboard
    
    def update_directie_leaderboard_after_stage(self, stage_num: int, participant_stage_scores: dict):
        """Update directie leaderboard based on stage contributions (top N per directie per stage)."""
        # Organize participants by directie with their stage scores
        directie_participants_stage = defaultdict(list)
        
        for participant_name, stage_data in participant_stage_scores.items():
            directie = stage_data['directie']
            stage_contribution = stage_data['stage_score']
            
            directie_participants_stage[directie].append({
                'participant_name': participant_name,
                'stage_contribution': stage_contribution
            })
        
        # Build directie leaderboard
        directie_leaderboard = []
        for directie, participants in directie_participants_stage.items():
            # Sort by stage contribution to pick top N for this stage
            top_by_stage = sorted(
                participants,
                key=lambda x: x['stage_contribution'],
                reverse=True
            )
            top_n = top_by_stage[:TOP_N_PARTICIPANTS_FOR_DIRECTIE]
            stage_total_for_directie = sum(p['stage_contribution'] for p in top_n)
            
            # Update cumulative total for the directie
            self.cumulative_directie_points[directie] += stage_total_for_directie
            
            # Get overall participant contributions (sorted by cumulative total)
            overall_contributions = [
                {
                    'participant_name': participant_name,
                    'overall_score': self.participant_directie_contributions[directie][participant_name]
                }
                for participant_name in self.participant_directie_contributions[directie].keys()
            ]
            overall_contributions.sort(key=lambda x: x['overall_score'], reverse=True)
            
            # Format stage participant contributions
            stage_contributions = [
                {
                    'participant_name': p['participant_name'],
                    'stage_score': p['stage_contribution']
                }
                for p in top_n
            ]
            
            directie_leaderboard.append({
                'directie_name': directie,
                'overall_score': self.cumulative_directie_points[directie],
                'stage_score': stage_total_for_directie,
                'stage_participant_contributions': stage_contributions,
                'overall_participant_contributions': overall_contributions
            })
        
        # Sort by cumulative total score for overall ranking
        directie_leaderboard.sort(key=lambda x: x['overall_score'], reverse=True)
        
        # Get previous stage for rank change calculation
        previous_stage_key = f'stage_{stage_num - 1}'
        previous_directie_leaderboard = self.directie_leaderboard_by_stage.get(previous_stage_key, [])
        previous_directie_ranks = {entry['directie_name']: entry['overall_rank'] for entry in previous_directie_leaderboard}
        
        # Assign overall ranks
        for i, entry in enumerate(directie_leaderboard):
            overall_rank = i + 1
            entry['overall_rank'] = overall_rank
            prev_rank = previous_directie_ranks.get(entry['directie_name'])
            entry['overall_rank_change'] = prev_rank - overall_rank if prev_rank is not None else 0
        
        # Calculate stage rankings (sort by stage_score)
        stage_ranking = sorted(directie_leaderboard, key=lambda x: x['stage_score'], reverse=True)
        stage_ranks = {}
        for i, entry in enumerate(stage_ranking):
            stage_ranks[entry['directie_name']] = i + 1
        
        # Add stage ranks
        for entry in directie_leaderboard:
            entry['stage_rank'] = stage_ranks[entry['directie_name']]
        
        # Reorder fields for clarity
        ordered_directie_leaderboard = []
        for entry in directie_leaderboard:
            ordered_directie_leaderboard.append({
                'directie_name': entry['directie_name'],
                'overall_score': entry['overall_score'],
                'overall_rank': entry['overall_rank'],
                'overall_rank_change': entry['overall_rank_change'],
                'stage_score': entry['stage_score'],
                'stage_rank': entry['stage_rank'],
                'stage_participant_contributions': entry['stage_participant_contributions'],
                'overall_participant_contributions': entry['overall_participant_contributions']
            })
        
        self.directie_leaderboard_by_stage[f'stage_{stage_num}'] = ordered_directie_leaderboard
    
    def get_consolidated_data(self, total_stages_processed: int, current_stage: int) -> dict:
        """Get the final consolidated data structure."""
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

    # Load participant selections
    try:
        participant_selections = load_json_data(PARTICIPANT_SELECTIONS_FILE, default_value=[])
        if not participant_selections:
            logging.error(f"{PARTICIPANT_SELECTIONS_FILE} is empty or invalid.")
            sys.exit(1)
        logging.info(f"Loaded {len(participant_selections)} participant selections.")
    except FileNotFoundError:
        logging.error(f"{PARTICIPANT_SELECTIONS_FILE} not found.")
        sys.exit(1)

    # Find available stages
    available_stage_numbers = find_available_scraped_stages(STAGE_DATA_DIR)
    if not available_stage_numbers:
        logging.error(f"No scraped stage data found in {STAGE_DATA_DIR}.")
        sys.exit(1)
    logging.info(f"Found {len(available_stage_numbers)} scraped stages: {available_stage_numbers}")

    # Process all stages
    processor = TDFDataProcessor(participant_selections)
    
    for stage_num in available_stage_numbers:
        logging.info(f"--- Processing Stage {stage_num} ---")
        try:
            stage_raw_data = load_scraped_stage_data(stage_num, STAGE_DATA_DIR)
            processor.process_stage(stage_num, stage_raw_data)
            logging.info(f"Stage {stage_num} processed successfully.")
        except FileNotFoundError as e:
            logging.error(f"Error loading Stage {stage_num}: {e}. Skipping.")
            continue
        except KeyError as e:
            logging.error(f"Error processing Stage {stage_num}: {e}. Data structure incomplete. Skipping.")
            continue

    # Generate consolidated output
    consolidated_data = processor.get_consolidated_data(
        total_stages_processed=len(available_stage_numbers),
        current_stage=max(available_stage_numbers) if available_stage_numbers else 0
    )
    
    # Save consolidated data
    save_json_data(consolidated_data, CONSOLIDATED_OUTPUT_FILE)
    logging.info(f"✓ Consolidated data saved to: {CONSOLIDATED_OUTPUT_FILE}")
    logging.info(f"✓ Processed {len(available_stage_numbers)} stages")
    logging.info(f"✓ {len(set(p['participant_name'] for stage in consolidated_data['leaderboard_by_stage'].values() for p in stage))} participants")
    logging.info(f"✓ {len(consolidated_data['riders'])} riders")
    logging.info(f"✓ {len(set(d['directie_name'] for stage in consolidated_data['directie_leaderboard_by_stage'].values() for d in stage))} directies")
    logging.info("--- Processing Complete ---")


if __name__ == "__main__":
    main()