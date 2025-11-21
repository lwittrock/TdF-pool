import json
import os

# --- Configuration ---
DATA_DIR = 'data'
STAGE_DATA_DIR = os.path.join(DATA_DIR, 'stage_results')

def create_stage_template():
    """Returns a template dictionary for a stage with all required fields."""
    return {
        "stage_info": {
            "date": "",
            "distance": "",
            "departure_city": "",
            "arrival_city": "",
            "stage_type_category": "",
            "stage_difficulty": "",
            "won_how": ""
        },
        "dnf_riders": [],
        "top_20_finishers": [],
        "top_gc_rider": None,
        "top_kom_rider": None,
        "top_points_rider": None,
        "top_youth_rider": None,
        "combative_rider": None
    }

def add_dnf_rider_interactive():
    """Prompts user to add a DNF rider and returns the dictionary."""
    print("\n--- Add DNF/DNS/OTL/DSQ Rider ---")
    rider_name = input("Rider name (FirstName LastName): ").strip()
    if not rider_name:
        return None
    
    team_name = input("Team name (optional, press Enter to skip): ").strip() or "N/A"
    rider_number = input("Rider number (optional, press Enter to skip): ").strip() or "N/A"
    
    print("\nStatus options: DNF, DNS, OTL, DSQ")
    status = input("Status (default: DNF): ").strip().upper() or "DNF"
    
    return {
        "rider_name": rider_name,
        "team_name": team_name,
        "rider_number": rider_number,
        "status": status
    }

def manual_entry_simplified(stage_number):
    """
    Simplified manual entry for a stage - only requires DNF riders.
    Other fields can be left empty or filled later.
    """
    os.makedirs(STAGE_DATA_DIR, exist_ok=True)
    
    filepath = os.path.join(STAGE_DATA_DIR, f'stage_{stage_number}.json')
    
    # Check if file already exists
    if os.path.exists(filepath):
        print(f"\n⚠️  Stage {stage_number} file already exists!")
        overwrite = input("Do you want to overwrite it? (yes/no): ").strip().lower()
        if overwrite not in ['yes', 'y']:
            print("Cancelled.")
            return
    
    print(f"\n{'='*50}")
    print(f"Creating Stage {stage_number} Data File")
    print(f"{'='*50}")
    print("\nYou can leave most fields empty and just add DNF riders.")
    print("Press Enter to skip optional fields.\n")
    
    stage_data = create_stage_template()
    
    # Basic stage info (optional)
    print("--- Stage Info (optional) ---")
    date = input("Date (YYYY-MM-DD): ").strip()
    if date:
        stage_data["stage_info"]["date"] = date
        stage_data["stage_info"]["distance"] = input("Distance (e.g., '185.5 km'): ").strip()
        stage_data["stage_info"]["departure_city"] = input("Departure city: ").strip()
        stage_data["stage_info"]["arrival_city"] = input("Arrival city: ").strip()
    
    # DNF riders (the important part!)
    print("\n--- DNF/DNS/OTL/DSQ Riders ---")
    print("Add riders who did not finish or did not start.")
    
    while True:
        dnf_rider = add_dnf_rider_interactive()
        if dnf_rider:
            stage_data["dnf_riders"].append(dnf_rider)
            print(f"✓ Added: {dnf_rider['rider_name']} ({dnf_rider['status']})")
        
        more = input("\nAdd another DNF rider? (yes/no): ").strip().lower()
        if more not in ['yes', 'y']:
            break
    
    # Save the file
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(stage_data, f, ensure_ascii=False, indent=4)
        
        print(f"\n{'='*50}")
        print(f"✓ Stage {stage_number} saved to: {filepath}")
        print(f"  - DNF riders: {len(stage_data['dnf_riders'])}")
        print(f"{'='*50}")
        
    except Exception as e:
        print(f"\n❌ Error saving file: {e}")

def quick_dnf_entry(stage_number, dnf_riders_list):
    """
    Quick entry method - just provide stage number and list of DNF rider names.
    Example: quick_dnf_entry(1, ["Filippo Ganna", "Stefan Bissegger"])
    """
    os.makedirs(STAGE_DATA_DIR, exist_ok=True)
    filepath = os.path.join(STAGE_DATA_DIR, f'stage_{stage_number}.json')
    
    stage_data = create_stage_template()
    
    for rider_name in dnf_riders_list:
        stage_data["dnf_riders"].append({
            "rider_name": rider_name,
            "team_name": "N/A",
            "rider_number": "N/A",
            "status": "DNF"
        })
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(stage_data, f, ensure_ascii=False, indent=4)
    
    print(f"✓ Stage {stage_number} created with {len(dnf_riders_list)} DNF riders")
    return filepath

if __name__ == "__main__":
    print("Manual Stage Entry Tool")
    print("=" * 50)
    print("\nOptions:")
    print("1. Interactive mode (guided entry)")
    print("2. Quick mode (code examples below)")
    print("\nFor quick mode, edit this script and uncomment examples:")
    print("# quick_dnf_entry(1, ['Filippo Ganna', 'Stefan Bissegger'])")
    print("# quick_dnf_entry(3, ['Jasper Philipsen'])")
    print()
    
    choice = input("Choose mode (1 or 2): ").strip()
    
    if choice == "1":
        stage_num = input("\nEnter stage number: ").strip()
        if stage_num.isdigit():
            manual_entry_simplified(int(stage_num))
        else:
            print("Invalid stage number")
    elif choice == "2":
        print("\nQuick mode - uncomment and run the examples in the script!")
        print("\nExample usage:")
        print("quick_dnf_entry(1, ['Filippo Ganna', 'Stefan Bissegger'])")
        print("quick_dnf_entry(3, ['Jasper Philipsen'])")
        
        # Uncomment these lines to use quick mode:
        # quick_dnf_entry(1, ['Filippo Ganna', 'Stefan Bissegger'])
        # quick_dnf_entry(3, ['Jasper Philipsen'])
    else:
        print("Invalid choice")