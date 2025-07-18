
import os
import json


def load_participant_stage_points(input_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_latest_stage(all_data):
    stage_numbers = set()
    for participant, stages in all_data.items():
        for stage_key in stages:
            if stage_key.startswith('stage_'):
                try:
                    stage_num = int(stage_key.split('_')[1])
                    stage_numbers.add(stage_num)
                except Exception:
                    pass
    return max(stage_numbers) if stage_numbers else None

def get_top5_scorers(all_data, latest_stage):
    scorers = []
    for participant, stages in all_data.items():
        stage_data = stages.get(f'stage_{latest_stage}')
        if stage_data:
            scorer_info = {
                'participant_name': participant,
                'stage_points': stage_data.get('stage_participant_score', 0),
                'rider_contributions': stage_data.get('rider_contributions', {})
            }
            scorers.append(scorer_info)
    scorers.sort(key=lambda x: x['stage_points'], reverse=True)
    return scorers[:5]

def save_top5_to_json(output_file, latest_stage, top5):
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'stage': latest_stage,
            'top5': top5
        }, f, ensure_ascii=False, indent=2)

def main():
    data_dir = 'data'
    input_file = os.path.join(data_dir, 'points', 'participant_stage_points.json')
    output_dir = os.path.join(data_dir, 'web')
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, 'top5_stage_scorers.json')

    all_data = load_participant_stage_points(input_file)
    latest_stage = get_latest_stage(all_data)
    top5 = get_top5_scorers(all_data, latest_stage)
    save_top5_to_json(output_file, latest_stage, top5)
    print(f"Top 5 stage scorers for stage {latest_stage} written to {output_file}")

if __name__ == "__main__":
    main()
