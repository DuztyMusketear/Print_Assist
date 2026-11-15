import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {OrchestratorPanel} from './OrchestratorPanel';
import {state} from '../test-fixtures';
const connection={configured:true,connected:true,account_label:'Workshop owner',message:'Connected',models:[{id:'test-model',name:'Test model'}]};
const response=(body:unknown,ok=true,status=ok?200:502)=>({ok,status,json:async()=>body});
test('reads connection without sending a prompt and sends only explicit user messages',async()=>{
 const request=vi.fn().mockResolvedValueOnce(response(connection)).mockResolvedValueOnce(response({reply:'Review your queue.',model:'test-model',read_only:true}));vi.stubGlobal('fetch',request);
 render(<OrchestratorPanel state={state}/>);
 await screen.findByText('Workshop owner');expect(request).toHaveBeenCalledTimes(1);
 expect(screen.queryByRole('heading',{name:'ChatGPT setup required'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Message orchestrator'),{target:{value:'Factory status'}});
 fireEvent.click(screen.getByRole('button',{name:'Send message'}));await screen.findByText('Review your queue.');
 expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({message:'Factory status',session_id:state.session_id,expected_revision:0});
});
test('displays configuration requirements and no fabricated conversation',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({...connection,configured:false,connected:false,message:'Client registration needed.'})));
 render(<OrchestratorPanel state={state}/>);await screen.findByText('Client registration needed.');expect(screen.getByRole('button',{name:'Send message'})).toBeDisabled();
 expect(screen.getByRole('heading',{name:'ChatGPT setup required'})).toBeVisible();
 expect(screen.getByRole('link',{name:'OpenAI website registration guide'})).toHaveAttribute('href','https://developers.openai.com/siwc/website');
 expect(screen.getByLabelText('Callback URL to register')).toHaveValue(window.location.origin+'/api/orchestrator/auth/callback');
 expect(screen.getByText('PRINT_ASSIST_OPENAI_CLIENT_ID')).toBeVisible();
 expect(screen.getByText('PRINT_ASSIST_OPENAI_REDIRECT_URI')).toBeVisible();
 expect(screen.getByRole('button',{name:'Continue with ChatGPT'})).toBeDisabled();
});
test('retains failed message and retries the exact request',async()=>{
 const request=vi.fn().mockResolvedValueOnce(response(connection)).mockResolvedValueOnce(response({detail:'Try again'},false)).mockResolvedValueOnce(response({reply:'Done',model:'test-model',read_only:true}));vi.stubGlobal('fetch',request);
 render(<OrchestratorPanel state={state}/>);await screen.findByText('Workshop owner');fireEvent.change(screen.getByLabelText('Message orchestrator'),{target:{value:'Optimize schedule'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));await screen.findByRole('alert');expect(screen.getByLabelText('Message orchestrator')).toHaveValue('Optimize schedule');fireEvent.click(screen.getByRole('button',{name:'Retry message'}));await waitFor(()=>expect(request).toHaveBeenCalledTimes(3));expect(request.mock.calls[2][1].body).toBe(request.mock.calls[1][1].body);
});
test('starts authentication, refreshes the account, selects a model and signs out',async()=>{
 const disconnected={...connection,connected:false,account_label:null,message:'Sign in to continue'};
 const opened=vi.spyOn(window,'open').mockImplementation(()=>null);const changed=vi.fn();
 const request=vi.fn().mockResolvedValueOnce(response(disconnected)).mockResolvedValueOnce(response({authorization_url:'https://auth.openai.com/authorize'})).mockResolvedValueOnce(response(connection)).mockResolvedValueOnce(response(disconnected));vi.stubGlobal('fetch',request);
 render(<OrchestratorPanel state={state} onConnectionChange={changed}/>);await screen.findByText('Sign in to continue');fireEvent.click(screen.getByRole('button',{name:'Continue with ChatGPT'}));await waitFor(()=>expect(opened).toHaveBeenCalledWith('https://auth.openai.com/authorize','_self'));fireEvent.click(screen.getByRole('button',{name:'Refresh connection'}));await screen.findByText('Workshop owner');fireEvent.change(screen.getByLabelText('Model'),{target:{value:'test-model'}});expect(screen.getByLabelText('Model')).toHaveValue('test-model');fireEvent.click(screen.getByRole('button',{name:'Sign out'}));await screen.findByText('Sign in to continue');expect(changed).toHaveBeenCalledTimes(3);opened.mockRestore();
});
test.each(['auth/start','logout'])('%s failure is visible without losing connection state',async path=>{
 const request=vi.fn().mockResolvedValueOnce(response({...connection,connected:path==='logout'})).mockResolvedValueOnce(response({},false));vi.stubGlobal('fetch',request);render(<OrchestratorPanel state={state}/>);await screen.findByText(path==='logout'?'Workshop owner':'Connected');fireEvent.click(screen.getByRole('button',{name:path==='logout'?'Sign out':'Continue with ChatGPT'}));expect(await screen.findByRole('alert')).toHaveTextContent('The orchestrator request failed. Try again.');
});
test('connection errors can be refreshed and suggestions fill the composer without sending',async()=>{
 const request=vi.fn().mockRejectedValueOnce(new Error('Connection unavailable')).mockResolvedValueOnce(response(connection));vi.stubGlobal('fetch',request);render(<OrchestratorPanel state={state}/>);await screen.findByText('Connection unavailable');fireEvent.click(screen.getByRole('button',{name:'Refresh connection'}));await screen.findByText('Workshop owner');fireEvent.click(screen.getByRole('button',{name:'Factory status'}));expect(screen.getByLabelText('Message orchestrator')).toHaveValue('Factory status');expect(request).toHaveBeenCalledTimes(2);fireEvent.change(screen.getByLabelText('Message orchestrator'),{target:{value:'   '}});fireEvent.submit(screen.getByLabelText('Message orchestrator').closest('form')!);expect(request).toHaveBeenCalledTimes(2);
});
test('ignores connection responses after unmount',async()=>{
 let resolve!:(value:unknown)=>void;const changed=vi.fn();vi.stubGlobal('fetch',vi.fn().mockReturnValue(new Promise(done=>{resolve=done;})));const {unmount}=render(<OrchestratorPanel state={state} onConnectionChange={changed}/>);unmount();resolve(response(connection));await new Promise(done=>setTimeout(done,0));expect(changed).not.toHaveBeenCalled();
});
test.each(['success','failure'])('ignores late chat %s after unmount',async outcome=>{
 let complete!:(value:unknown)=>void;const request=vi.fn().mockResolvedValueOnce(response(connection)).mockReturnValueOnce(new Promise(done=>{complete=done;}));vi.stubGlobal('fetch',request);const {unmount}=render(<OrchestratorPanel state={state}/>);await screen.findByText('Workshop owner');fireEvent.change(screen.getByLabelText('Model'),{target:{value:'test-model'}});fireEvent.change(screen.getByLabelText('Message orchestrator'),{target:{value:'Status'}});const form=screen.getByLabelText('Message orchestrator').closest('form')!;fireEvent.submit(form);fireEvent.submit(form);expect(request).toHaveBeenCalledTimes(2);unmount();complete(response(outcome==='success'?{reply:'Status',model:'test-model',read_only:true}:{detail:'Unavailable'},outcome==='success'));await new Promise(done=>setTimeout(done,0));
});
test('ignores late failed connection after unmount',async()=>{
 let reject!:(value:unknown)=>void;vi.stubGlobal('fetch',vi.fn().mockReturnValue(new Promise((_done,fail)=>{reject=fail;})));const {unmount}=render(<OrchestratorPanel state={state}/>);unmount();reject(new Error('Unavailable'));await new Promise(done=>setTimeout(done,0));
});

test('rejected stale requests can be resubmitted with current state and a fresh key',async()=>{
 const request=vi.fn().mockResolvedValueOnce(response(connection)).mockResolvedValueOnce(response({detail:'Refresh workshop'},false,409)).mockResolvedValueOnce(response({reply:'Current workshop',read_only:true,model:'test-model'}));vi.stubGlobal('fetch',request);const {rerender}=render(<OrchestratorPanel state={state}/>);await screen.findByText('Workshop owner');fireEvent.change(screen.getByLabelText('Message orchestrator'),{target:{value:'Status'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));await screen.findByText('Refresh workshop');rerender(<OrchestratorPanel state={{...state,revision:5}}/>);fireEvent.click(screen.getByRole('button',{name:'Send message'}));await screen.findByText('Current workshop');const first=JSON.parse(request.mock.calls[1][1].body),second=JSON.parse(request.mock.calls[2][1].body);expect(second.expected_revision).toBe(5);expect(second.idempotency_key).not.toBe(first.idempotency_key);
});
test.each(['auth/start','logout'])('ignores late %s success after unmount',async path=>{
 let complete!:(value:unknown)=>void;const opened=vi.spyOn(window,'open').mockImplementation(()=>null);const changed=vi.fn();vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response({...connection,connected:path==='logout'})).mockReturnValueOnce(new Promise(done=>{complete=done;})));const {unmount}=render(<OrchestratorPanel state={state} onConnectionChange={changed}/>);await screen.findByText(path==='logout'?'Workshop owner':'Connected');fireEvent.click(screen.getByRole('button',{name:path==='logout'?'Sign out':'Continue with ChatGPT'}));unmount();complete(response(path==='logout'?connection:{authorization_url:'https://auth.openai.com/authorize'}));await new Promise(done=>setTimeout(done,0));expect(changed).toHaveBeenCalledTimes(1);expect(opened).not.toHaveBeenCalled();opened.mockRestore();
});
test.each(['auth/start','logout'])('ignores late %s failure after unmount',async path=>{
 let fail!:(value:unknown)=>void;vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response({...connection,connected:path==='logout'})).mockReturnValueOnce(new Promise((_done,reject)=>{fail=reject;})));const {unmount}=render(<OrchestratorPanel state={state}/>);await screen.findByText(path==='logout'?'Workshop owner':'Connected');fireEvent.click(screen.getByRole('button',{name:path==='logout'?'Sign out':'Continue with ChatGPT'}));unmount();fail(new Error('Unavailable'));await new Promise(done=>setTimeout(done,0));
});


test('discarding a failed request unlocks editing without another provider request',async()=>{
 const request=vi.fn().mockResolvedValueOnce(response(connection)).mockResolvedValueOnce(response({detail:'Provider did not complete'},false,502)).mockResolvedValueOnce(response({reply:'Fresh recommendation',model:'test-model',read_only:true}));
 vi.stubGlobal('fetch',request);render(<OrchestratorPanel state={state}/>);await screen.findByText('Workshop owner');
 fireEvent.change(screen.getByLabelText('Message orchestrator'),{target:{value:'Original question'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));await screen.findByText('Provider did not complete');
 fireEvent.click(screen.getByRole('button',{name:'Discard pending message'}));expect(request).toHaveBeenCalledTimes(2);
 expect(screen.getByLabelText('Message orchestrator')).toBeEnabled();
 fireEvent.change(screen.getByLabelText('Message orchestrator'),{target:{value:'New question'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));await screen.findByText('Fresh recommendation');
 const first=JSON.parse(request.mock.calls[1][1].body),second=JSON.parse(request.mock.calls[2][1].body);
 expect(second.idempotency_key).not.toBe(first.idempotency_key);expect(second.message).toBe('New question');
});
