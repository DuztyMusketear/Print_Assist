import json
from urllib.parse import parse_qs, urlparse
import time
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from print_assist import orchestrator as m


class Service:
    def snapshot(self):
        return dict(session_id='factory', revision=3, printers=[], orders=[], jobs=[], incidents=[])


def fixture(override=None, claims_override=None, config=None):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    calls = []
    nonce = ['']
    def transport(method, url, headers, body):
        calls.append((method, url, headers, body))
        if override:
            result = override(method, url, headers, body)
            if result is not None:
                return result
        if url.endswith('/oauth/token'):
            assert parse_qs(body.decode())['code_verifier']
            claims = dict(iss=m.ISSUER, aud='client', sub='person', nonce=nonce[0], exp=time.time()+300, email='operator@example.com')
            claims.update(claims_override or {})
            return json.dumps(dict(access_token='private-access', scope='openid resource.invoke chatgpt.tokens.use.direct', id_token=jwt.encode(claims,key,algorithm='RS256',headers={'kid':'test'}),expires_in=300)).encode()
        if url.endswith('jwks.json'):
            return json.dumps({'keys':[{**jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key(),as_dict=True),'kid':'test'}]}).encode()
        if url.endswith('/models'):
            return b'{"models":[{"slug":"account-model","display_name":"Account model","visibility":"list"},{"slug":"hidden","visibility":"hidden"}]}'
        assert url.endswith('/responses')
        data=json.loads(body)
        assert data['stream'] and data['store'] is False
        assert data['model']=='account-model' and 'Read-only' in data['instructions']
        return b'data: {"type":"response.output_text.delta","delta":"Inspect printer one."}\n\ndata: {"type":"response.completed"}\n\n'
    app=FastAPI()
    m.mount_orchestrator(app,Service(),config or m.OpenAIConfig('client','https://testserver/api/orchestrator/auth/callback'),transport)
    return TestClient(app), calls, nonce


def connect(client, nonce):
    response=client.post('/api/orchestrator/auth/start')
    assert response.status_code==200
    query=parse_qs(urlparse(response.json()['authorization_url']).query)
    assert query['code_challenge_method']==['S256']
    assert query['resource']==['https://api.openai.com/v1']
    nonce[0]=query['nonce'][0]
    response=client.get('/api/orchestrator/auth/callback',params={'state':query['state'][0],'code':'code'},follow_redirects=False)
    assert response.status_code==303, response.text
    assert 'HttpOnly' in response.headers['set-cookie']
    return query['state'][0]


def test_connection_chat_replay_logout_and_csrf():
    client,calls,nonce=fixture()
    assert client.get('/api/orchestrator/connection').json()['connected'] is False and calls==[]
    connect(client,nonce)
    state=client.get('/api/orchestrator/connection').json()
    assert state['connected'] and state['account_label']=='operator@example.com'
    assert state['models']==[dict(id='account-model',name='Account model')]
    payload=dict(message='Recommend next steps',session_id='factory',expected_revision=3,idempotency_key='one',model='account-model')
    result=client.post('/api/orchestrator/chat',json=payload)
    assert result.json()==dict(reply='Inspect printer one.',model='account-model',read_only=True)
    assert client.post('/api/orchestrator/chat',json=payload).json()==result.json()
    assert len([c for c in calls if c[1].endswith('/responses')])==1
    assert client.post('/api/orchestrator/chat',json={**payload,'message':'different'}).status_code==409
    assert client.post('/api/orchestrator/chat',json={**payload,'idempotency_key':'two','model':'hidden'}).status_code==422
    assert client.post('/api/orchestrator/chat',json={**payload,'idempotency_key':'three','expected_revision':2}).status_code==409
    assert client.post('/api/orchestrator/logout',headers={'Origin':'https://evil.example'}).status_code==403
    assert client.post('/api/orchestrator/logout').json()['connected'] is False
    assert client.post('/api/orchestrator/chat',json=payload).status_code==401


def test_browser_bound_callback_rejects_missing_and_reused_transactions():
    client,calls,nonce=fixture()
    assert client.get('/api/orchestrator/auth/callback?code=x&state=x').status_code==400
    state=connect(client,nonce)
    assert client.get('/api/orchestrator/auth/callback',params={'code':'again','state':state}).status_code==400


import pytest
from unittest.mock import patch


def authorize(client,nonce):
    query=parse_qs(urlparse(client.post('/api/orchestrator/auth/start').json()['authorization_url']).query)
    nonce[0]=query['nonce'][0]
    return client.get('/api/orchestrator/auth/callback',params={'code':'code','state':query['state'][0]},follow_redirects=False)


@pytest.mark.parametrize('claims',[{'nonce':'wrong'}, {'iss':'https://evil.com'}, {'aud':'other'}, {'exp':1}, {'sub':None}])
def test_invalid_identity_is_not_connected(claims):
    client,calls,nonce=fixture(claims_override=claims)
    assert authorize(client,nonce).status_code==400
    assert not client.get('/api/orchestrator/connection').json()['connected']


@pytest.mark.parametrize('raw',[b'data: {"type":"response.failed"}\n', b'data: {"type":"response.incomplete"}\n',b'data: {"type":"error"}\n',b'data: {"type":"response.output_text.delta","delta":"unfinished"}\n',b'data: {"type":"response.completed"}\n',b'data: broken\n',b'x'*1_000_001])
def test_failed_response_replays_safely_without_second_inference(raw):
    client,calls,nonce=fixture(override=lambda method,url,headers,body:raw if url.endswith('/responses') else None)
    connect(client,nonce)
    payload=dict(message='help',session_id='factory',expected_revision=3,idempotency_key='failure')
    for _ in range(2):
        response=client.post('/api/orchestrator/chat',json=payload)
        assert response.status_code==502
        assert 'private-access' not in response.text
    assert len([c for c in calls if c[1].endswith('/responses')])==1


def test_transport_error_and_bad_catalog_and_confidential_client():
    def fail(method,url,headers,body):
        raise TimeoutError('private-access')
    client,calls,nonce=fixture(override=fail)
    assert authorize(client,nonce).status_code==502
    client,calls,nonce=fixture(override=lambda method,url,headers,body:b'{}' if url.endswith('/models') else None)
    assert authorize(client,nonce).status_code==502
    client,calls,nonce=fixture(config=m.OpenAIConfig('client','https://testserver/api/orchestrator/auth/callback','server-secret'))
    connect(client,nonce)
    assert parse_qs(calls[0][3].decode())['client_secret']==['server-secret']


def test_expiry_and_pending_cleanup_and_same_origin():
    client,calls,nonce=fixture()
    assert client.post('/api/orchestrator/auth/start',headers={'Sec-Fetch-Site':'cross-site'}).status_code==403
    assert client.post('/api/orchestrator/auth/start',headers={'Origin':'http://testserver'}).status_code==200
    with patch.object(m.time,'time',return_value=time.time()+700):
        assert client.post('/api/orchestrator/auth/start').status_code==200
    connect(client,nonce)
    with patch.object(m.time,'time',return_value=time.time()+700):
        assert not client.get('/api/orchestrator/connection').json()['connected']


def test_sse_ignores_comments_and_done_and_empty_model_catalog():
    raw=b': comment\n\ndata: [DONE]\n\ndata: {"type":"response.output_text.delta","delta":"Advice"}\n\ndata: {"type":"response.completed"}\n\n'
    client,calls,nonce=fixture(override=lambda method,url,headers,body:raw if url.endswith('/responses') else None)
    connect(client,nonce)
    assert client.post('/api/orchestrator/chat',json=dict(message='help',session_id='factory',expected_revision=3,idempotency_key='sse')).json()['reply']=='Advice'
    client,calls,nonce=fixture(override=lambda method,url,headers,body:b'{"models":[]}' if url.endswith('/models') else None)
    connect(client,nonce)
    assert client.post('/api/orchestrator/chat',json=dict(message='help',session_id='factory',expected_revision=3,idempotency_key='none')).status_code==422


def test_identity_only_grant_cannot_enable_inference():
    client,calls,nonce=fixture(override=lambda method,url,headers,body:json.dumps({'scope':'openid','access_token':'private-access'}).encode() if url.endswith('/oauth/token') else None)
    result=authorize(client,nonce)
    assert result.status_code==403 and 'inference' in result.text
    assert not client.get('/api/orchestrator/connection').json()['connected']


def test_clock_advance_allows_inflight_reply_and_exact_replay_but_reset_rejects():
    snapshot=Service().snapshot()
    def advancing(method,url,headers,body):
        if url.endswith('/responses'):
            snapshot['revision']+=1
            return b'data: {"type":"response.output_text.delta","delta":"Advice"}\n\ndata: {"type":"response.completed"}\n'
    with patch.object(Service,'snapshot',side_effect=lambda:dict(snapshot)):
        client,calls,nonce=fixture(override=advancing)
        connect(client,nonce)
        payload=dict(message='help',session_id='factory',expected_revision=3,idempotency_key='advance')
        assert client.post('/api/orchestrator/chat',json=payload).status_code==200
        assert client.post('/api/orchestrator/chat',json=payload).status_code==200
        assert len([c for c in calls if c[1].endswith('/responses')])==1
        snapshot['session_id']='reset'
        assert client.post('/api/orchestrator/chat',json=payload).status_code==409


def test_expired_access_token_rejected_even_with_valid_identity():
    def token(method,url,headers,body):
        if url.endswith('/oauth/token'):
            claims=dict(iss=m.ISSUER,aud='client',sub='person',nonce=nonce[0],exp=time.time()+300)
            return json.dumps(dict(scope='resource.invoke chatgpt.tokens.use.direct',access_token='',id_token=jwt.encode(claims,key,algorithm='RS256',headers={'kid':'test'}),expires_in=0)).encode()
        if url.endswith('jwks.json'):
            return json.dumps({'keys':[{**jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key(),as_dict=True),'kid':'test'}]}).encode()
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    client,calls,nonce=fixture(override=token)
    assert authorize(client,nonce).status_code==400


def test_reset_during_inference_discards_reply_and_success_replaces_old_session():
    snapshot=Service().snapshot()
    def resetting(method,url,headers,body):
        if url.endswith('/responses'):
            snapshot['session_id']='reset'
            return b'data: {"type":"response.output_text.delta","delta":"old advice"}\n\ndata: {"type":"response.completed"}\n'
    with patch.object(Service,'snapshot',side_effect=lambda:dict(snapshot)):
        client,calls,nonce=fixture(override=resetting)
        connect(client,nonce)
        connect(client,nonce)
        response=client.post('/api/orchestrator/chat',json=dict(message='help',session_id='factory',expected_revision=3,idempotency_key='reset'))
        assert response.status_code==409


def test_oversized_text_rejected_and_invalid_stale_identity_and_schema():
    raw=('data: '+json.dumps(dict(type='response.output_text.delta',delta='x'*16001))+'\n\ndata: {"type":"response.completed"}\n').encode()
    client,calls,nonce=fixture(override=lambda method,url,headers,body:raw if url.endswith('/responses') else None)
    connect(client,nonce)
    payload=dict(message='help',session_id='factory',expected_revision=3,idempotency_key='large')
    assert client.post('/api/orchestrator/chat',json=payload).status_code==502
    assert client.post('/api/orchestrator/chat',json={**payload,'session_id':'old'}).status_code==409
    assert client.post('/api/orchestrator/chat',json={**payload,'message':'x'*4001}).status_code==422


def test_server_expiry_rejects_retained_browser_cookie():
    client,calls,nonce=fixture()
    connect(client,nonce)
    saved=client.cookies.get('pa_openai')
    with patch.object(m.time,'time',return_value=time.time()+700):
        response=client.get('/api/orchestrator/connection',headers={'Cookie':'pa_openai='+saved})
        assert not response.json()['connected'] and response.json()['models']==[]


def test_simultaneous_exact_replays_call_provider_once():
    from concurrent.futures import ThreadPoolExecutor
    import threading
    barrier=threading.Barrier(2)
    client,calls,nonce=fixture()
    connect(client,nonce)
    cookie=client.cookies.get('pa_openai')
    payload=dict(message='recommend',session_id='factory',expected_revision=3,idempotency_key='concurrent')
    def send():
        barrier.wait(timeout=5)
        return client.post('/api/orchestrator/chat',headers={'Cookie':'pa_openai='+cookie},json=payload)
    with ThreadPoolExecutor(max_workers=2) as pool:
        first=pool.submit(send)
        second=pool.submit(send)
        results=[first.result(timeout=5),second.result(timeout=5)]
    assert [response.status_code for response in results]==[200,200]
    assert results[0].json()==results[1].json()
    assert len([call for call in calls if call[1].endswith('/responses')])==1


def test_callback_access_log_scope_redacts_query_after_code_parsing():
    import asyncio
    client,calls,nonce=fixture()
    query=parse_qs(urlparse(client.post('/api/orchestrator/auth/start').json()['authorization_url']).query)
    nonce[0]=query['nonce'][0]
    cookie=client.cookies.get('pa_openai_pending')
    original_query=('code=private-code&state='+query['state'][0]).encode()
    scope=dict(type='http',asgi={'version':'3.0','spec_version':'2.4'},http_version='1.1',method='GET',scheme='http',path='/api/orchestrator/auth/callback',raw_path=b'/api/orchestrator/auth/callback',query_string=original_query,root_path='',headers=[(b'host',b'testserver'),(b'cookie',('pa_openai_pending='+cookie).encode())],server=('testserver',80),client=('127.0.0.1',1234))
    starts=[]
    async def receive():
        return {'type':'http.request','body':b'','more_body':False}
    async def send(event):
        if event['type']=='http.response.start':
            starts.append((event['status'],scope['query_string']))
    asyncio.run(client.app(scope,receive,send))
    assert starts==[(303,b'')]
    assert parse_qs(calls[0][3].decode())['code']==['private-code']
    assert scope['query_string']==b''
    scope.update(path='/api/orchestrator/connection', raw_path=b'/api/orchestrator/connection', query_string=b'keep=value')
    starts.clear()
    asyncio.run(client.app(scope,receive,send))
    assert starts==[(200,b'keep=value')]
    scope.update(path='/api/orchestrator/auth/callback', raw_path=b'/api/orchestrator/auth/callback', query_string=b'code=private-code&state=invalid')
    starts.clear()
    asyncio.run(client.app(scope,receive,send))
    assert starts==[(400,b'')]
