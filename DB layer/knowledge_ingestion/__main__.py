import argparse
import json
import logging
import sys
import os
from pathlib import Path
from knowledge_ingestion.config import settings
from knowledge_ingestion.crawler import Crawler
from knowledge_ingestion.pipeline import extract,export,report
from knowledge_ingestion.review import review,authorize_protocol
from knowledge_ingestion.extraction import create_provider

def main():
    logging.basicConfig(level=logging.INFO,format='%(levelname)s %(message)s')
    parser=argparse.ArgumentParser(description='NASA/CSA evidence-backed knowledge ingestion')
    parser.add_argument('--root',default='.')
    parser.add_argument('--config',default='config/sources.yaml')
    commands=parser.add_subparsers(dest='command',required=True)
    for name in ('crawl','run'):
        p=commands.add_parser(name)
        p.add_argument('--max-depth',type=int); p.add_argument('--max-pages',type=int)
        p.add_argument('--dry-run',action='store_true')
        p.add_argument('--all-risks',action='store_true')
        p.add_argument('--include-evidence',action='store_true')
        p.add_argument('--resume',action='store_true')
        p.add_argument('--risk-id')
        if name=='run': p.add_argument('--max-chunks',type=int)
    p=commands.add_parser('extract'); p.add_argument('--max-chunks',type=int)
    p.add_argument('--resume',action='store_true')
    p.add_argument('--risk-id')
    p.add_argument('--source-id')
    p.add_argument('--hrr-only',action='store_true')
    p.add_argument('--focus',help='Additive local extraction: monitoring,microbiome (existing CSV rows are preserved)')
    for p in (p,commands.choices['run']):
        p.add_argument('--provider',choices=['ollama','gemini'])
        mode=p.add_mutually_exclusive_group()
        mode.add_argument('--relations-first',dest='relations_first',action='store_true')
        mode.add_argument('--generic',dest='relations_first',action='store_false',help='Use the legacy all-entity extraction schema')
        p.set_defaults(relations_first=None)
    for name in ('review','report','check-llm'): commands.add_parser(name)
    commands.choices['review'].add_argument('--enrichment',action='store_true')
    p=commands.add_parser('enrich',help='Fill supported missing attributes from cached sources using local Ollama')
    limits=p.add_mutually_exclusive_group()
    limits.add_argument('--max-requests',type=int)
    limits.add_argument('--all',dest='all_jobs',action='store_true')
    p.add_argument('--resume',action='store_true',help='Reuse completed checkpoints (always enabled)')
    p.add_argument('--entity-id')
    from knowledge_ingestion.storage import ENTITY_FIELDS
    p.add_argument('--entity-type',choices=sorted(ENTITY_FIELDS))
    p.add_argument('--source-id')
    p=commands.add_parser('authorize-protocol')
    p.add_argument('protocol_id'); p.add_argument('--reviewer',required=True)
    p=commands.add_parser('export'); group=p.add_mutually_exclusive_group(required=True)
    group.add_argument('--draft',action='store_true'); group.add_argument('--approved-only',action='store_true')
    args=parser.parse_args(); root=Path(args.root).resolve(); config=settings(args.config)
    if getattr(args,'max_chunks',None) is not None and args.max_chunks<1:
        parser.error('--max-chunks must be positive')
    if getattr(args,'max_requests',None) is not None and args.max_requests<1:
        parser.error('--max-requests must be positive')
    failed=False
    if args.command in ('extract','run') and args.relations_first is None and not getattr(args,'focus',None):
        selected_mode=os.getenv('EXTRACTION_MODE','relations_first').strip().lower()
        if selected_mode not in ('relations_first','generic'):
            parser.error('EXTRACTION_MODE must be relations_first or generic')
        args.relations_first=selected_mode=='relations_first'
        logging.info('Extraction mode: %s (use --generic for legacy extraction)',selected_mode)
    if getattr(args,'provider',None):
        os.environ['LLM_PROVIDER']=args.provider
    if args.command=='extract' and args.focus:
        if args.provider not in (None,'ollama'):
            parser.error('Focused extraction supports the existing local Ollama provider only')
        if args.risk_id:
            parser.error('Use --source-id for a focused one-document pilot')
        from knowledge_ingestion.focused.runner import extract_focused
        result=extract_focused(root,focus=args.focus,max_chunks=args.max_chunks,source_id=args.source_id,hrr_only=args.hrr_only)
        print(json.dumps({key:result[key] for key in ('status','eligible_jobs','processed','resumed','new_rows','errors')},indent=2))
        return 1 if result['status'] in ('partial_failure','no_eligible_sources','failed') else 0
    if args.command=='enrich':
        from knowledge_ingestion.enrichment import enrich
        result=enrich(root,max_requests=None if args.all_jobs else (args.max_requests or 10),entity_id=args.entity_id,entity_type=args.entity_type,source_id=args.source_id)
        print(json.dumps(result,indent=2,ensure_ascii=False))
        print('Enrichment is staged separately. Run export --draft to update CSVs.')
        return 1 if result['latest_run']['status'] in ('failed','partial_failure') else 0
    if args.command=='check-llm':
        try:
            provider=create_provider()
            if not hasattr(provider,'health_check'):
                print('check-llm performs local structured health checks only. Set LLM_PROVIDER=ollama.',file=sys.stderr); return 1
            print(json.dumps(provider.health_check(),indent=2)); return 0
        except Exception as exc:
            print(str(exc),file=sys.stderr); return 1
    for field in ('max_depth','max_pages'):
        value=getattr(args,field,None)
        if value is not None:
            if value<0: parser.error('Limits must be nonnegative')
            config[field]=value
    if args.command in ('crawl','run'):
        if args.all_risks or args.risk_id:
            from knowledge_ingestion.crawler.hrr import HRRCrawler
            inventory=HRRCrawler(config,root).run(include_evidence=args.include_evidence,resume=args.resume,risk_id=args.risk_id,dry_run=args.dry_run)
            failed=not inventory.get('discovery_complete',False)
        else: Crawler(config,root).run(args.dry_run)
        if args.dry_run: return
    if args.command in ('extract','run'):
        result=extract(root,max_chunks=args.max_chunks,relations_first=args.relations_first,risk_id=args.risk_id,source_id=getattr(args,'source_id',None),hrr_only=getattr(args,'hrr_only',False) or getattr(args,'all_risks',False))
        # Historical per-chunk errors remain in report.json; show current run clearly.
        print(json.dumps({k:v for k,v in result.items() if k!='extraction_errors'},indent=2))
        failed=result['extraction_status'].get('status') in ('failed','blocked_quota')
        if failed: print('Extraction failed. See staging/extraction_status.json for the current error.',file=sys.stderr)
    if args.command=='review':
        if args.enrichment:
            from knowledge_ingestion.enrichment.review import review_enrichment
            review_enrichment(root)
        else: review(root)
    if args.command=='authorize-protocol': authorize_protocol(root,args.protocol_id,args.reviewer)
    if args.command in ('export','run'):
        print(export(root,draft=args.command=='run' or args.draft))
        summary=report(root)
        if summary['entities_extracted']==0:
            print('WARNING: No medical entities are staged; medical CSVs contain headers only. Export does not call an LLM. Run extract successfully first.',file=sys.stderr)
    if args.command in ('report','run','crawl'): print(json.dumps(report(root),indent=2))
    return 1 if failed else 0

if __name__=='__main__': sys.exit(main())
