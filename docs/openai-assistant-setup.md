# OpenAI account connection for the manufacturing assistant

The Orchestrator panel uses Continue with ChatGPT and the supported website OAuth
Authorization Code + PKCE/OIDC integration. It does not use a pasted API key or the
developer's Codex credentials. A registered client is required before this website
integration can open authorization successfully. The UI shows setup required until
registration is configured, and it never presents a fake connected account.

## Registration and runtime configuration

If Continue with ChatGPT is disabled, the API reports that its client ID/callback
configuration is missing or invalid. The panel shows **ChatGPT setup required**,
the official registration guide, a selectable callback for the current browser
origin, and the two server setting names. Refreshing the panel cannot create an
OAuth registration. An ordinary ChatGPT subscription does not register this app.

Register Print Assist with OpenAI for website Sign in with ChatGPT. The registered
client must be approved for the requested ChatGPT-plan Responses permissions, not
only identity sign-in. As checked on November 14, 2026, the official website guide
describes access as a limited trial for selected commercial partners and directs
interested partners to their OpenAI representative. Registration availability and
inference approval remain external prerequisites; development cannot supply them.
The separate dynamic open-source flow is not assumed here: this repository's
publication/licensing status has not been established for that registration route.

For the ordinary local preview, register this exact callback:

`http://127.0.0.1:5173/api/orchestrator/auth/callback`

Use the same browser host (127.0.0.1, not localhost) and registered port/path. The
Vite development proxy forwards `/api` to the local FastAPI process. A deployed
site should use its exact registered HTTPS callback instead.

Set these server process environment variables before starting FastAPI:

```powershell
$env:PRINT_ASSIST_OPENAI_CLIENT_ID='oaiapp_YOUR_REGISTERED_CLIENT_ID'
$env:PRINT_ASSIST_OPENAI_REDIRECT_URI='http://127.0.0.1:5173/api/orchestrator/auth/callback'
```

These example values are public registration metadata, not working credentials.
For a confidential client only, load `PRINT_ASSIST_OPENAI_CLIENT_SECRET` into the
server environment through your secret manager. Public clients do not use it.
Do not put tokens or secrets into frontend environment variables or production
snapshots. Restart the API after changing registration settings.

The backend requests identity plus `offline_access`, `resource.invoke` and
`chatgpt.tokens.use.direct` for resource `https://api.openai.com/v1`. It requires both
inference permissions in the actual returned grant before enabling chat. An identity
sign-in alone does not authorize model requests.

## Connect and use

1. Open Overview > Orchestrator and choose Continue with ChatGPT.
2. Complete the OpenAI account/permission screen. The callback returns to Print Assist.
3. The panel displays the connected account and its available models. Choose a model
   or Account default, type a question or choose a suggestion, then Send.
4. Replies are read-only recommendations grounded in the captured factory state.
   Existing production controls still require their ordinary confirmation/safety rules.
5. Sign out clears the local connection and conversation. To start another request
   after a failed provider attempt, discard the pending message and explicitly Send
   a new message. Retry preserves its original request identity to avoid duplicate use.

The application currently keeps account tokens only in server memory. A server restart
or token expiry requires signing in again; automatic token refresh, persistent account
profiles and workspace switching are not implemented. No account is automatically
selected from credentials belonging to the development environment.

## Scope and offline verification

The assistant makes one bounded request per explicit message. Factory polling, clock
advancement, simulated faults and scenario events never invoke it. The Responses
request does not store conversation remotely and consumes the provider stream through
its completion event. Failures/interruptions do not become successful advice, and
read-only chat cannot execute shell commands or production tools. A factory reset
invalidates an in-flight reply; ordinary clock ticks do not duplicate the request.

The Agent network distinguishes the connected Orchestrator from unavailable specialist
agents and ordinary deterministic production tools. The header says automatic agents
remain off even when a manual assistant account is connected. Model-driven autonomous
manufacturing and specialist delegation remain unimplemented.

OAuth tokens never reach JavaScript, production snapshots or logs. The callback's
query is removed before the HTTP access entry is emitted. Verification covers PKCE,
nonce/state, JWT signature/issuer/audience/expiry, actual granted permissions, browser
binding, CSRF, connection expiry, bounded completed inference, replay and reset using
fake transports and generated test signing keys. Development did not perform live
sign-in or model inference. An actual registered-client/account acceptance check must
be done separately by the owner after registration.

## Official integration references

- [Website Sign in with ChatGPT](https://developers.openai.com/siwc/website)
- [Sign-in integration choices](https://developers.openai.com/siwc/quickstart)
- [Model access and completed Responses requests](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Separate local open-source registration flow](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
