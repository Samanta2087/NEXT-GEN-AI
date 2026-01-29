// Debug wrapper to catch any startup errors
import('./server/index.ts').catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
