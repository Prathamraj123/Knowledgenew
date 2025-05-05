const express = require('express');
const serverless = require('serverless-http');
const session = require('express-session');
const bodyParser = require('body-parser');

// Create express app
const app = express();
app.use(bodyParser.json());

// Setup CORS for Netlify Functions
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000'
  ];
  
  const origin = req.headers.origin;
  
  // Allow any Netlify domain
  if (origin && (
      allowedOrigins.includes(origin) || 
      origin.endsWith('.netlify.app') || 
      origin.endsWith('.netlify.com')
    )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Set up more Netlify-friendly session management (no need for complex session storage)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'knowledge-base-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 86400000 
    },
  })
);

// In-memory storage for development (for Netlify demo purposes)
let users = [
  { id: 1, employeeId: 'E2301', password: 'password123', name: 'John Doe' },
  { id: 2, employeeId: 'E1856', password: 'password123', name: 'Jane Smith' },
  { id: 3, employeeId: 'E1406', password: 'password123', name: 'Bob Johnson' },
];

let queries = [
  {
    id: 1,
    title: "500 internal server error",
    details: "Getting 500 error when trying to save a large document in the content management system",
    answer: "This is likely due to the file size limit. The CMS has a 10MB limit on uploads. Try compressing your document or splitting it into smaller files.",
    topic: "technical",
    employeeId: "E2301",
    date: new Date('2024-04-25T10:30:00')
  },
  {
    id: 2,
    title: "How to update profile picture?",
    details: "I can't find where to change my profile picture in the new portal",
    answer: "Go to My Account > Settings > Profile Information. You'll see an 'Edit' button next to your current profile picture. Click it to upload a new image.",
    topic: "account",
    employeeId: "E1856",
    date: new Date('2024-04-28T14:15:00')
  },
  {
    id: 3,
    title: "Request for new equipment",
    details: "What is the process for requesting a new laptop?",
    answer: "Fill out the Equipment Request Form on the IT Portal. You'll need manager approval. Typical processing time is 1-2 weeks, depending on availability.",
    topic: "hardware",
    employeeId: "E1406",
    date: new Date('2024-05-01T09:15:00')
  }
];

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
};

// API routes
app.post('/api/login', (req, res) => {
  const { employeeId, password } = req.body;
  
  if (!employeeId || !password) {
    return res.status(400).json({ message: 'Employee ID and password are required' });
  }
  
  const user = users.find(u => u.employeeId === employeeId && u.password === password);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid employee ID or password' });
  }
  
  req.session.user = {
    id: user.id,
    employeeId: user.employeeId
  };
  
  return res.status(200).json({
    employeeId: user.employeeId
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to logout' });
    }
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

app.get('/api/auth-check', (req, res) => {
  if (req.session && req.session.user) {
    return res.status(200).json({
      isAuthenticated: true,
      employeeId: req.session.user.employeeId
    });
  }
  return res.status(200).json({ isAuthenticated: false });
});

app.get('/api/queries', requireAuth, (req, res) => {
  const { search, topic, employee, date } = req.query;
  
  let filteredQueries = [...queries];
  
  // Filter by search term
  if (search) {
    const term = search.toLowerCase();
    filteredQueries = filteredQueries.filter(
      query => query.title.toLowerCase().includes(term) ||
               query.details.toLowerCase().includes(term) ||
               query.answer.toLowerCase().includes(term)
    );
  }
  
  // Filter by topic
  if (topic && topic !== 'all_topics') {
    filteredQueries = filteredQueries.filter(query => query.topic === topic);
  }
  
  // Filter by employee ID
  if (employee && employee !== 'all_employees') {
    filteredQueries = filteredQueries.filter(query => query.employeeId === employee);
  }
  
  // Filter by date
  if (date && date !== 'all_time') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (date) {
      case 'today':
        filteredQueries = filteredQueries.filter(
          query => new Date(query.date) >= today
        );
        break;
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        filteredQueries = filteredQueries.filter(
          query => new Date(query.date) >= weekStart
        );
        break;
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        filteredQueries = filteredQueries.filter(
          query => new Date(query.date) >= monthStart
        );
        break;
      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        filteredQueries = filteredQueries.filter(
          query => new Date(query.date) >= yearStart
        );
        break;
    }
  }
  
  return res.status(200).json(filteredQueries);
});

app.post('/api/queries', requireAuth, (req, res) => {
  const { title, details, answer, topic } = req.body;
  
  if (!title || !details || !answer || !topic) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  
  const newQuery = {
    id: queries.length + 1,
    title,
    details,
    answer,
    topic,
    employeeId: req.session.user.employeeId,
    date: new Date()
  };
  
  queries.push(newQuery);
  
  return res.status(201).json(newQuery);
});

app.get('/api/employees', requireAuth, (req, res) => {
  const employeeIds = [...new Set(queries.map(query => query.employeeId))];
  return res.status(200).json(employeeIds);
});

// For Netlify Functions, export handler directly
exports.handler = serverless(app);