import json
import os
from procyclingstats import Stage
import unicodedata

# --- Directory and File Naming Configuration ---
DATA_DIR = 'data'
STAGE_DATA_DIR = os.path.join(DATA_DIR, 'stage_results')

# Set the stage number for the desired Tour de France stage
current_stage_number = 12  # Set this to the latest stage you want to scrape

# --- Helper function to reformat rider names ---
def reformat_rider_name(name_str):
    """
    Attempts to reformat a rider name from 'LastName FirstName' to 'FirstName LastName'.
    Handles multi-word first names and multi-word last names.
    Special case: for names containing 'Garcia' and 'Pierna', treat the last word as first name and the first two as surname (e.g., 'GARCÍA PIERNA Raúl' -> 'Raúl García Pierna').
    General case: for names where the last N words are surname prefixes and there are at least 3 words (e.g., 'VAN DEN BROEK Frank'), output 'Frank van den Broek'.
    This version aims for "Proper Case" (e.g., "Tadej Pogacar") without forcing lowercase.
    It also normalizes Unicode characters (e.g., 'č' to 'c').
    """
    if not isinstance(name_str, str) or not name_str.strip():
        return name_str.strip()

    # Normalize Unicode characters: decompose into base character and diacritic, then encode to ASCII
    # and decode back, effectively removing diacritics.
    normalized_name_str = unicodedata.normalize('NFKD', name_str).encode('ascii', 'ignore').decode('utf-8')
    parts = normalized_name_str.strip().split(' ')
    surname_prefixes = {'van', 'der', 'de', 'den', 'le', 'dos', 'da', 'di', 'del', 'la'}

    def _proper_case_part(part):
        lower_part = part.lower()
        if lower_part in surname_prefixes:
            return lower_part
        return part.title()

    if len(parts) < 2:
        return _proper_case_part(parts[0]) if parts else ""

    # Manual fix for Spanish double surname 'Garcia Pierna'
    if len(parts) == 3 and parts[0].lower() == 'garcia' and parts[1].lower() == 'pierna':
        first_name = _proper_case_part(parts[2])
        last_name = f"{_proper_case_part(parts[0])} {_proper_case_part(parts[1])}"
        return f"{first_name} {last_name}"

    # General fix for surname prefixes at the start (e.g., 'VAN DEN BROEK Frank' -> 'Frank van den Broek')
    if len(parts) >= 3 and parts[-1].istitle():
        # Find the longest sequence of surname prefixes at the start
        i = 0
        prefix_sequence = []
        while i < len(parts) - 1 and parts[i].lower() in surname_prefixes:
            prefix_sequence.append(_proper_case_part(parts[i]))
            i += 1
        if prefix_sequence:
            surname = ' '.join(prefix_sequence + [ _proper_case_part(parts[i]) ])
            first_name = _proper_case_part(parts[-1])
            return f"{first_name} {surname}"

    # General fix for surname prefixes at the end (e.g., 'Berg Marijn van Den' -> 'Marijn van den Berg')
    if len(parts) >= 3:
        i = len(parts) - 1
        prefix_sequence = []
        while i > 0 and parts[i].lower() in surname_prefixes:
            prefix_sequence.insert(0, _proper_case_part(parts[i]))
            i -= 1
        if prefix_sequence:
            first_name = _proper_case_part(parts[i])
            surname = ' '.join(prefix_sequence + [ _proper_case_part(parts[0]) ])
            return f"{first_name} {surname}"

    if len(parts) > 2 and parts[-2].istitle() and parts[-1].istitle():
        first_name = ' '.join(_proper_case_part(p) for p in parts[-2:])
        last_name = ' '.join(_proper_case_part(p) for p in parts[:-2])
    else:
        first_name = _proper_case_part(parts[-1])
        last_name = ' '.join(_proper_case_part(p) for p in parts[:-1])

    return f"{first_name} {last_name}"

def scrape_all_stages(up_to_stage):
    os.makedirs(STAGE_DATA_DIR, exist_ok=True)
    print(f"Ensured output directory exists: {STAGE_DATA_DIR}")
    for stage_number in range(1, up_to_stage + 1):
        stage_url = f"race/tour-de-france/2025/stage-{stage_number}/result"
        filename = f"stage_{stage_number}.json"
        filepath = os.path.join(STAGE_DATA_DIR, filename)
        try:
            print(f"Scraping stage {stage_number}...")
            stage = Stage(stage_url)
            full_stage_data = stage.parse()
            extracted_data = {}
            stage_info = {}
            stage_info['date'] = full_stage_data.get('date', 'N/A')
            stage_info['distance'] = full_stage_data.get('distance', 'N/A')
            stage_info['departure_city'] = full_stage_data.get('departure', 'N/A')
            stage_info['arrival_city'] = full_stage_data.get('arrival', 'N/A')
            stage_info['stage_type_category'] = full_stage_data.get('stage_type', 'N/A')
            try:
                profile_icon_value = stage.profile_icon()
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
                print(f"Warning: Could not get stage profile icon for stage {stage_number}: {e}")
            stage_info['won_how'] = full_stage_data.get('won_how', 'N/A')
            extracted_data['stage_info'] = stage_info
            
            # Initialize combined DNF list and list for all finished riders
            extracted_data['dnf_riders'] = []
            all_finished_riders = []

            if 'results' in full_stage_data and isinstance(full_stage_data['results'], list):
                for rider in full_stage_data['results']:
                    rider_status = rider.get("status")
                    rider_name_formatted = reformat_rider_name(rider.get("rider_name"))
                    
                    if rider_status in ['DNF', 'DNS', 'OTL', 'DSQ']:
                        extracted_data['dnf_riders'].append(rider_name_formatted)
                    else: # Assuming 'DF' or other finishing status
                        # Only include relevant fields for finished riders
                        finished_rider_entry = {
                            "rider_name": rider_name_formatted,
                            "rank": rider.get("rank"),
                            "time": rider.get("time")
                        }
                        all_finished_riders.append(finished_rider_entry)

                # Your existing top 20 logic, now using the filtered all_finished_riders
                extracted_data['top_20_finishers'] = all_finished_riders[:20]
                
            else:
                extracted_data['top_20_finishers'] = []
                print(f"Warning: 'results' not found or not a list in the parsed data for stage {stage_number}.")
            
            # Continue with your existing top rider extractions for classifications
            def extract_top_rider_info(rider_data):
                if rider_data:
                    name_to_format = rider_data.get("rider_name") if isinstance(rider_data, dict) else rider_data
                    return {
                        "rider_name": reformat_rider_name(name_to_format),
                        "rank": rider_data.get("rank") if isinstance(rider_data, dict) else None
                    }
                return None
            
            if 'gc' in full_stage_data and isinstance(full_stage_data['gc'], list) and full_stage_data['gc']:
                extracted_data['top_gc_rider'] = extract_top_rider_info(full_stage_data['gc'][0])
            else:
                extracted_data['top_gc_rider'] = None
                print(f"Warning: 'gc' data not found or empty for stage {stage_number}.")
            if 'kom' in full_stage_data and isinstance(full_stage_data['kom'], list) and full_stage_data['kom']:
                extracted_data['top_kom_rider'] = extract_top_rider_info(full_stage_data['kom'][0])
            else:
                extracted_data['top_kom_rider'] = None
                print(f"Warning: 'kom' data not found or empty for stage {stage_number}.")
            if 'points' in full_stage_data and isinstance(full_stage_data['points'], list) and full_stage_data['points']:
                extracted_data['top_points_rider'] = extract_top_rider_info(full_stage_data['points'][0])
            else:
                extracted_data['top_points_rider'] = None
                print(f"Warning: 'points' data not found or empty for stage {stage_number}.")
            if 'youth' in full_stage_data and isinstance(full_stage_data['youth'], list) and full_stage_data['youth']:
                extracted_data['top_youth_rider'] = extract_top_rider_info(full_stage_data['youth'][0])
            else:
                extracted_data['top_youth_rider'] = None
                print(f"Warning: 'youth' data not found or empty for stage {stage_number}.")
            if 'combative_rider' in full_stage_data and full_stage_data['combative_rider']:
                combative_rider_data = full_stage_data['combative_rider']
                if isinstance(combative_rider_data, dict):
                    name_to_format = combative_rider_data.get('rider_name')
                    rank = combative_rider_data.get('rank', 1)
                else:
                    name_to_format = combative_rider_data
                    rank = 1
                extracted_data['combative_rider'] = {
                    "rider_name": reformat_rider_name(name_to_format),
                    "rank": rank
                }
            else:
                extracted_data['combative_rider'] = None
                print(f"Warning: 'combative_rider' data not found for stage {stage_number}.")
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(extracted_data, f, ensure_ascii=False, indent=4)
            print(f"Successfully extracted and saved specific data for Tour de France 2025 Stage {stage_number} to {filepath}")
        except Exception as e:
            print(f"Error scraping stage {stage_number}: {e}")
            continue

if __name__ == "__main__":
    scrape_all_stages(current_stage_number)