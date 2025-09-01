import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// More conservative test configuration with fewer users and longer pauses
export const options = {
  stages: [
    { duration: '10s', target: 1 },    // Start with just 1 user
    { duration: '20s', target: 3 },    // Gradually increase to 3
    { duration: '30s', target: 5 },    // Peak at 5 users
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
  },
};

// Base URL for your API
const BASE_URL = 'http://localhost:5000/api';

// Generate user test data - smaller set for focused test
const users = new SharedArray('users', function() {
  return Array(10).fill(0).map((_, i) => ({
    email: `testuser${i}_${Date.now()}@gmail.com`, // Make email unique with timestamp
    password: 'password123',
    firstName: `Test${i}`,
    lastName: `User${i}`,
    location: randomItem(['Buenos Aires', 'New York', 'San Francisco']),
    bio: 'This is a test user created by k6 load testing',
    skills: ['JavaScript', 'Node.js', 'React']
  }));
});

// Job IDs to use for applications (pre-populated or will be fetched)
const predefinedJobIds = [];

// Store user tokens
let userTokens = {};

// Helper function to retry failed requests
function postWithRetry(url, body, params, maxRetries = 2) {
  let res;
  let retries = 0;
  
  while (retries <= maxRetries) {
    res = http.post(url, body, params);
    
    // Log the response for debugging
    console.log(`POST ${url} - Status: ${res.status}, Body length: ${res.body ? res.body.length : 0}`);
    
    // Check if request was successful or got a valid error response
    if (res.status !== 0 && res.status !== 502 && res.status !== 503 && res.status !== 504) {
      return res;
    }
    
    console.log(`Retrying POST to ${url}, attempt ${retries + 1}`);
    retries++;
    sleep(retries); // Increasing backoff
  }
  
  return res;
}

// Helper function for GET requests with retry
function getWithRetry(url, params, maxRetries = 2) {
  let res;
  let retries = 0;
  
  while (retries <= maxRetries) {
    res = http.get(url, params);
    
    if (res.status !== 0 && res.status !== 502 && res.status !== 503 && res.status !== 504) {
      return res;
    }
    
    console.log(`Retrying GET to ${url}, attempt ${retries + 1}`);
    retries++;
    sleep(retries);
  }
  
  return res;
}

export default function() {
  // Pick a user based on VU ID to ensure consistent behavior
  const userIndex = __VU % users.length;
  const userData = users[userIndex];
  
  // Generate a unique timestamp-based suffix for this run to avoid email conflicts
  const uniqueSuffix = `_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const uniqueEmail = userData.email.replace('@gmail.com', `${uniqueSuffix}@gmail.com`);
  
  // Step 1: User registration and login
  group('User registration and authentication', function() {
    if (!userTokens[userIndex]) {
      // Register user - match format exactly from your manual test
      let res = postWithRetry(`${BASE_URL}/users/register`, JSON.stringify({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: uniqueEmail, // Use unique email
        password: userData.password,
        location: userData.location,
        bio: userData.bio,
        skills: userData.skills
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        tags: { name: 'createUser' }
      });
      
      // Log full response for debugging
      if (res.status !== 201) {
        console.log(`Registration failed with status ${res.status}: ${res.body}`);
      }
      
      check(res, {
        'User registration successful': (r) => r.status === 201,
        'Registration returned user data': (r) => {
          try {
            return JSON.parse(r.body).user !== undefined;
          } catch (e) {
            return false;
          }
        }
      });
      
      // Give the server a moment to process the registration
      sleep(3);
      
      // Login user with the unique email
      res = postWithRetry(`${BASE_URL}/users/login`, JSON.stringify({
        email: uniqueEmail,
        password: userData.password
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        tags: { name: 'loginUser' }
      });
      
      check(res, {
        'User login successful': (r) => r.status === 200,
        'User received token': (r) => {
          try {
            return JSON.parse(r.body).token !== undefined;
          } catch (e) {
            return false;
          }
        }
      });
      
      if (res.status === 200) {
        try {
          const responseBody = JSON.parse(res.body);
          userTokens[userIndex] = responseBody.token;
          console.log(`Login successful for ${uniqueEmail}, token received`);
        } catch (e) {
          console.error('Failed to parse token from response:', e);
        }
      }
      
      sleep(2);
    }
  });
  
  // Only continue if we have a token
  if (!userTokens[userIndex]) {
    console.log(`Skipping job browsing - no token for user ${userIndex}`);
    return;
  }
  
  // Step 2: Browse jobs
  group('Job browsing', function() {
    // Get all jobs
    let res = getWithRetry(`${BASE_URL}/jobs`, {
      headers: { 
        'Authorization': `Bearer ${userTokens[userIndex]}`,
        'Accept': 'application/json'
      },
      tags: { name: 'getAllJobs' }
    });
    
    check(res, {
      'Get all jobs successful': (r) => r.status === 200,
    });
    
    // Store job IDs for application
    if (res.status === 200) {
      try {
        const responseBody = JSON.parse(res.body);
        const jobs = responseBody.jobs || [];
        
        if (jobs.length > 0) {
          console.log(`Found ${jobs.length} jobs to potentially apply for`);
          
          jobs.forEach(job => {
            if (job._id && !predefinedJobIds.includes(job._id)) {
              predefinedJobIds.push(job._id);
            }
          });
        } else {
          console.log('No jobs found to apply for');
        }
      } catch (e) {
        console.error('Failed to parse jobs from response:', e);
      }
    }
    
    sleep(randomIntBetween(1, 2));
  });
  
  // Step 3: Apply for jobs - only if user is authenticated and jobs are available
  group('Job application', function() {
    if (userTokens[userIndex] && predefinedJobIds.length > 0) {
      // Select a random job to apply for
      const jobId = randomItem(predefinedJobIds);
      console.log(`Attempting to apply for job ${jobId}`);
      
      // Submit job application
      const res = postWithRetry(`${BASE_URL}/applications/apply`, JSON.stringify({
        jobId: jobId,
        coverLetter: `I am interested in this position and believe my skills align well with your requirements.`,
        resume: 'VGhpcyBpcyBhIHNpbXBsZSBiYXNlNjQgZW5jb2RlZCByZXN1bWUgZm9yIHRlc3RpbmcgcHVycG9zZXM=' // Simple base64 string
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${userTokens[userIndex]}`
        },
        tags: { name: 'applyForJob' }
      });
      
      check(res, {
        'Job application successful or already applied': (r) => 
          r.status === 201 || r.status === 200 || r.status === 409, // 409 if already applied
      });
      
      if (res.status !== 201 && res.status !== 200 && res.status !== 409) {
        console.log(`Application failed with status ${res.status}: ${res.body}`);
      }
      
      sleep(randomIntBetween(1, 3));
    } else {
      console.log(`Skipping job application - no token or no jobs available`);
    }
  });
  
  // Add thinking time between actions to simulate real user behavior
  sleep(randomIntBetween(1, 3));
}