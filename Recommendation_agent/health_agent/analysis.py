from datetime import timedelta, timezone
from statistics import mean
from pydantic import ValidationError
from .models import Measurement, ValidationResult, Finding, Risk, now
from .storage import stable_id

# Physical/domain constraints only, NOT healthy ranges or clinical alert thresholds.
# Percentages are bounded by definition; elapsed durations/activity cannot be negative;
# Celsius cannot be below absolute zero. No invented upper heart-rate/BP limits.
UNITS = {'resting_heart_rate': 'bpm', 'hrv': 'ms', 'sleep_duration': 'hours',
         'sleep_efficiency': '%', 'temperature': 'C', 'systolic_bp': 'mmHg',
         'diastolic_bp': 'mmHg', 'activity': 'steps', 'spo2': '%'}

def validate_input(astronaut_id: str, measurements: list[dict], at=None, stale_hours: int = 24) -> ValidationResult:
    at = at or now()
    accepted, rejected, warnings, seen = [], [], [], set()
    for index, raw in enumerate(measurements):
        try:
            m = Measurement.model_validate(raw)
            if m.astronaut_id != astronaut_id:
                raise ValueError('Measurement belongs to another astronaut')
            if m.metric not in UNITS:
                raise ValueError('Unsupported metric')
            if m.measurement_id in seen:
                raise ValueError('Duplicate measurement ID')
            if m.timestamp > at:
                raise ValueError('Future timestamp')
            value, unit = m.value, m.unit
            if m.metric == 'temperature' and unit == 'F':
                value, unit = (value - 32) * 5 / 9, 'C'
            elif m.metric == 'temperature' and unit == 'K':
                value, unit = value - 273.15, 'C'
            elif m.metric == 'sleep_duration' and unit == 'minutes':
                value, unit = value / 60, 'hours'
            elif m.metric == 'hrv' and unit == 's':
                value, unit = value * 1000, 'ms'
            if unit != UNITS[m.metric]:
                raise ValueError('Unsupported unit')
            if value < (-273.15 if m.metric == 'temperature' else 0):
                raise ValueError('Outside physical domain')
            if unit == '%' and value > 100:
                raise ValueError('Percentage exceeds 100')
            if m.timestamp < at - timedelta(hours=stale_hours):
                warnings.append(f'{m.measurement_id}: stale; excluded from current assessment')
                raise ValueError('Stale measurement')
            if m.quality is not None and m.quality == 0:
                raise ValueError('Device reports unusable quality')
            seen.add(m.measurement_id)
            accepted.append(m.model_copy(update={'value': value, 'unit': unit, 'timestamp': m.timestamp.astimezone(timezone.utc)}))
        except (ValidationError, ValueError) as exc:
            # Avoid echoing health values or detailed Pydantic input into errors/logs.
            rejected.append({'index': index, 'reason': 'Malformed measurement' if isinstance(exc, ValidationError) else str(exc)})
    return ValidationResult(status='partial' if accepted and rejected else 'valid' if accepted else 'invalid', normalized=accepted, rejected=rejected, warnings=warnings, data_quality='partial' if rejected else 'available' if accepted else 'missing')

def analyze_trends(current: list[Measurement], history: dict) -> list[Finding]:
    findings = []
    for metric in sorted({m.metric for m in current}):
        latest = max((m for m in current if m.metric == metric), key=lambda m: m.timestamp)
        points = {m.measurement_id: m for m in current if m.metric == metric}
        for raw in history['recent_measurements']:
            m = Measurement.model_validate(raw)
            if m.metric == metric and m.unit == latest.unit and m.timestamp <= latest.timestamp:
                points.setdefault(m.measurement_id, m)
        series = sorted(points.values(), key=lambda m: m.timestamp)
        baseline = history['baseline'].get(metric)
        baseline_value = baseline['value'] if baseline and baseline['unit'] == latest.unit else None
        x = [(m.timestamp - series[0].timestamp).total_seconds() / 86400 for m in series]
        y = [m.value for m in series]
        denominator = sum((v - mean(x)) ** 2 for v in x)
        slope = sum((a - mean(x)) * (b - mean(y)) for a, b in zip(x, y)) / denominator if denominator else None
        findings.append(Finding(metric=metric, current_value=latest.value, baseline_value=baseline_value,
            unit=latest.unit, deviation=latest.value - baseline_value if baseline_value is not None else None,
            moving_average=mean(y[-7:]), slope_per_day=slope,
            trend='insufficient_data' if slope is None else 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'stable',
            data_quality='sufficient' if len(series) >= 3 else 'limited', measurement_ids=[m.measurement_id for m in series]))
    return findings

def assess_risk(findings: list[Finding], rules: list, context: dict, evidence_lookup) -> list[Risk]:
    results = []
    for f in findings:
        matched = False
        for rule in rules:
            if rule.metric != f.metric or (rule.environment_id and context.get('environment_id') != rule.environment_id):
                continue
            value = getattr(f, rule.field)
            if value is None or len(f.measurement_ids) < rule.minimum_samples:
                continue
            if not all(evidence_lookup(evidence_id=e) for e in rule.evidence_ids):
                continue
            applies = {'lt': lambda: value < rule.threshold, 'gt': lambda: value > rule.threshold,
                       'le': lambda: value <= rule.threshold, 'ge': lambda: value >= rule.threshold}[rule.operator]()
            if applies:
                matched = True
                results.append(Risk(risk_id=rule.risk_id, risk_type=rule.risk_type, severity=rule.severity,
                    supporting_measurement_ids=f.measurement_ids, rule_ids=[rule.rule_id], evidence_ids=rule.evidence_ids,
                    uncertainty='Configured decision-support criterion; not a diagnosis.',
                    escalation_required=rule.severity == 'red', escalation_protocol_id=rule.escalation_protocol_id))
        if not matched:
            results.append(Risk(risk_id=stable_id('observation', f.metric), risk_type=f.metric, severity='undetermined',
                supporting_measurement_ids=f.measurement_ids, uncertainty='No applicable approved assessment criterion.'))
    return results
