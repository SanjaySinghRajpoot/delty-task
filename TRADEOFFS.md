# Tradeoffs & Technical Decisions

## TL;DR - The 5 Biggest Tradeoffs

### 1. SSE Instead of WebSockets

**What we did:** Used Server-Sent Events (basically one-way HTTP streaming) instead of WebSockets.

**Why it matters:**
- SSE only goes one direction (server → client). So every time you send a message, it's a new HTTP request. You can't have a persistent back-and-forth connection.
- If the model needs to call a tool and then continue chatting, we have to handle that awkwardly - the connection closes after each response.
- On the plus side: way simpler to set up. No socket.io, no connection management headaches. Works behind corporate proxies that block WebSockets.

**Impact:** Works great for simple chat. Falls apart when you need multi-step tool conversations where the model calls a tool, gets the result, and continues reasoning. We'd need WebSockets for that.

---

### 2. No Authentication

**What we did:** Skipped auth entirely. Anyone with the URL can chat.

**Why it matters:**
- Can't track who's using what. No user sessions, no conversation ownership.
- Can't do rate limiting per user (someone could spam the API and burn through our LLM credits).
- Can't persist conversations per user - everyone shares the same conversation IDs basically.

**Impact:** Fine for a demo. In production, this is a security hole AND a billing nightmare. Adding JWT auth would take ~30 min but wasn't worth it for this demo.

---

### 3. Synchronous Tool Execution

**What we did:** When the model calls a tool (like createDocument), we wait for it to finish before sending more events.

**Why it matters:**
- If a tool takes 10 seconds, the user stares at a frozen screen for 10 seconds.
- The connection stays open doing nothing. At scale, this wastes resources.
- What if the tool fails halfway? The whole response dies.

**Impact:** Works because our document tool is fast (just a DB insert). Would totally break if we added tools that call external APIs or do heavy computation.

---

### 4. One Connection Per Chat Request

**What we did:** Each message = one HTTP connection that stays open until streaming finishes.

**Why it matters:**
- Node.js has a limit on how many connections it can handle (default ~1000).
- Each open connection = memory being used.
- If 500 people chat at once, the server might choke.

**Impact:** Demo handles single user fine. With 100+ concurrent users, we'd see timeouts and dropped connections. Fix would be moving to a queue system (Redis/BullMQ) + worker processes.

---

### 5. Unified LLM Library Design

**What we did:** Built a single interface that abstracts Anthropic, Gemini (and future OpenAI) behind one consistent API.

```typescript
interface LLMProvider {
  streamChat(
    messages: LLMMessage[],
    config: LLMConfig,
    tools?: ToolDefinition[],
    onEvent?: (event: StreamEvent) => void
  ): Promise<void>;
}
```

**Why it matters:**
- Each provider SDK has completely different event shapes. Anthropic uses `content_block_delta`, Gemini uses `candidates[].content.parts`. We translate both into our unified `StreamEvent` format.
- Callback-based streaming gives fine-grained control - each token hits the client immediately, no buffering.
- Factory pattern (`createLLMProvider`) keeps provider initialization isolated. Swap providers without touching business logic.
- Adding OpenAI is ~150 lines: implement the interface, handle their delta format, map to our event types.

**Tradeoffs:**
- Used `any` in several places for SDK responses instead of proper types. Faster to write, but TypeScript can't catch bugs at compile time.
- The callback approach doesn't compose well for multi-turn tool use where you need to feed tool results back. Would need a `continueWithToolResult()` method.
- Config types are loose. Should tighten with discriminated unions per provider.

**Impact:** Clean abstraction that proves provider-agnostic streaming works. The loose typing is tech debt that will bite when adding providers or changing event format.

## Streaming Architecture

### Backend → Frontend

Using Server-Sent Events (SSE) over a standard HTTP POST. The backend writes events as they arrive from the LLM SDK, then closes the connection on `done` or `error`.

**Why SSE over WebSockets:**
- One-directional flow fits the use case. We send a message, we get tokens back.
- No connection handshake overhead. Works behind most proxies out of the box.
- Native browser support via `fetch` + `ReadableStream` - no extra libraries.

**The event format:**
```typescript
type StreamEventType = 
  | 'text_delta'      // Regular text token
  | 'thinking_delta'  // Reasoning/thinking token (Anthropic extended thinking)
  | 'tool_call_start' // Tool invocation begins
  | 'tool_call_delta' // Tool arguments streaming
  | 'tool_call_end'   // Tool finished, result available
  | 'done' | 'error';
```

Separate thinking from text at the protocol level. This lets the frontend render them independently without parsing heuristics.

### Frontend State Management

Zustand with persistence. The streaming handler updates local React state for immediate renders, then batches to the store via `useEffect` to avoid the "setState during render" warning.

**Tradeoff:** Duplicated state (local + store) during streaming. Adds complexity but solves the real-time update problem cleanly.

## What I Prioritized

1. **E2E streaming pipeline first** - got tokens flowing before polishing anything else. If streaming doesn't work, nothing else matters.

2. **Document tool with live updates** - demonstrates the full loop: user asks → model calls tool → backend executes → streams result → UI updates. This is the core demo.

3. **Provider abstraction** - needed to prove the unified interface actually works across different SDKs with different event shapes.

4. **Reasonable error states** - API key validation, provider errors surfaced to UI. Not comprehensive, but enough to debug.

## What I Intentionally Skipped

| Feature | Why |
|---------|-----|
| Multiple chat threads | Time constraint. Single conversation is enough to demo streaming. Data model supports it (conversation_id exists). |
| Auth | Would add 30+ min for JWT/session setup. Doesn't prove anything about streaming. |
| OpenAI provider | Anthropic + Gemini prove the abstraction works. OpenAI is structurally identical to implement. |
| Rich text editor | Plain markdown viewer is sufficient for demo. Real editor adds significant complexity (state sync, cursor handling). |
| Rate limiting | Dev environment only. Would add express-rate-limit or similar for production. |
| Request validation | Basic checks exist. Would add Zod schemas for production. |

## Risks & Limitations

### Scalability Concerns

**Current state:** Each chat request holds an HTTP connection open until streaming completes. Fine for demos, breaks under load.

**At 100+ concurrent users:**
- Connection pool exhaustion on the Node.js side
- Proxy timeouts (nginx/cloudflare default 60s)
- Memory pressure from accumulated response buffers

**Fix:** Move to proper queue-based architecture. Message goes to Redis/BullMQ, worker processes it, pushes events to a pub/sub channel, frontend connects via WebSocket or long-poll to that channel.

### Gemini Thinking Tokens

Gemini doesn't expose thinking/reasoning tokens the way Anthropic does. The `thinking_delta` events only fire for Anthropic. For Gemini, thinking panel stays empty.

**Fix:** Not much we can do - this is a provider limitation. Could surface Gemini's `safetyRatings` or `citationMetadata` in that space instead.

### Tool Execution is Synchronous

Tool execution blocks the streaming response. If a tool takes 10s, the connection hangs for 10s.

**Fix:** For long-running tools, immediately return a "pending" status, continue streaming, and push tool completion via separate event channel.

### No Retry Logic

LLM API fails → error event → dead. No exponential backoff, no partial recovery.

**Fix:** Wrap provider calls in retry logic with jitter. Track partial content so retries can resume.

### Database Writes Per Message

Every message INSERT hits Postgres directly. No batching, no write-ahead buffer.

**Fix:** For high-throughput, batch writes or use a write-through cache. For this demo, it's fine.

## Load Testing Notes

Haven't run formal load tests, but rough napkin math:

- SSE connection per chat = 1 file descriptor
- Node default ulimit = 1024
- Realistic ceiling without tuning = ~500 concurrent chats

Would test with `autocannon` or `k6`:
```bash
k6 run --vus 50 --duration 30s chat-load-test.js
```

Watch for: response time degradation, connection errors, memory growth.

## What's Next (Priority Order)

1. **WebSocket for multi-turn tool use** - current SSE closes after each response, can't do back-and-forth tool conversations without reconnecting

2. **OpenAI provider** - trivial to add, proves the abstraction

3. **Proper error boundaries** - frontend silently fails on some edge cases

4. **Message streaming resumption** - if connection drops mid-stream, reconnect and continue from last received token (requires server-side tracking)

5. **Multiple threads** - UI is 80% there, just need thread list sidebar and conversation switching

6. **Rate limiting + auth** - standard production hardening

## Tech Debt I'm Aware Of

- `any` types in provider implementations (rushed to get streaming working)
- Document viewer re-renders too aggressively (should debounce)
- No request cancellation - if user navigates away mid-stream, backend keeps processing
- Console.logs everywhere for debugging, should use proper logger

---

