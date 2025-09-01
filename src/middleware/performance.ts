import { Request, Response, NextFunction } from 'express';

export const performanceLogger = (req: Request, res: Response, next: NextFunction) => {
  // Record start time
  const start = process.hrtime();
  
  // Add response listener to calculate duration when request completes
  res.on('finish', () => {
    // Calculate duration in milliseconds
    const diff = process.hrtime(start);
    const duration = diff[0] * 1000 + diff[1] / 1000000; // Convert to milliseconds
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    console.log(`${req.method} ${req.originalUrl} completed in ${duration.toFixed(2)}ms`);
    console.log(`Memory usage: RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB, Heap: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}/${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  });
  
  next();
};