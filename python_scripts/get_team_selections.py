import json
import os

# Switch to control anonymization
ANONYMIZE = True  # Set to False to keep original names

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

        if ANONYMIZE:
            anonymized_output = anonymize_data(original_data)
        else:
            anonymized_output = original_data

        # Ensure the output directory exists
        output_dir = os.path.dirname(output_filepath)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # Write the anonymized data to the output file
        with open(output_filepath, 'w', encoding='utf-8') as f:
            json.dump(anonymized_output, f, indent=4, ensure_ascii=False)

        print(f"Data saved to: {output_filepath} (Anonymized: {ANONYMIZE})")

    except FileNotFoundError:
        print(f"Error: The input file '{input_filepath}' was not found.")
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{input_filepath}'. Please check the file format.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

# --- Main execution ---
process_tourpoule_data(input_file, output_file)
