"""Conservative scalar merging shared by the catalog and CSV exporter."""
from knowledge_ingestion.storage import ENTITY_FIELDS


def missing(field, value):
    return value is None or (isinstance(value, str) and not value.strip()) or (field == 'evidence_status' and value == 'unknown')


def value_key(field, value):
    if field == 'requires_medical_supervision' and isinstance(value, str):
        if value.lower() in ('true', 'false'):
            return value.lower() == 'true'
    return value


def merge_entity(table, current, incoming, conflicts):
    """Fill blanks only. Retain the existing scalar on disagreement."""
    fields = ENTITY_FIELDS[table.removeprefix('entities/')].split()
    identifier = fields[0]
    for field in fields[2:]:
        value = incoming.get(field)
        if missing(field, value):
            continue
        if missing(field, current.get(field)):
            current[field] = value
            if incoming.get('review_status') != 'approved':
                current['review_status'] = 'pending'
        elif value_key(field, current[field]) != value_key(field, value):
            conflicts.append({'entity_id': current[identifier], 'field': field,
                              'existing_value': current[field], 'candidate_value': value,
                              'reason': 'existing_value_preserved'})
    return current
