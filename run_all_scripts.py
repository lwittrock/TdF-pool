import subprocess
import os

# List your scripts in the desired execution order
scripts = [
    "python_scripts/get_team_selections.py",
    "python_scripts/participant_selections_active.py",
    "python_scripts/calculate_points.py",
    "python_scripts/tables_web.py",
    "python_scripts/copy_data_to_web.py",
]

for script in scripts:
    script_path = os.path.join(os.path.dirname(__file__), script)
    print(f"Running {script}...")
    result = subprocess.run(["python", script_path], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("Error:", result.stderr)
