"""Validate rows independently; reject malformed records without repairing medical facts."""
import json
from collections import Counter

from pydantic import ValidationError

from knowledge_ingestion.extraction import Extraction, Entity, Claim, Monitoring, Intervention


def validate_local_output(content):
    try:
        return Extraction.model_validate_json(content), []
    except ValidationError:
        # Keep JSON syntax, document classification and top-level shape strict.
        # Only individual list records are eligible for partial acceptance.
        try:
            raw=json.loads(content)
        except (ValueError,TypeError):
            return Extraction.model_validate_json(content), []
        if not isinstance(raw,dict):
            return Extraction.model_validate_json(content), []
        groups={'entities':Entity,'claims':Claim,'monitoring':Monitoring,'interventions':Intervention}
        if any(not isinstance(raw.get(key,[]),list) for key in groups):
            return Extraction.model_validate_json(content), []
        base=Extraction.model_validate({**raw,**{key:[] for key in groups}}).model_dump()
        rejected=[]
        valid={key:[] for key in groups}
        for group,model in groups.items():
            for index,row in enumerate(raw.get(group,[])):
                try:
                    valid[group].append((index,model.model_validate(row)))
                except ValidationError as exc:
                    rejected.append({'reason':'invalid_structured_record','group':group,'index':index,'record':row,'error':str(exc)})
        counts=Counter(e.local_id for _,e in valid['entities'])
        entities=[]
        for index,entity in valid['entities']:
            if counts[entity.local_id]>1:
                rejected.append({'reason':'duplicate_entity_local_id','group':'entities','index':index,'record':entity.model_dump()})
            else:
                entities.append(entity.model_dump())
        base['entities']=entities
        for group in ('claims','monitoring','interventions'):
            for index,row in valid[group]:
                try:
                    # Existing cross-reference validator checks each row against
                    # retained entity IDs and required entity types. Never guess IDs.
                    Extraction.model_validate({**base,group:[row.model_dump()]})
                    base[group].append(row.model_dump())
                except ValidationError as exc:
                    rejected.append({'reason':'invalid_entity_reference','group':group,'index':index,'record':row.model_dump(),'error':str(exc)})
        return Extraction.model_validate(base), rejected
