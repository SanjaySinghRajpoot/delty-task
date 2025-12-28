import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat.routes';
import { initDatabase } from './utils/db';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // In development mode or if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
};

// Middleware
// Configure helmet to allow SSE
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for SSE
}));
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// API routes
app.use('/api/chat', chatRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize database and start server
initDatabase()
  .then(() => {
    // Check for required API keys
    const defaultProvider = process.env.DEFAULT_LLM_PROVIDER || 'gemini';
    if (defaultProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️  WARNING: ANTHROPIC_API_KEY is not set in environment variables');
      console.warn('   Set it in your .env file to use Anthropic Claude');
    }
    if (defaultProvider === 'gemini' && !process.env.GEMINI_API_KEY) {
      console.warn('⚠️  WARNING: GEMINI_API_KEY is not set in environment variables');
      console.warn('   Set it in your .env file to use Google Gemini');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📝 Default LLM Provider: ${defaultProvider}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

export default app;

