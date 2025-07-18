import json
import os
from procyclingstats import RaceStartlist

# Define file paths
input_file = 'data/Tourpoule 2025 - deelnemers.json'
output_file = 'data/participant_selections_anon.json'

# --- Helper function to reformat rider names ---
def reformat_rider_name(name_str):
    """
    Attempts to reformat a rider name from 'LastName FirstName' to 'FirstName LastName'.
    Assumes the first name is the last word in the string.
    Handles multi-word last names correctly (e.g., 'Van der Poel Mathieu' -> 'Mathieu Van der Poel').
    """
    if not isinstance(name_str, str) or ' ' not in name_str:
        return name_str # Return as is if not a string or single word

    parts = name_str.split(' ')
    if len(parts) < 2:
        return name_str # Cannot reformat if less than two words

    first_name = parts[-1]
    last_name_parts = parts[:-1]
    
    # Join the last name parts back together
    last_name = ' '.join(last_name_parts)

    return f"{first_name} {last_name}"

def anonymize_data(data):
    """
    Anonymizes participant names in a list of dictionaries,
    replacing them with "deelnemer X" unless the name is "Lars Wittrock".
    """
    anonymized_data = []
    participant_count = 1
    for entry in data:
        new_entry = entry.copy()
        if new_entry.get("name") != "Lars Wittrock":
            new_entry["name"] = f"deelnemer {participant_count}"
            participant_count += 1
        anonymized_data.append(new_entry)
    return anonymized_data

def process_tourpoule_data(input_filepath, output_filepath):
    """
    Reads participant data from a JSON file, anonymizes it,
    and writes the anonymized data to a new JSON file.
    Args:
        input_filepath (str): The path to the original JSON file.
        output_filepath (str): The path where the anonymized JSON data will be saved.
    """
    try:
        # Read the original data from the input file
        with open(input_filepath, 'r', encoding='utf-8') as f:
            original_data = json.load(f)

        # Anonymize the data
        anonymized_output = anonymize_data(original_data)

        # Ensure the output directory exists
        output_dir = os.path.dirname(output_filepath)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # Write the anonymized data to the output file
        with open(output_filepath, 'w', encoding='utf-8') as f:
            json.dump(anonymized_output, f, indent=4, ensure_ascii=False)

        print(f"Anonymization complete. Data saved to: {output_filepath}")

    except FileNotFoundError:
        print(f"Error: The input file '{input_filepath}' was not found.")
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{input_filepath}'. Please check the file format.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

def get_tdf_startlist(year):
    """
    Fetches the official start list for the Tour de France for a given year
    from ProCyclingStats and reformats the rider names.
    Args:
        year (int): The year of the Tour de France.
    Returns:
        list: A list of reformatted rider names in the TDF start list,
              or an empty list if the data cannot be fetched.
    """
    try:
        url_path = f"race/tour-de-france/{year}/startlist"
        race_startlist = RaceStartlist(url_path)
        
        riders_data = race_startlist.startlist()
        
        # Apply the reformat_rider_name function to each rider name from ProCyclingStats
        reformatted_riders = [reformat_rider_name(rider['rider_name']) for rider in riders_data]
        
        print(f"Successfully fetched and reformatted Tour de France {year} start list.")
        return reformatted_riders
    except Exception as e:
        print(f"Error fetching TDF start list for {year}: {e}")
        return []

def compare_selections(participant_selections_file, tdf_startlist_year):
    """
    Compares riders in participant selections to the official TDF start list
    and identifies riders who are not on the TDF start list.
    Args:
        participant_selections_file (str): Path to the anonymized participant selections JSON.
        tdf_startlist_year (int): The year for the Tour de France start list to compare against.
    """
    try:
        with open(participant_selections_file, 'r', encoding='utf-8') as f:
            participant_data = json.load(f)

        # Get the official TDF start list (already reformatted)
        tdf_riders = get_tdf_startlist(tdf_startlist_year)
        if not tdf_riders:
            print("Cannot perform comparison without the TDF start list.")
            return

        # Convert TDF riders to a set for efficient lookup
        # Convert to lowercase for case-insensitive comparison
        tdf_riders_set = set(rider.lower() for rider in tdf_riders)
        
        # Dictionary to store riders in participant selections not found in TDF start list
        mismatched_riders = {}

        for participant_entry in participant_data:
            participant_name = participant_entry.get("name")
            selected_riders = participant_entry.get("riders", []) # Assuming 'riders' key holds the list of selected riders
            
            not_matching = []
            for rider in selected_riders:
                # Reformat participant rider names and convert to lowercase for comparison
                reformatted_rider = reformat_rider_name(rider).lower()
                if reformatted_rider not in tdf_riders_set: 
                    not_matching.append(rider) # Append the original rider name to the report
            
            if not_matching:
                mismatched_riders[participant_name] = not_matching
        
        if mismatched_riders:
            print("\n--- Riders in team selections NOT found in the official TDF start list ---")
            for participant, riders_not_found in mismatched_riders.items():
                print(f"- {participant}: {', '.join(riders_not_found)}")
            print("-------------------------------------------------------------------------")
        else:
            print("\nAll riders in participant selections match the official TDF start list.")

    except FileNotFoundError:
        print(f"Error: The file '{participant_selections_file}' was not found.")
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{participant_selections_file}'.")
    except Exception as e:
        print(f"An unexpected error occurred during comparison: {e}")

# --- Main execution ---
process_tourpoule_data(input_file, output_file)

# Compare selections with the official TDF start list for 2025
tdf_year_to_compare = 2025 
compare_selections(output_file, tdf_year_to_compare)