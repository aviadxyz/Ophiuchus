from pathlib import Path
import yaml
from dotenv import load_dotenv

def settings(path='config/sources.yaml'):
    load_dotenv()
    return yaml.safe_load(Path(path).read_text(encoding='utf-8'))
