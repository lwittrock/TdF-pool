import os
import json
import re
from collections import defaultdict
from datetime import datetime
import shutil


# Directory structure
DATA_DIR = 'data'
STAGE_DATA_DIR = os.path.join(DATA_DIR, 'stage_results')
CALC_POINTS_DIR = os.path.join(DATA_DIR, 'points')

WEB_OUTPUT_DIR = 'docs'
WEB_DATA_DIR = os.path.join(WEB_OUTPUT_DIR, 'data')
WEB_POINTS_DIR = os.path.join(WEB_DATA_DIR, 'points')

# Output file paths
RIDER_CUMULATIVE_POINTS_FILE = os.path.join(CALC_POINTS_DIR, 'rider_cumulative_points.json')
PARTICIPANT_CUMULATIVE_POINTS_FILE = os.path.join(CALC_POINTS_DIR, 'participant_cumulative_points.json')

RIDER_STAGE_POINTS_HISTORY_FILE = os.path.join(CALC_POINTS_DIR, 'rider_stage_points.json')
PARTICIPANT_STAGE_POINTS_HISTORY_FILE = os.path.join(CALC_POINTS_DIR, 'participant_stage_points.json')

# Input file path
PARTICIPANT_SELECTIONS_FILE = os.path.join(DATA_DIR, 'participant_selections_anon.json')



# --- Main Execution ---
if __name__ == "__main__":

    try:
        # Copy calculated points files and participant_selections_anon.json to correct web directories
        files_to_copy = [
            (RIDER_CUMULATIVE_POINTS_FILE, WEB_POINTS_DIR),
            (PARTICIPANT_CUMULATIVE_POINTS_FILE, WEB_POINTS_DIR),
            (RIDER_STAGE_POINTS_HISTORY_FILE, WEB_POINTS_DIR),
            (PARTICIPANT_STAGE_POINTS_HISTORY_FILE, WEB_POINTS_DIR),
            (os.path.join(DATA_DIR, 'participant_selections_anon.json'), WEB_DATA_DIR)
        ]
        for src_path, dest_dir in files_to_copy:
            if os.path.exists(src_path):
                shutil.copy(src_path, dest_dir)
                print(f"Copied {os.path.basename(src_path)} to {dest_dir}")
            else:
                print(f"Warning: {src_path} does not exist. Skipping copy.")
        
        # Copy stage results files
        src_real_stages_dir = STAGE_DATA_DIR
        dest_real_stages_dir = os.path.join(WEB_DATA_DIR, 'stage_results') # Copy directly to stage_results in web output

        if os.path.exists(dest_real_stages_dir):
            shutil.rmtree(dest_real_stages_dir)
            print(f"Removed existing '{dest_real_stages_dir}'")
        if os.path.exists(src_real_stages_dir):
            shutil.copytree(src_real_stages_dir, dest_real_stages_dir)
            print(f"Copied real stages directory.")
        else:
            print(f"Warning: Source real stages directory '{src_real_stages_dir}' does not exist. Skipping copy.")

    except Exception as e:
        print(f"Error copying files to web directory: {e}")
