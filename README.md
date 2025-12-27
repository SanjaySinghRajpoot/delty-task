# Delty Full-Stack Take-Home Assignment

A full-stack chat application with AI-powered document creation, featuring real-time streaming, unified LLM provider interface, and live document updates.

## Features

- **Unified LLM Library**: Single interface supporting Anthropic Claude and Google Gemini
- **Real-time Streaming**: Server-Sent Events (SSE) for text, thinking, and tool events
- **Document Creation Tool**: AI can create and update documents with live streaming updates
- **Modern UI**: React + TypeScript frontend with Tiptap editor for document viewing

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Tiptap
- **Backend**: Express, TypeScript
- **Database**: PostgreSQL

## Setup

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- API keys for Anthropic and/or Gemini

### 1. Start PostgreSQL Database

```bash
docker-compose up -d
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory (database credentials from `docker-compose.yml`):

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
# Database credentials (from docker-compose.yml)
DB_NAME=delty-task
DB_USER=postgres
DB_PASSWORD=postgres
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key
DEFAULT_LLM_PROVIDER=gemini
```

Start the backend:

```bash
npm run dev
```

The backend will automatically initialize the database schema on startup.

### 3. Frontend Setup

```bash
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## Usage

1. Navigate to `http://localhost:3000`
2. Click "Start Chatting"
3. Try prompts like:
   - "Create me a document with five different jokes."
   - "Create a short report about large language models."
   - "Update the document to add 3 more paragraphs."

## Architecture

### Unified LLM Library

The backend includes a unified LLM library (`backend/src/llm/`) that provides a single interface for multiple providers:

- **Providers**: `AnthropicProvider`, `GeminiProvider`
- **Factory**: `createLLMProvider()` creates provider instances
- **Streaming**: All providers emit unified `StreamEvent` types

### Streaming Events

The system streams three types of events:

1. **text_delta**: Assistant text as it's generated
2. **thinking_delta**: Provider-specific reasoning/thinking tokens
3. **tool_call_***: Tool execution events (start, delta, end)

### Document Tool

The document tool (`createDocument`, `updateDocument`) allows the AI to:
- Create new documents with title and content
- Update existing documents by appending content
- Stream document updates in real-time to the frontend

## Project Structure

```
delty-task/
├── backend/
│   ├── src/
│   │   ├── llm/              # Unified LLM library
│   │   │   ├── types.ts
│   │   │   ├── factory.ts
│   │   │   ├── providers/    # Provider implementations
│   │   │   └── tools/         # Tool definitions
│   │   ├── controllers/       # Request handlers
│   │   ├── models/            # Database models
│   │   ├── routes/            # API routes
│   │   └── utils/             # Utilities (DB, etc.)
│   └── package.json
├── src/
│   ├── app/
│   │   ├── chat/              # Chat page
│   │   └── page.tsx            # Home page
│   └── components/
│       └── chat/               # Chat components
└── package.json
```

## API Endpoints

- `POST /api/chat/stream` - Stream chat response (SSE)
- `GET /api/chat/messages/:conversation_id` - Get conversation history
- `GET /api/chat/documents/:document_id` - Get document

## Notes

- The database schema is automatically created on backend startup
- Default provider can be changed via `DEFAULT_LLM_PROVIDER` env var
- Document updates stream in real-time as the tool executes
- Thinking stream is available but may vary by provider
