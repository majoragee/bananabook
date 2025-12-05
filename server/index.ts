import 'reflect-metadata';
import express from 'express';
import { initializeDatabase } from './data-source';
import accountRoutes from './routes/accounts';
import recurringTransactionRoutes from './routes/recurring-transactions';
import transactionRoutes from './routes/transactions';
import projectionRoutes from './routes/projections';

const app = express();
const PORT = process.env.PORT || 3001;

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

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
