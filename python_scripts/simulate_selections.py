import json
import os
import random

# --- Configuration ---
NUM_PARTICIPANTS = 120
NUM_MAIN_RIDERS = 10
NUM_RESERVE_RIDERS = 1 # Always 1 for now

OUTPUT_DIR = 'data'
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'participant_selections.json')

# --- Dummy Data Pools (Expanded for realism) ---
# A more extensive list of pro cyclists
ALL_RIDERS = [
    "Tadej Pogačar", "Jonas Vingegaard", "Remco Evenepoel", "Mathieu van der Poel", "Wout Van Aert",
    "Primož Roglič", "Juan Ayuso", "Carlos Rodríguez", "Adam Yates", "Pello Bilbao",
    "Tom Pidcock", "Biniam Girmay", "Mads Pedersen", "Enric Mas", "Ben O'Connor",
    "Romain Bardet", "David Gaudu", "Simon Yates", "Christophe Laporte", "Dylan Groenewegen",
    "Jasper Philipsen", "Sepp Kuss", "Julian Alaphilippe", "Michael Matthews", "Fabio Jakobsen",
    "Caleb Ewan", "Sam Bennett", "Arnaud Démare", "Mark Cavendish", "Alexander Kristoff",
    "Stefan Küng", "Filippo Ganna", "Kasper Asgreen", "Tim Declercq", "Yves Lampaert",
    "Magnus Cort Nielsen", "Alberto Bettiol", "Matej Mohorič", "Dylan Teuns", "Tiesj Benoot",
    "Marc Hirschi", "Brandon McNulty", "João Almeida", "George Bennett", "Sergio Higuita",
    "Richard Carapaz", "Egan Bernal", "Daniel Martínez", "Geraint Thomas", "Tao Geoghegan Hart",
    "Wilco Kelderman", "Jai Hindley", "Thymen Arensman", "Tobias Foss", "Ethan Hayter",
    "Jonathan Milan", "Olav Kooij", "Arnaud De Lie", "Axel Laurance", "Paul Penhoët",
    "Kévin Vauquelin", "Valentin Madouas", "Lenny Martinez", "Mattias Skjelmose", "Maxim Van Gils",
    "Victor Campenaerts", "Soren Kragh Andersen", "Fred Wright", "Ben Healy", "Quinn Simmons",
    "Andreas Kron", "Warren Barguil", "Esteban Chaves", "Rigoberto Urán", "Michael Woods",
    "Alexey Lutsenko", "Neilson Powless", "Felix Gall", "Giulio Ciccone", "Santiago Buitrago",
    "Attila Valter", "Maximilian Schachmann", "Florian Sénéchal", "Mads Würtz Schmidt", "Danny van Poppel",
    "Nils Politt", "Pascal Ackermann", "Phil Bauhaus", "Sam Welsford", "Marijn van den Berg",
    "Jordi Meeus", "Bryan Coquard", "Simone Consonni", "Elia Viviani", "Giacomo Nizzolo",
    "Peter Sagan", "Greg Van Avermaet", "Philippe Gilbert", "Vincenzo Nibali", "Chris Froome",
    "Nairo Quintana", "Miguel Ángel López", "Rigoberto Urán", "Thibaut Pinot", "Romain Bardet",
    "Julian Alaphilippe", "Wout Poels", "Bauke Mollema", "Steven Kruijswijk", "Emanuel Buchmann",
    "Jack Haig", "Damiano Caruso", "Hugh Carthy", "Simon Carr", "Cian Uijtdebroeks",
    "Juan Pedro López", "Louis Vervaeke", "Jan Tratnik", "Christoph Pfingsten", "Jumbo-Visma Domestique 1",
    "UAE Domestique 1", "Ineos Domestique 1", "Soudal Quick-Step Domestique 1", "Alpecin-Deceuninck Domestique 1",
    "Bora-Hansgrohe Domestique 1", "Lidl-Trek Domestique 1", "Groupama-FDJ Domestique 1", "EF Education-EasyPost Domestique 1",
    "Bahrain Victorious Domestique 1", "Astana Qazaqstan Domestique 1", "Movistar Domestique 1", "DSM-Firmenich PostNL Domestique 1",
    "Intermarché-Wanty Domestique 1", "Jayco AlUla Domestique 1", "Arkéa-B&B Hotels Domestique 1", "Decathlon AG2R La Mondiale Domestique 1"
]

# A list of real professional cycling teams
PRO_TEAMS = [
    "Team Visma | Lease a Bike", "UAE Team Emirates", "INEOS Grenadiers", "Soudal Quick-Step",
    "Alpecin-Deceuninck", "Bora-Hansgrohe", "Lidl-Trek", "Groupama-FDJ",
    "EF Education-EasyPost", "Bahrain Victorious", "Astana Qazaqstan Team", "Movistar Team",
    "Team DSM-Firmenich PostNL", "Intermarché-Wanty", "Team Jayco AlUla", "Arkéa-B&B Hotels",
    "Decathlon AG2R La Mondiale", "Cofidis", "TotalEnergies", "Uno-X Mobility"
]

def generate_participant_selections():
    """
    Generates simulated team selections for a specified number of participants.
    Each participant gets 10 main riders, 1 reserve rider, and 1 pro team.
    Ensures unique riders within a participant's selection.
    """
    all_selections = {}
    
    # Ensure we have enough unique riders for all selections
    if len(ALL_RIDERS) < (NUM_PARTICIPANTS * (NUM_MAIN_RIDERS + NUM_RESERVE_RIDERS)):
        print("Warning: Not enough unique riders in ALL_RIDERS list for all selections. Riders might be duplicated across participants.")

    for i in range(1, NUM_PARTICIPANTS + 1):
        participant_name = f"Deelnemer {i}" # Use Dutch for participant names

        # Make a copy of ALL_RIDERS to draw from for this participant
        available_riders_for_selection = list(ALL_RIDERS)
        random.shuffle(available_riders_for_selection) # Shuffle to ensure variety

        # Select main riders
        if len(available_riders_for_selection) >= NUM_MAIN_RIDERS:
            main_riders = random.sample(available_riders_for_selection, NUM_MAIN_RIDERS)
            # Remove selected main riders from the pool for reserve selection
            available_riders_for_selection = [r for r in available_riders_for_selection if r not in main_riders]
        else:
            # Fallback if not enough unique riders for main selection
            main_riders = random.sample(ALL_RIDERS, NUM_MAIN_RIDERS)
            print(f"Warning: Not enough unique riders for main selection for {participant_name}. Duplicates across participants possible.")

        # Select reserve rider
        reserve_rider = None
        if len(available_riders_for_selection) >= NUM_RESERVE_RIDERS:
            reserve_rider = random.sample(available_riders_for_selection, NUM_RESERVE_RIDERS)[0]
        elif len(ALL_RIDERS) > 0: # Fallback to any rider if specific pool exhausted
             # Ensure reserve rider is not already in main riders if drawing from full list
            potential_reserve = random.choice(ALL_RIDERS)
            while potential_reserve in main_riders and len(ALL_RIDERS) > len(main_riders):
                potential_reserve = random.choice(ALL_RIDERS)
            reserve_rider = potential_reserve
        else:
            reserve_rider = "Geen Reserve Renner" # Translated

        # Select pro team
        pro_team = random.choice(PRO_TEAMS)

        all_selections[participant_name] = {
            "main_riders": main_riders,
            "reserve_rider": reserve_rider,
            "pro_team": pro_team
        }
    
    return all_selections

def save_selections_to_json(selections, output_filepath):
    """Saves the generated selections to a JSON file."""
    os.makedirs(os.path.dirname(output_filepath), exist_ok=True)
    with open(output_filepath, 'w', encoding='utf-8') as f:
        json.dump(selections, f, indent=4, ensure_ascii=False) # ensure_ascii=False for proper Dutch characters
    print(f"Simulated selections saved to: {output_filepath}")

if __name__ == "__main__":
    print(f"Generating {NUM_PARTICIPANTS} participant selections...")
    selections = generate_participant_selections()
    save_selections_to_json(selections, OUTPUT_FILE)
    print("Simulation complete.")
    print(f"Please run 'python -m python_scripts.calculate_points' next to update the leaderboard with these new selections.")