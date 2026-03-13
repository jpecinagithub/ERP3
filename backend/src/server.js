import { testConnection, closePool } from './config/database.js';
import app from './app.js';
const PORT = process.env.PORT || 3000;

// Start server
const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Test database connection on startup
  try {
    console.log('Testing database connection...');
    await testConnection();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error.message);
    console.error('Server will continue running, but database operations will fail');
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Close server
  server.close(async () => {
    console.log('HTTP server closed');
    
    // Close database pool
    try {
      await closePool();
      console.log('Database connections closed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error.message);
      process.exit(1);
    }
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
