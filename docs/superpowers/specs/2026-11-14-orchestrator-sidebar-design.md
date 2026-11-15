# Unified simulation controls and signed-in manufacturing assistant

The user wants the sidebar to follow the supplied reference: Orchestrator chat,
one Scenario controls section, then an Agent network. Event injection and workshop
reset belong to the same simulation workflow; they must not be presented as two
unrelated scenario features. Existing deterministic production/recovery behavior
and explicit reset acknowledgement remain intact.

The assistant uses the user's OpenAI account through the supported Sign in with
ChatGPT website Authorization Code + PKCE/OIDC flow. This repository is a business
prototype without an inspected open-source license; do not assume it is eligible
for dynamic open-source client registration. The selected adapter requires a
registered OAuth client/callback and approved Responses inference permissions.
A genuine Continue with ChatGPT prompt is provided. Missing registration is shown
as setup required; no fake connected badge or fabricated GPT reply is permitted.

Keep provider integration separate from shared manufacturing state. Short-lived
browser-bound OAuth transactions and account tokens remain server-side in memory,
never in frontend storage or production snapshots. Validate signature, issuer,
audience, expiry, nonce and state; consume callbacks once. Signed-in requests must
also carry the granted ChatGPT plan inference scope. No existing Codex credentials
are read or reused and no Codex process, shell or general-purpose agent is exposed.

Chat is initially read-only advice grounded in a compact current factory snapshot.
The user's prompt triggers one bounded Responses request; normal polling/clock
operations never invoke a model. Requests use store=false, stream=true and succeed
only after response.completed. Existing deterministic controls retain approval and
safety authority. Quick actions ask for status, deadline priorities and schedule
recommendations; they do not claim to apply changes or control equipment.

Network cards distinguish connected Orchestrator from unavailable modeling/review/
support reasoning and deterministic scheduling/printing/monitoring tools. This is
not a fabricated multi-agent deployment. Connection/account status, send/error/retry
behavior, callback failures and all provider traffic are tested with offline fakes.
The developer never executes a live sign-in or paid model test.

Official references inspected:
- https://developers.openai.com/siwc/website
- https://developers.openai.com/siwc/quickstart
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt

The registered identity integration is not automatically a grant of model inference.
Local open-source dynamic registration is documented separately but is not enabled
by assuming this application's publication/licensing status.
