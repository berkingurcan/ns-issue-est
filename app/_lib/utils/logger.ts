import pino from 'pino';

// In Next.js, we need to use synchronous logging to avoid worker thread issues
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Don't use pino-pretty in Next.js due to worker thread compatibility
  // Use basic console output instead
  browser: {
    asObject: true,
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

export default logger;
