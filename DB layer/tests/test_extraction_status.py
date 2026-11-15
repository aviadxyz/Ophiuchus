from knowledge_ingestion.pipeline import extract
from knowledge_ingestion.storage import atomic_json
from knowledge_ingestion.extraction import Extraction


def seed(root):
    atomic_json(root/'staging/sources/manifest.json',{
        str(i):{'source_id':str(i),'source_url':f'https://nasa.gov/{i}','cache_path':f'cache/{i}.json','fetch_status':'success'} for i in range(3)
    })
    for i in range(3):
        atomic_json(root/f'cache/{i}.json',{'source_id':str(i),'pages':[{'page_number':None,'text':'A research document.'}]})


def test_quota_stops_and_reports_failure(tmp_path):
    seed(tmp_path)
    class Provider:
        calls=0
        def extract(self,text):
            self.calls+=1
            raise RuntimeError('429 RESOURCE_EXHAUSTED: daily quota exceeded')
    provider=Provider()
    result=extract(tmp_path,provider)
    assert provider.calls==1
    status=result['extraction_status']
    assert status['status']=='blocked_quota'
    assert status['chunks_failed']==1
    assert status['chunks_succeeded']==0
    assert status['started_at'] and status['finished_at']


def test_one_chunk_limit(tmp_path):
    seed(tmp_path)
    class Provider:
        def extract(self,text): return Extraction(source_type='general_information')
    result=extract(tmp_path,Provider(),max_chunks=1)
    assert result['chunks_extracted']==1
    assert result['extraction_status']['chunks_attempted']==1
