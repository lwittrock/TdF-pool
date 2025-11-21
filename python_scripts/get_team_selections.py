import json
import os

# Switch to control anonymization
ANONYMIZE = True  # Set to False to keep original names

# Define file paths
INPUT_FILE = 'data/Tourpoule 2025 - deelnemers.json'
OUTPUT_FILE = 'data/participant_selections_anon.json'

def reformat_rider_name(name_str):
    """
    Reformats a rider name from 'LastName FirstName' to 'FirstName LastName'.
    Handles multi-word last names (e.g., 'Van der Poel Mathieu' -> 'Mathieu Van der Poel').
    """
    if not isinstance(name_str, str) or ' ' not in name_str:
        return name_str

    parts = name_str.strip().split()
    if len(parts) < 2:
        return name_str

    first_name = parts[-1]
    last_name = ' '.join(parts[:-1])
    return f"{first_name} {last_name}"

def validate_participant_data(data):
    """
    Validates participant data for common issues.
    Returns (is_valid, error_messages)
    """
    errors = []
    all_riders = set()
    
    for idx, entry in enumerate(data):
        participant_name = entry.get('name', f'Unknown #{idx+1}')
        
        # Check required fields
        if 'name' not in entry:
            errors.append(f"Participant #{idx+1}: Missing 'name' field")
        if 'main_riders' not in entry:
            errors.append(f"{participant_name}: Missing 'main_riders' field")
            continue
            
        main_riders = entry.get('main_riders', [])
        reserve_rider = entry.get('reserve_rider', '')
        
        # Check for empty or invalid main_riders
        if not isinstance(main_riders, list):
            errors.append(f"{participant_name}: 'main_riders' must be a list")
            continue
        if len(main_riders) == 0:
            errors.append(f"{participant_name}: No main riders selected")
        
        # Check for duplicate riders within a participant's selection
        participant_riders = main_riders.copy()
        if reserve_rider:
            participant_riders.append(reserve_rider)
        
        if len(participant_riders) != len(set(participant_riders)):
            duplicates = [r for r in participant_riders if participant_riders.count(r) > 1]
            errors.append(f"{participant_name}: Duplicate riders in selection: {set(duplicates)}")
        
        # Check for riders selected by multiple participants
        for rider in participant_riders:
            if rider in all_riders:
                errors.append(f"{participant_name}: Rider '{rider}' already selected by another participant")
            all_riders.add(rider)
    
    return len(errors) == 0, errors

def anonymize_data(data):
    """
    Anonymizes participant names, replacing them with "deelnemer X" 
    unless the name is "Lars Wittrock".
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
    Reads participant data from a JSON file, validates it, optionally anonymizes it,
    and writes the processed data to a new JSON file.
    """
    try:
        # Read the original data
        with open(input_filepath, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
        
        print(f"Loaded {len(original_data)} participants from {input_filepath}")
        
        # Validate data
        is_valid, errors = validate_participant_data(original_data)
        
        if not is_valid:
            print("\n⚠️  Validation Errors Found:")
            for error in errors:
                print(f"  - {error}")
            print("\nContinuing anyway, but please review these issues.\n")
        else:
            print("✓ Data validation passed")
        
        # Anonymize if requested
        if ANONYMIZE:
            processed_data = anonymize_data(original_data)
            print(f"✓ Anonymized participant names (except Lars Wittrock)")
        else:
            processed_data = original_data
            print("✓ Keeping original participant names")
        
        # Ensure output directory exists
        output_dir = os.path.dirname(output_filepath)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # Write processed data
        with open(output_filepath, 'w', encoding='utf-8') as f:
            json.dump(processed_data, f, indent=4, ensure_ascii=False)
        
        print(f"✓ Saved processed data to: {output_filepath}")
        
        # Print summary statistics
        total_main_riders = sum(len(p.get('main_riders', [])) for p in processed_data)
        total_reserves = sum(1 for p in processed_data if p.get('reserve_rider'))
        print(f"\nSummary:")
        print(f"  - Total participants: {len(processed_data)}")
        print(f"  - Total main riders: {total_main_riders}")
        print(f"  - Total reserve riders: {total_reserves}")
        
    except FileNotFoundError:
        print(f"❌ Error: Input file '{input_filepath}' not found.")
    except json.JSONDecodeError as e:
        print(f"❌ Error: Could not decode JSON from '{input_filepath}'")
        print(f"   {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    process_tourpoule_data(INPUT_FILE, OUTPUT_FILE)