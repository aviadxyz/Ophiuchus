"""Conservative language triage, not medical thresholds or a diagnosis."""
import re
import unicodedata

URGENT_PATTERNS = (
    r'\b(?:kill|hurt|harm) (?:myself|yourself)\b',
    r'\b(?:end|take|ending|taking) (?:my|your|own|my own) life\b',
    r'\b(?:want to die|wish i (?:was|were) dead|better off dead|suicid\w*|self[ -]?harm)\b',
    r'\b(?:don.t want to (?:live|go on)|can.t (?:go|carry) on|no reason to live)\b',
    r'\b(?:chest pain|can.t breathe|cannot breathe|trouble breathing|shortness of breath|heavy bleeding|bleeding heavily|unconscious|fainting|fainted|anaphylaxis)\b',
    r'\b(?:suddenly confused|don.t know where i am|severely disoriented|overdos\w*)\b',
    r'\b(?:immediate danger|serious injury|signs of a stroke)\b',
    r'\b(?:i.m not safe|i am not safe|can.t keep myself safe)\b',
)


def normalize(text):
    value = unicodedata.normalize('NFKC', text).casefold().replace('’', "'").replace('‐', '-')
    return ''.join(c for c in value if unicodedata.category(c) != 'Cf')


def urgent_language(text: str) -> bool:
    return any(re.search(pattern, normalize(text)) for pattern in URGENT_PATTERNS)


def urgent_reply(watch=False):
    if watch:
        return 'Open Emergency or hold the watch Emergency button now. Ask a nearby crewmate to stay with you and help contact onboard medical support.'
    return ("I'm concerned about your safety. Open the Emergency screen now and ask a nearby crewmate to stay with you while you seek onboard medical help. "
            'Follow the established onboard emergency procedures; Earth communications may be delayed. '
            'This demo cannot contact anyone. If this is a real-world emergency, seek immediate local human assistance. Are you safe right now?')


def medication_question(text):
    return bool(re.search(r'\b(?:medication|medicine|dosage|dose|ibuprofen|prescri\w*|pills?)\b', normalize(text)))


def unsafe_reply(text: str) -> bool:
    t = normalize(text)
    return bool(re.search(
        r'\b(?:\d+(?:\.\d+)?\s*(?:mg|mcg|milligrams?|tablets?|capsules?)\b|'
        r'(?:take|start|stop|increase|decrease|double|change)\b.{0,45}\b(?:medication|medicine|dose|drug|pill|ibuprofen)|'
        r'you (?:have|are diagnosed with|suffer from)\b.{0,35}\b(?:depression|disorder|disease|infection)|'
        r'(?:i|we) (?:have )?(?:contacted|notified|called|alerted)\b|'
        r'ignore (?:the |your )?(?:doctor|clinician)|'
        r'\d+(?:\.\d+)?\s*(?:bpm|mmhg|hours?|%)\b|'
        r'https?://|\bwww\.)', t)) or urgent_language(t)
