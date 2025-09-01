import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 100 users
    { duration: '3m', target: 15 },   // Ramp up to 500 users
    { duration: '5m', target: 30 },  // Ramp up to 1000 users
    { duration: '5m', target: 35 },  // Stay at 1000 users
    { duration: '3m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    'http_req_duration{name:createUser}': ['p(95)<3000'],
    'http_req_duration{name:createCompany}': ['p(95)<3000'],
    'http_req_duration{name:createJob}': ['p(95)<2000'],
    'http_req_duration{name:applyForJob}': ['p(95)<3000'],
  },
};

// Base URL for your API
const BASE_URL = 'http://localhost:5000/api';

// Generate test data
const users = new SharedArray('users', function() {
  return Array(1500).fill(0).map((_, i) => ({
    email: `user${i}@example.com`,
    password: 'Password123!',
    firstName: `FirstName${i}`,
    lastName: `LastName${i}`,
  }));
});

const companies = new SharedArray('companies', function() {
  return Array(500).fill(0).map((_, i) => ({
    email: `company${i}@example.com`,
    password: 'Password123!',
    companyName: `Company ${i}`,
    industry: randomItem(['Technology', 'Healthcare', 'Finance', 'Education', 'Retail']),
    location: randomItem(['New York', 'San Francisco', 'London', 'Tokyo', 'Berlin']),
    size: randomItem(['1-10', '11-50', '51-200', '201-500', '501+']),
  }));
});

// Store created entities and tokens
let userTokens = {};
let companyTokens = {};
let createdJobs = [];

export default function() {
  // Pick random user/company based on VU ID to ensure consistent behavior across iterations
  const userIndex = __VU % users.length;
  const companyIndex = __VU % companies.length;
  
  const userData = users[userIndex];
  const companyData = companies[companyIndex];
  
  // User registration and login flow
  group('User registration and authentication', function() {
    if (!userTokens[userIndex]) {
      // Register user
      let res = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: 'user'
      }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'createUser' }
      });
      
      check(res, {
        'User registration successful': (r) => r.status === 201 || r.status === 200 || r.status === 409, // 409 if user exists
      });
      
      sleep(1);
      
      // Login user
      res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
        email: userData.email,
        password: userData.password
      }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'loginUser' }
      });
      
      check(res, {
        'User login successful': (r) => r.status === 200,
        'User received token': (r) => r.json('token') !== undefined,
      });
      
      if (res.status === 200) {
        userTokens[userIndex] = res.json('token');
      }
      
      sleep(1);
    }
  });
  
  // Company registration and login flow
  group('Company registration and authentication', function() {
    if (!companyTokens[companyIndex]) {
      // Register company
      let res = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
        email: companyData.email,
        password: companyData.password,
        companyName: companyData.companyName,
        industry: companyData.industry,
        location: companyData.location,
        size: companyData.size,
        role: 'employer'
      }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'createCompany' }
      });
      
      check(res, {
        'Company registration successful': (r) => r.status === 201 || r.status === 200 || r.status === 409, // 409 if company exists
      });
      
      sleep(1);
      
      // Login company
      res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
        email: companyData.email,
        password: companyData.password
      }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'loginCompany' }
      });
      
      check(res, {
        'Company login successful': (r) => r.status === 200,
        'Company received token': (r) => r.json('token') !== undefined,
      });
      
      if (res.status === 200) {
        companyTokens[companyIndex] = res.json('token');
      }
      
      sleep(1);
    }
  });
  
  // Company creates job postings
  group('Job posting creation', function() {
    if (companyTokens[companyIndex]) {
      const jobTitle = `${companyData.industry} Position ${userIndex}`;
      
      const res = http.post(`${BASE_URL}/jobs`, JSON.stringify({
        title: jobTitle,
        location: companyData.location,
        description: `This is a job posting for ${jobTitle}`,
        requirements: `Requirements for ${jobTitle}`,
        type: randomItem(['Full-time', 'Part-time', 'Contract', 'Internship']),
        salary: `${randomIntBetween(30, 200)}k-${randomIntBetween(40, 250)}k`,
        skills: ['JavaScript', 'React', 'Node.js'],
        experience: randomIntBetween(1, 7),
        education: randomItem(['Bachelor', 'Master', 'PhD', 'High School']),
        featured: Math.random() > 0.8, // 20% chance to be featured
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        status: 'active'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${companyTokens[companyIndex]}`
        },
        tags: { name: 'createJob' }
      });
      
      check(res, {
        'Job creation successful': (r) => r.status === 201 || r.status === 200,
      });
      
      if (res.status === 201 || res.status === 200) {
        // Store job ID for later use
        try {
          const jobId = res.json('_id') || res.json('id') || res.json('job._id') || res.json('job.id');
          if (jobId) {
            createdJobs.push(jobId);
          }
        } catch (e) {
          // Job ID not available in response
        }
      }
      
      sleep(2);
    }
  });
  
  // Users search for jobs
  group('Job search', function() {
    if (userTokens[userIndex]) {
      // Browse all jobs
      let res = http.get(`${BASE_URL}/jobs`, {
        headers: { 'Authorization': `Bearer ${userTokens[userIndex]}` },
        tags: { name: 'getAllJobs' }
      });
      
      check(res, {
        'Get all jobs successful': (r) => r.status === 200,
      });
      
      sleep(1);
      
      // Featured jobs
      res = http.get(`${BASE_URL}/jobs?featured=true`, {
        headers: { 'Authorization': `Bearer ${userTokens[userIndex]}` },
        tags: { name: 'getFeaturedJobs' }
      });
      
      check(res, {
        'Get featured jobs successful': (r) => r.status === 200,
      });
      
      sleep(1);
      
      // Search by location
      const randomLocation = randomItem(['New York', 'San Francisco', 'London', 'Tokyo', 'Berlin']);
      res = http.get(`${BASE_URL}/jobs?location=${randomLocation}`, {
        headers: { 'Authorization': `Bearer ${userTokens[userIndex]}` },
        tags: { name: 'searchJobsByLocation' }
      });
      
      check(res, {
        'Search jobs by location successful': (r) => r.status === 200,
      });
      
      sleep(1);
    }
  });
  
  // Users apply for jobs
  group('Job application', function() {
    if (userTokens[userIndex] && createdJobs.length > 0) {
      // Pick a random job to apply for
      const jobId = randomItem(createdJobs);
      
      const res = http.post(`${BASE_URL}/applications/apply`, JSON.stringify({
        jobId: jobId,
        coverLetter: `I am applying for this position because I'm interested in ${companies[companyIndex].industry}.`,
        resume: 'base64encodedresume' // In a real test, you might want to generate actual file data
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userTokens[userIndex]}`
        },
        tags: { name: 'applyForJob' }
      });
      
      check(res, {
        'Job application successful': (r) => r.status === 201 || r.status === 200 || r.status === 409, // 409 if already applied
      });
      
      sleep(2);
    }
  });
  
  // Companies review applications
  group('Application review', function() {
    if (companyTokens[companyIndex] && createdJobs.length > 0) {
      // Get job ID associated with this company
      const jobId = createdJobs[companyIndex % createdJobs.length];
      
      // Get applications for the job
      let res = http.get(`${BASE_URL}/applications/job/${jobId}`, {
        headers: { 'Authorization': `Bearer ${companyTokens[companyIndex]}` },
        tags: { name: 'getJobApplications' }
      });
      
      check(res, {
        'Get job applications successful': (r) => r.status === 200,
      });
      
      try {
        const applications = res.json('applications') || [];
        
        if (applications.length > 0) {
          // Update application status for the first application
          const applicationId = applications[0]._id || applications[0].id;
          
          const updateRes = http.put(`${BASE_URL}/applications/${applicationId}/status`, JSON.stringify({
            status: randomItem(['reviewed', 'interviewing', 'rejected', 'accepted'])
          }), {
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${companyTokens[companyIndex]}`
            },
            tags: { name: 'updateApplicationStatus' }
          });
          
          check(updateRes, {
            'Update application status successful': (r) => r.status === 200,
          });
        }
      } catch (e) {
        // No applications or error parsing response
      }
      
      sleep(2);
    }
  });
  
  // Company checks application statistics
  group('Application statistics', function() {
    if (companyTokens[companyIndex]) {
      // Get company application stats
      const res = http.get(`${BASE_URL}/applications/stats/company`, {
        headers: { 'Authorization': `Bearer ${companyTokens[companyIndex]}` },
        tags: { name: 'getCompanyStats' }
      });
      
      check(res, {
        'Get company stats successful': (r) => r.status === 200,
      });
      
      sleep(1);
    }
  });
  
  // Simulate thinking time between user actions
  sleep(randomIntBetween(1, 5));
}