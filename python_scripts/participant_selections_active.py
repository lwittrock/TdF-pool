import json
import os

# --- Configuration ---
DATA_DIR = 'data'
STAGE_RESULTS_DIR = os.path.join(DATA_DIR, 'stage_results')
# Input file for initial participant selections
INITIAL_TEAMS_FILE = os.path.join(DATA_DIR, 'participant_selections_anon.json')
# Output directory for per-stage active rosters
PER_STAGE_ROSTER_OUTPUT_DIR = os.path.join(DATA_DIR, 'selection')

# --- Main Logic ---
def manage_rosters(up_to_stage_number):
    """
    Manages active and reserve rider rosters for participants based on stage results.
    For each stage, it identifies DNF/DNS/OTL/DSQ riders and replaces them with reserves
    for the next stage. Output is a separate JSON file for each stage's roster state.
    """
    # Ensure the main data directory and the specific output directory exist
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(PER_STAGE_ROSTER_OUTPUT_DIR, exist_ok=True)
    print(f"Ensured data directory exists: {DATA_DIR}")
    print(f"Ensured per-stage roster output directory exists: {PER_STAGE_ROSTER_OUTPUT_DIR}")

    participants_data = [] # This will be a list of participant dictionaries, updated per stage

    # Load initial participant configurations from the specified JSON file
    try:
        with open(INITIAL_TEAMS_FILE, 'r', encoding='utf-8') as f:
            raw_participants_data = json.load(f)
        print(f"Loaded initial participant selections from {INITIAL_TEAMS_FILE}")

        # Pre-process raw_participants_data into our internal working format
        # This converts 'main_riders' to 'active_riders' and 'reserve_rider' (string) to 'reserve_riders' (list)
        for participant in raw_participants_data:
            # Create a mutable copy to avoid modifying the loop variable directly if needed
            processed_participant = participant.copy()

            # Rename 'main_riders' to 'active_riders' for internal consistency
            processed_participant['active_riders'] = processed_participant.pop('main_riders', [])

            # Convert 'reserve_rider' string to a list for easier management (pop/append)
            # If 'reserve_rider' is an empty string or None, it results in an empty list
            reserve_rider_name = processed_participant.pop('reserve_rider', None)
            processed_participant['reserve_riders'] = [reserve_rider_name] if reserve_rider_name else []
            
            # Add a log for tracking substitutions within each participant's data
            processed_participant['substitution_log'] = []
            
            participants_data.append(processed_participant)

    except FileNotFoundError:
        print(f"Error: Initial participant selection file '{INITIAL_TEAMS_FILE}' not found. "
              "Please ensure it exists in the 'data' folder and is correctly named.")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{INITIAL_TEAMS_FILE}'. "
              "Check its format for syntax errors (e.g., missing commas, unclosed brackets).")
        return
    except Exception as e:
        print(f"An unexpected error occurred during initial data loading: {e}")
        return

    # Process each stage sequentially
    for stage_num in range(1, up_to_stage_number + 1):
        stage_filepath = os.path.join(STAGE_RESULTS_DIR, f'stage_{stage_num}.json')
        # Define the output file path for this specific stage's roster state
        roster_output_filepath = os.path.join(PER_STAGE_ROSTER_OUTPUT_DIR, 
                                              f'participant_selection_active_stage_{stage_num}.json')

        print(f"\n--- Processing Stage {stage_num} ---")

        try:
            with open(stage_filepath, 'r', encoding='utf-8') as f:
                stage_data = json.load(f)
            print(f"Loaded stage results from {stage_filepath}")
        except FileNotFoundError:
            print(f"Warning: Stage results file '{stage_filepath}' not found. "
                  f"Skipping stage {stage_num}. Rosters remain unchanged from the previous stage.")
            # If a stage file is missing, save the current roster state to its own file,
            # indicating no changes happened for this stage due to missing data.
            with open(roster_output_filepath, 'w', encoding='utf-8') as f:
                json.dump(participants_data, f, ensure_ascii=False, indent=4)
            continue # Move to the next stage
        except json.JSONDecodeError:
            print(f"Error: Could not decode JSON from '{stage_filepath}'. "
                  f"Skipping stage {stage_num}. Rosters remain unchanged.")
            with open(roster_output_filepath, 'w', encoding='utf-8') as f:
                json.dump(participants_data, f, ensure_ascii=False, indent=4)
            continue
        except Exception as e:
            print(f"An unexpected error occurred while processing stage {stage_num} results: {e}")
            with open(roster_output_filepath, 'w', encoding='utf-8') as f:
                json.dump(participants_data, f, ensure_ascii=False, indent=4)
            continue


        # Get the set of all non-finishing riders for this stage
        dnf_riders_this_stage = set(stage_data.get('dnf_riders', []))
        
        if dnf_riders_this_stage:
            print(f"Riders out of race (DNF/DNS/OTL/DSQ) in Stage {stage_num}: {', '.join(sorted(dnf_riders_this_stage))}")
        else:
            print(f"No riders out of race reported for Stage {stage_num}.")

        # Update rosters for each participant
        for participant in participants_data:
            participant_name = participant['name']
            active_riders = participant.get('active_riders', [])
            reserve_riders = participant.get('reserve_riders', []) # This will be a list of 0 or 1 item
            
            new_active_riders = []
            riders_dnf_from_team_this_stage = []

            # Identify active riders from this participant's team who DNF'd in this stage
            for rider in active_riders:
                if rider in dnf_riders_this_stage:
                    riders_dnf_from_team_this_stage.append(rider)
                    print(f"  {participant_name}: Rider '{rider}' from their active team DNF'd in Stage {stage_num}.")
                else:
                    new_active_riders.append(rider)
            
            # Perform substitutions for DNF'd riders
            for dnf_rider_from_team in riders_dnf_from_team_this_stage:
                if reserve_riders: # Check if there's any reserve left in the list (length > 0)
                    replacement_rider = reserve_riders.pop(0) # Get and remove the first (and only) reserve
                    new_active_riders.append(replacement_rider)
                    # Log the substitution
                    participant['substitution_log'].append({
                        "stage": stage_num,
                        "out_rider": dnf_rider_from_team,
                        "in_rider": replacement_rider
                    })
                    print(f"    {participant_name}: Replaced '{dnf_rider_from_team}' with reserve '{replacement_rider}'.")
                else:
                    print(f"    {participant_name}: No reserve available for '{dnf_rider_from_team}'. Team will have one less rider.")
                    # Log that no replacement was made
                    participant['substitution_log'].append({
                        "stage": stage_num,
                        "out_rider": dnf_rider_from_team,
                        "in_rider": None # Indicate no replacement
                    })
            
            # Update the participant's roster for the next stage
            participant['active_riders'] = new_active_riders
            # participant['reserve_riders'] is already updated by .pop(0) if a substitution occurred

        # After processing ALL participants for the current stage, save the combined state
        # to a new file specific to this stage number.
        with open(roster_output_filepath, 'w', encoding='utf-8') as f:
            json.dump(participants_data, f, ensure_ascii=False, indent=4)
        print(f"Saved current active rosters after Stage {stage_num} to {roster_output_filepath}")

    print("\n--- Roster Management Complete ---")
    print(f"Per-stage active rosters are saved in: {PER_STAGE_ROSTER_OUTPUT_DIR}")

if __name__ == "__main__":
    # Set the latest stage number you want to process up to.
    # This should correspond to the 'current_stage_number' in your scraping script
    # and the number of stage_X.json files available in data/stage_results/.
    latest_stage_to_process = 12
    manage_rosters(latest_stage_to_process)