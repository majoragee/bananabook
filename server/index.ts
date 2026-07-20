import 'reflect-metadata';
import express from 'express';
import { initializeDatabase } from './data-source';
import accountRoutes from './routes/accounts';
import recurringTransactionRoutes from './routes/recurring-transactions';
import transactionRoutes from './routes/transactions';
import projectionRoutes from './routes/projections';

const app = express();

// Deliberately not PORT: the web server reads that one, and the two run side
// by side. Sharing the variable would point both at the same port. The Next
// proxy in app/api/[...path]/route.ts reads API_PORT too, so the pair stays in
// step wherever it is set.
const API_PORT = process.env.API_PORT || 3001;

// Loopback only. Browsers reach the API through the web server's /api proxy,
// so binding it to a public interface would just expose an unauthenticated
// copy alongside the app.
const API_HOST = process.env.API_HOST || '127.0.0.1';

app.use(express.json());

// Initialize database
initializeDatabase()
  .then(() => {
    console.log('Database connection established');
  })
  .catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });

// Routes
app.use('/api/accounts', accountRoutes);
app.use('/api/recurring-transactions', recurringTransactionRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/projections', projectionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(Number(API_PORT), API_HOST, () => {
  console.log(`API listening on http://${API_HOST}:${API_PORT}`);
});

export default app;
