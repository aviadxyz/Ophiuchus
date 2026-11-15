import sys
from unittest.mock import Mock

import pytest

from knowledge_ingestion import __main__ as cli
from knowledge_ingestion.extraction.selection import document_exclusion,document_priority


@pytest.mark.parametrize('args,configured,expected',[
    ([],None,True),
    (['--generic'],None,False),
    ([], 'generic',False),
    (['--relations-first'],'generic',True),
])
def test_cli_mode_selection(monkeypatch,args,configured,expected):
    monkeypatch.setattr(cli,'settings',lambda path: {})
    if configured is None: monkeypatch.delenv('EXTRACTION_MODE',raising=False)
    else: monkeypatch.setenv('EXTRACTION_MODE',configured)
    extraction=Mock(return_value={'extraction_status':{'status':'completed'}})
    monkeypatch.setattr(cli,'extract',extraction)
    monkeypatch.setattr(sys,'argv',['knowledge_ingestion','extract',*args])
    assert cli.main()==0
    assert extraction.call_args.kwargs['relations_first'] is expected


def test_directory_exclusion_and_medical_priority():
    assert document_exclusion({'source_url':'https://www.nasa.gov/humans-in-space/astronauts/'})
    assert document_exclusion({'source_url':'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/'}) is None
    assert document_priority({'source_url':'https://www.nasa.gov/reference/risk-of-sleep/'}) < document_priority({'source_url':'https://www.nasa.gov/hrp/hazards/'})

@pytest.mark.parametrize('args,expected', [([],10),(['--max-requests','3'],3),(['--all'],None)])
def test_enrichment_budget_is_explicit(monkeypatch,args,expected):
    import knowledge_ingestion.enrichment as enrichment
    monkeypatch.setattr(cli,'settings',lambda path: {})
    function=Mock(return_value={'latest_run':{'status':'pilot_complete'}})
    monkeypatch.setattr(enrichment,'enrich',function)
    monkeypatch.setattr(sys,'argv',['knowledge_ingestion','enrich',*args])
    assert cli.main()==0
    assert function.call_args.kwargs['max_requests']==expected
