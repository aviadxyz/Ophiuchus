from knowledge_ingestion.parsers import normalize_text

def verify_evidence(excerpt, chunk):
    return bool(normalize_text(excerpt)) and normalize_text(excerpt) in normalize_text(chunk)
