# Backend API

Node.js backend API built with TypeScript and Express.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Run the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3001` (or the port specified in `.env`).

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Type check without emitting files

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Entry point
│   ├── routes/               # API routes
│   │   └── item.routes.ts
│   ├── controllers/          # Request handlers
│   │   └── item.controller.ts
│   ├── models/               # Data models
│   │   └── item.model.ts
│   ├── types/                # TypeScript types
│   │   └── item.types.ts
│   ├── middleware/           # Express middleware
│   │   └── error.middleware.ts
│   └── utils/                # Utility functions
│       └── validation.ts
├── dist/                     # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

### Items

- `GET /api/items` - Get all items
- `GET /api/items/:id` - Get item by ID
- `POST /api/items` - Create a new item
- `PUT /api/items/:id` - Update an item
- `DELETE /api/items/:id` - Delete an item

### Health Check

- `GET /health` - Check server status

## Example Requests

### Create an item
```bash
curl -X POST http://localhost:3001/api/items \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "description": "This is a test"}'
```

### Get all items
```bash
curl http://localhost:3001/api/items
```

### Update an item
```bash
curl -X PUT http://localhost:3001/api/items/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Item"}'
```

### Delete an item
```bash
curl -X DELETE http://localhost:3001/api/items/1
```

## Notes

- Currently uses in-memory storage. Replace `ItemModel` with actual database integration (MongoDB, PostgreSQL, etc.) for production.
- Add authentication/authorization middleware as needed.
- Add request validation middleware (e.g., using `express-validator` or `zod`).

