import random
import time
import os # Import os for file path handling
import json # Import json for saving data

# Define a directory to store simulated stage data
SIMULATED_DATA_DIR = 'data/simulated_stages'

def simulate_pcs_stage_data(race_name, year, stage_number):
    """
    Simulates fetching stage results, GC standings, and jersey holders data
    for a given Tour de France stage.

    Args:
        race_name (str): The name of the race (e.g., "Tour de France").
        year (int): The year of the race (e.g., 2025).
        stage_number (int): The stage number (e.g., 1).

    Returns:
        tuple: A tuple containing (stage_results, gc_standings, jersey_holders).
               Returns (None, None, None) if data cannot be simulated (e.g., invalid stage).
    """
    print(f"Simulating data for {race_name} {year}, Stage {stage_number}...")

    # --- Simulate Stage Results ---
    stage_results = []
    riders_pool = [
        {"name": "Tadej Pogačar", "team": "UAD", "nationality": "SLO", "is_young": False, "is_climber": True},
        {"name": "Jonas Vingegaard", "team": "TVL", "nationality": "DEN", "is_young": False, "is_climber": True},
        {"name": "Remco Evenepoel", "team": "SOQ", "nationality": "BEL", "is_young": True, "is_climber": True},
        {"name": "Primož Roglič", "team": "BOH", "nationality": "SLO", "is_young": False, "is_climber": False},
        {"name": "Juan Ayuso", "team": "UAD", "nationality": "ESP", "is_young": True, "is_climber": True},
        {"name": "Carlos Rodríguez", "team": "IGD", "nationality": "ESP", "is_young": True, "is_climber": False},
        {"name": "Mattias Skjelmose", "team": "LTK", "nationality": "DEN", "is_young": True, "is_climber": False},
        {"name": "Sepp Kuss", "team": "TVL", "nationality": "USA", "is_young": False, "is_climber": True},
        {"name": "João Almeida", "team": "UAD", "nationality": "POR", "is_young": False, "is_climber": False},
        {"name": "Ben O'Connor", "team": "DAT", "nationality": "AUS", "is_young": False, "is_climber": True},
        {"name": "Thymen Arensman", "team": "IGD", "nationality": "NED", "is_young": True, "is_climber": True},
        {"name": "Santiago Buitrago", "team": "TBV", "nationality": "COL", "is_young": True, "is_climber": True},
    ]

    riders_for_stage = list(riders_pool)
    random.seed(stage_number + year)
    random.shuffle(riders_for_stage)

    for i, rider in enumerate(riders_for_stage):
        rank = i + 1
        time_diff_seconds = i * random.randint(1, 5) if i > 0 else 0
        minutes = time_diff_seconds // 60
        seconds = time_diff_seconds % 60
        time_str = f"{minutes:02d}:{seconds:02d}" if minutes > 0 else f"00:{seconds:02d}"
        
        points = max(0, 20 - i * 2 + random.randint(-5, 5)) 

        stage_results.append({
            "rank": rank,
            "rider_name": rider["name"],
            "team": rider["team"],
            "time": time_str,
            "points": points,
            "bonification_seconds": random.choice([0, 3, 6, 10]) if rank <= 3 else 0,
            "url": f"rider/{rider['name'].lower().replace(' ', '-')}",
        })

    # --- Simulate GC Standings ---
    gc_standings = []
    gc_riders_base_order = [
        {"name": "Jonas Vingegaard", "team": "TVL", "nationality": "DEN"},
        {"name": "Tadej Pogačar", "team": "UAD", "nationality": "SLO"},
        {"name": "Remco Evenepoel", "team": "SOQ", "nationality": "BEL"},
        {"name": "Primož Roglič", "team": "BOH", "nationality": "SLO"},
        {"name": "Juan Ayuso", "team": "UAD", "nationality": "ESP"},
        {"name": "Carlos Rodríguez", "team": "IGD", "nationality": "ESP"},
        {"name": "João Almeida", "team": "UAD", "nationality": "POR"},
        {"name": "Mattias Skjelmose", "team": "LTK", "nationality": "DEN"},
        {"name": "Ben O'Connor", "team": "DAT", "nationality": "AUS"},
        {"name": "Sepp Kuss", "team": "TVL", "nationality": "USA"},
        {"name": "Thymen Arensman", "team": "IGD", "nationality": "NED"},
        {"name": "Santiago Buitrago", "team": "TBV", "nationality": "COL"},
    ]
    
    gc_time_base_seconds = 0
    if stage_number == 1:
        gc_time_base_seconds = 0
    elif stage_number == 2:
        gc_time_base_seconds = 60
    elif stage_number == 3:
        gc_time_base_seconds = 180

    for i, rider in enumerate(gc_riders_base_order):
        rank = i + 1
        gc_time_seconds = gc_time_base_seconds + (i * 10 + random.randint(0, 5))
        
        minutes = gc_time_seconds // 60
        seconds = gc_time_seconds % 60
        time_str = f"{minutes:02d}:{seconds:02d}"

        gc_standings.append({
            "rank": rank,
            "rider_name": rider["name"],
            "team": rider["team"],
            "time": time_str,
            "time_gap": f"+{time_str}" if i > 0 else "0:00",
            "url": f"rider/{rider['name'].lower().replace(' ', '-')}",
        })

    # --- Simulate Jersey Holders ---
    young_riders = [r["name"] for r in riders_pool if r.get("is_young")]
    climber_riders = [r["name"] for r in riders_pool if r.get("is_climber")]

    jersey_holders = {
        "yellow": gc_standings[0]["rider_name"] if gc_standings else None,
        "green": sorted(stage_results, key=lambda x: x.get('points', 0), reverse=True)[0]['rider_name'] if stage_results else None,
        "polka_dot": random.choice(climber_riders) if climber_riders else "N/A",
        "white": random.choice(young_riders) if young_riders else "N/A",
    }
    
    print(f"Successfully simulated data for Stage {stage_number}.")
    return stage_results, gc_standings, jersey_holders

if __name__ == "__main__":
    race = "Tour de France"
    year = 2025
    stages_to_simulate = range(1, 4) # Stages 1, 2, 3

    print(f"--- Simulating {race} {year} Data (Stages {stages_to_simulate[0]} to {stages_to_simulate[-1]}) ---")

    # Ensure the simulated data directory exists
    os.makedirs(SIMULATED_DATA_DIR, exist_ok=True)

    for stage_num in stages_to_simulate:
        stage_results, gc_standings, jersey_holders = simulate_pcs_stage_data(race, year, stage_num)

        if stage_results:
            # Prepare data to be saved for this specific stage
            stage_data_to_save = {
                "stage_number": stage_num,
                "stage_results": stage_results,
                "gc_standings": gc_standings,
                "jersey_holders": jersey_holders
            }
            # Define the file path for this stage's data
            stage_filepath = os.path.join(SIMULATED_DATA_DIR, f'stage_{stage_num}_data.json')
            
            # Save the data
            with open(stage_filepath, 'w', encoding='utf-8') as f:
                json.dump(stage_data_to_save, f, indent=4)
            
            print(f"Saved simulated data for Stage {stage_num} to {stage_filepath}")

            print(f"\n--- Data for {race} {year}, Stage {stage_num} ---")
            print("\nStage Results (Top 3):")
            for rider_data in stage_results[:3]:
                print(f"Rank: {rider_data['rank']}, Rider: {rider_data['rider_name']}, Team: {rider_data['team']}, Time: {rider_data['time']}")

            print("\nGC Standings (Top 3):")
            for rider_data in gc_standings[:3]:
                print(f"Rank: {rider_data['rank']}, Rider: {rider_data['rider_name']}, Team: {rider_data['team']}, Time: {rider_data['time_gap']}")

            print("\nJersey Holders:")
            for jersey, rider in jersey_holders.items():
                print(f"{jersey.replace('_', ' ').title()} Jersey: {rider}")
            print("-" * 30)
        else:
            print(f"Could not simulate data for Stage {stage_num}.")

        time.sleep(0.5)

    print("\n--- Simulation Complete ---")
    print(f"All simulated stage data saved to: {SIMULATED_DATA_DIR}")