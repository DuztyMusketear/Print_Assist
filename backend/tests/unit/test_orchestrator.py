from fastapi import FastAPI
from fastapi.testclient import TestClient
from print_assist import orchestrator as module


def test_unconfigured_is_offline_and_honest():
    app = FastAPI()
    mount = getattr(module, 'mount_orchestrator', None)
    assert callable(mount), 'orchestrator routes must be implemented'
    mount(app, None, config=module.OpenAIConfig())
    client = TestClient(app)
    state = client.get('/api/orchestrator/connection').json()
    assert not state['configured'] and not state['connected'] and state['models'] == []
    assert 'registered' in state['message']
    assert client.post('/api/orchestrator/auth/start').status_code == 409

import io
from unittest.mock import patch
import pytest
from print_assist.orchestrator import OpenAIConfig, http_transport, NoRedirect, LIMIT
from print_assist.mcp_server import create_mcp_server


@pytest.mark.parametrize('uri,expected', [('http://localhost/callback',True),('http://127.0.0.1/callback',True),('https://example.com/callback',True),('http://evil.com/callback',False),('https://user:pass@example.com/callback',False),('https://example.com/callback?x=1',False),('https://example.com/callback#x',False),('',False)])
def test_registered_callback_restrictions(uri,expected):
    assert OpenAIConfig('client',uri).configured is expected


def test_transport_bounds_timeout_and_disallows_redirects():
    with patch.object(module,'build_opener') as opener:
        opener.return_value.open.return_value.__enter__.return_value=io.BytesIO(b'ok')
        assert http_transport('GET','https://api.openai.com/v1/models',{},None)==b'ok'
        assert opener.return_value.open.call_args.kwargs['timeout']==30
        opener.return_value.open.return_value.__enter__.return_value=io.BytesIO(b'x'*(LIMIT+1))
        with pytest.raises(ValueError):
            http_transport('GET','https://api.openai.com/v1/models',{},None)
    with pytest.raises(ValueError):
        NoRedirect().redirect_request(None,None,302,'',{},'https://evil.com')


def test_ambient_configuration_reads_only_explicit_registration(monkeypatch):
    monkeypatch.setenv('PRINT_ASSIST_OPENAI_CLIENT_ID','client')
    monkeypatch.setenv('PRINT_ASSIST_OPENAI_REDIRECT_URI','http://localhost/callback')
    monkeypatch.setenv('PRINT_ASSIST_OPENAI_CLIENT_SECRET','secret')
    app=FastAPI()
    module.mount_orchestrator(app,None)
    assert TestClient(app).get('/api/orchestrator/connection').json()['configured']


@pytest.mark.parametrize('message,expected', [
    ('Where is printer p1?', ['list_printers']),
    ('Which tasks are in the queue?', ['list_tasks']),
    ('How much filament supply remains?', ['list_supplies']),
    ('Check printer 2 jobs and filament stock', ['list_printers','list_tasks','list_supplies']),
    ('Recommend a planning approach', []),
])
def test_chat_selects_only_relevant_read_only_mcp_tools(message, expected):
    assert module.mcp_tool_names_for_message(message) == expected


def test_requested_mcp_facts_fail_closed_when_connector_or_tool_is_missing():
    with pytest.raises(RuntimeError, match='connector is unavailable'):
        module.load_requested_mcp_facts('Check printer one', None)
    server=create_mcp_server(object())
    server.remove_tool('list_printers')
    with pytest.raises(RuntimeError, match='tool is unavailable'):
        module.load_requested_mcp_facts('Check printer one', server)


def test_requested_mcp_tool_error_stops_the_advice_request():
    server=create_mcp_server(object())
    server.remove_tool('list_printers')
    @server.tool(name='list_printers')
    def failing_printers() -> str:
        raise ValueError('snapshot read failed')
    with pytest.raises(RuntimeError, match='tool failed'):
        module.load_requested_mcp_facts('Check printer one', server)
