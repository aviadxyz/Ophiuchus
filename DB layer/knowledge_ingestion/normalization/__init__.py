import re
import unicodedata
from knowledge_ingestion.storage import stable_id, read_json, atomic_json

def normalize_name(name):
    return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',name).casefold()).strip()

class EntityResolver:
    """Exact normalized names and explicitly reviewed aliases only; no fuzzy medical merges."""
    def __init__(self,path):
        self.path=path; self.mapping=read_json(path,{})
    def resolve(self,kind,name):
        key=kind+':'+normalize_name(name)
        result=self.mapping.setdefault(key,stable_id(kind,normalize_name(name)))
        atomic_json(self.path,self.mapping)
        return result
    def add_reviewed_alias(self,kind,alias,entity_id):
        key=kind+':'+normalize_name(alias)
        if key in self.mapping and self.mapping[key]!=entity_id: raise ValueError('Alias collision requires manual resolution')
        self.mapping[key]=entity_id; atomic_json(self.path,self.mapping)
