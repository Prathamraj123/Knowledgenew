import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertQuerySchema } from "@shared/schema";
import { z } from "zod";

// Define a custom login schema here to avoid any caching issues
const loginSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  password: z.string().min(1, "Password is required"),
  captcha: z.string().min(1, "Please enter the CAPTCHA code"),
});
import { ZodError } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up session management
  const MemStoreSession = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'knowledge-base-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 86400000 }, // 24 hours
    store: new MemStoreSession({ checkPeriod: 86400000 }) // Cleanup expired sessions
  }));
  
  // Authentication middleware
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (req.session && req.session.user) {
      return next();
    }
    return res.status(401).json({ message: 'Unauthorized' });
  };

  // Login route
  app.post('/api/login', async (req: Request, res: Response) => {
    try {
      // Validate request data
      const validatedData = loginSchema.parse(req.body);
      
      // Authenticate user (check employeeId and password)
      const user = await storage.getUserByEmployeeId(validatedData.employeeId);
      
      if (!user || user.password !== validatedData.password) {
        return res.status(401).json({ message: 'Invalid employee ID or password' });
      }
      
      // Set user in session
      req.session.user = {
        id: user.id,
        employeeId: user.employeeId
      };
      
      return res.status(200).json({
        employeeId: user.employeeId
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Logout route
  app.post('/api/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });

  // Check auth status
  app.get('/api/auth-check', (req: Request, res: Response) => {
    if (req.session && req.session.user) {
      return res.status(200).json({
        isAuthenticated: true,
        employeeId: req.session.user.employeeId
      });
    }
    return res.status(200).json({ isAuthenticated: false });
  });

  // Get all queries
  app.get('/api/queries', requireAuth, async (req: Request, res: Response) => {
    try {
      // Extract query parameters
      const search = req.query.search as string || '';
      const topic = req.query.topic as string;
      const employee = req.query.employee as string;
      const date = req.query.date as string;
      
      // Log the query parameters for debugging
      console.log('Query filters:', { search, topic, employee, date });
      
      // Process filter values - convert special values to empty strings
      const topicFilter = !topic || topic === "all_topics" ? "" : topic;
      const employeeFilter = !employee || employee === "all_employees" ? "" : employee;
      const dateFilter = !date || date === "all_time" ? "" : date;
      
      // Log the processed filters
      console.log('Processed filters:', { topicFilter, employeeFilter, dateFilter });
      
      // Search with processed filters
      const queries = await storage.searchQueries(
        search, 
        topicFilter, 
        employeeFilter, 
        dateFilter
      );
      
      // Log the result count
      console.log(`Found ${queries.length} matching queries`);
      
      return res.status(200).json(queries);
    } catch (error) {
      console.error('Error in /api/queries:', error);
      return res.status(500).json({ message: 'Failed to fetch queries' });
    }
  });

  // Add new query
  app.post('/api/queries', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      
      // Validate request data
      const validatedData = insertQuerySchema.parse({
        ...req.body,
        employeeId: user.employeeId
      });
      
      // Create new query
      const newQuery = await storage.createQuery(validatedData);
      
      return res.status(201).json(newQuery);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      
      return res.status(500).json({ message: 'Failed to create query' });
    }
  });

  // Get all employees for filter dropdown
  app.get('/api/employees', requireAuth, async (req: Request, res: Response) => {
    try {
      const queries = await storage.getAllQueries();
      
      // Use a more compatible way to get unique employee IDs
      const uniqueEmployeeIds: string[] = [];
      const employeeIdSet = new Set<string>();
      
      queries.forEach(query => {
        if (!employeeIdSet.has(query.employeeId)) {
          employeeIdSet.add(query.employeeId);
          uniqueEmployeeIds.push(query.employeeId);
        }
      });
      
      return res.status(200).json(uniqueEmployeeIds);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch employees' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
