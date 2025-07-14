import json
import os
from procyclingstats import Stage

# --- Directory and File Naming Configuration ---
DATA_DIR = 'data'
STAGE_DATA_DIR = os.path.join(DATA_DIR, 'stage_results')

# Set the stage number for the desired Tour de France stage
stage_number = 3

# URL for Tour de France 2025 Stage on ProCyclingStats
stage_url = f"race/tour-de-france/2025/stage-{stage_number}/result"

# Define the filename
filename = f"stage_{stage_number}.json"

try:
    # Create the directory if it doesn't exist
    os.makedirs(STAGE_DATA_DIR, exist_ok=True)
    print(f"Ensured output directory exists: {STAGE_DATA_DIR}")

    # Create a Stage object
    stage = Stage(stage_url)

    # Parse all available data for the stage
    full_stage_data = stage.parse()

    # --- Extracting Specific Data ---
    extracted_data = {}

    # --- Add Stage Information ---
    stage_info = {}
    stage_info['date'] = full_stage_data.get('date', 'N/A')
    stage_info['distance'] = full_stage_data.get('distance', 'N/A') # 'distance' is often used for length in km
    stage_info['departure_city'] = full_stage_data.get('departure', 'N/A') 
    stage_info['arrival_city'] = full_stage_data.get('arrival', 'N/A')     # Corrected: 'end_city' for arrival
    stage_info['stage_type_category'] = full_stage_data.get('stage_type', 'N/A')

    # --- Add Stage Difficulty based on profile_icon() ---
    try:
        profile_icon_value = stage.profile_icon()

        # Mapping based on ProCyclingStats documentation
        difficulty_map = {
            'p0': 'N/A',
            'p1': 'Flat',
            'p2': 'Hills, flat finish',
            'p3': 'Hills, uphill finish',
            'p4': 'Mountains, flat finish',
            'p5': 'Mountains, uphill finish'
        }
        stage_info['stage_difficulty'] = difficulty_map.get(profile_icon_value, 'Unknown')

    except Exception as e:
        stage_info['stage_difficulty'] = 'N/A'
        stage_info['stage_difficulty'] = 'Could not retrieve profile icon'
        print(f"Warning: Could not get stage profile icon: {e}")

    stage_info['won_how'] = full_stage_data.get('won_how', 'N/A')

    extracted_data['stage_info'] = stage_info

    # Get top 20 quickest finishers (from 'results') with only rider_name, rank, and time
    if 'results' in full_stage_data and isinstance(full_stage_data['results'], list):
        extracted_data['top_20_finishers'] = [
            {
                "rider_name": rider.get("rider_name"),
                "rank": rider.get("rank"),
                "time": rider.get("time") # Raw time for each rider
            }
            for rider in full_stage_data['results'][:20]
        ]
    else:
        extracted_data['top_20_finishers'] = []
        print("Warning: 'results' not found or not a list in the parsed data.")

    # Helper function to extract specific fields for top riders (no time for these)
    def extract_top_rider_info(rider_data):
        if rider_data:
            return {
                "rider_name": rider_data.get("rider_name"),
                "rank": rider_data.get("rank") # Corrected: Use rider_data here
            }
        return None

    # Get top GC rider
    if 'gc' in full_stage_data and isinstance(full_stage_data['gc'], list) and full_stage_data['gc']:
        extracted_data['top_gc_rider'] = extract_top_rider_info(full_stage_data['gc'][0])
    else:
        extracted_data['top_gc_rider'] = None
        print("Warning: 'gc' data not found or empty.")

    # Get top KOM rider
    if 'kom' in full_stage_data and isinstance(full_stage_data['kom'], list) and full_stage_data['kom']:
        extracted_data['top_kom_rider'] = extract_top_rider_info(full_stage_data['kom'][0])
    else:
        extracted_data['top_kom_rider'] = None
        print("Warning: 'kom' data not found or empty.")

    # Get top Points rider
    if 'points' in full_stage_data and isinstance(full_stage_data['points'], list) and full_stage_data['points']:
        extracted_data['top_points_rider'] = extract_top_rider_info(full_stage_data['points'][0])
    else:
        extracted_data['top_points_rider'] = None
        print("Warning: 'points' data not found or empty.")

    # Get top Youth rider
    if 'youth' in full_stage_data and isinstance(full_stage_data['youth'], list) and full_stage_data['youth']:
        extracted_data['top_youth_rider'] = extract_top_rider_info(full_stage_data['youth'][0])
    else:
        extracted_data['top_youth_rider'] = None
        print("Warning: 'youth' data not found or empty.")

    # Create the full path for the file
    filepath = os.path.join(STAGE_DATA_DIR, filename)

    # Save the extracted data to a JSON file
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(extracted_data, f, ensure_ascii=False, indent=4)

    print(f"Successfully extracted and saved specific data for Tour de France 2025 Stage 6 to {filepath}")

except Exception as e:
    print(f"An error occurred: {e}")
