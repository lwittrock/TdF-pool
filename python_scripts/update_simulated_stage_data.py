import json
import os
import re

SIMULATED_DATA_DIR = 'data/simulated_stages'

def update_stage_data_with_details():
    """
    Adds placeholder start_location, finish_location, distance_km, and stage_type
    to existing simulated stage data JSON files.
    """
    if not os.path.exists(SIMULATED_DATA_DIR):
        print(f"Error: Directory '{SIMULATED_DATA_DIR}' not found. Please ensure simulated stage data exists (e.g., from a previous run of 'scrape_pcs' or a custom simulation).")
        return

    print(f"Updating simulated stage data in '{SIMULATED_DATA_DIR}'...")

    for filename in os.listdir(SIMULATED_DATA_DIR):
        if filename.startswith('stage_') and filename.endswith('_data.json'):
            filepath = os.path.join(SIMULATED_DATA_DIR, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    stage_data = json.load(f)

                # Extract stage number from filename for dynamic placeholders
                match = re.match(r'stage_(\d+)_data\.json', filename)
                stage_number_for_placeholder = int(match.group(1)) if match else 1

                # Add new fields if they don't exist
                # Using dummy values that can be manually edited later for real stages
                stage_data.setdefault('start_location', f'Startplaats Etappe {stage_number_for_placeholder}')
                stage_data.setdefault('finish_location', f'Finishplaats Etappe {stage_number_for_placeholder}')
                stage_data.setdefault('distance_km', 150 + (stage_number_for_placeholder * 5) % 50) # Example: varying distance
                
                # Cycle through stage types for variety
                stage_types = ["Vlakke rit", "Heuvelachtige rit", "Bergetappe", "Individuele Tijdrit", "Ploegentijdrit"]
                stage_type_index = (stage_number_for_placeholder - 1) % len(stage_types)
                stage_data.setdefault('stage_type', stage_types[stage_type_index])

                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(stage_data, f, indent=4, ensure_ascii=False)
                print(f"Updated {filename}")

            except json.JSONDecodeError:
                print(f"Error: Could not decode JSON from {filename}. Skipping.")
            except Exception as e:
                print(f"An error occurred while processing {filename}: {e}")

    print("Finished updating simulated stage data.")
    print("Remember to run 'python -m python_scripts.calculate_points' next to copy these updates to your 'docs/data' folder.")

if __name__ == "__main__":
    update_stage_data_with_details()