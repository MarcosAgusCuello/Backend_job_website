import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from './app';
import Company from './models/Company';
import User from './models/User';
import Job from './models/Job';
import Application from './models/Application';

// Test data
const testCompany = {
  companyName: "Test Company",
  email: "company@test.com",
  password: "password123",
  industry: "Technology",
  location: "Test City",
  description: "A company for testing",
  website: "https://testcompany.com"
};

const testUser = {
  firstName: "John",
  lastName: "Test",
  email: "john@test.com",
  password: "password123",
  location: "Test City",
  bio: "A test user",
  skills: ["JavaScript", "Testing"]
};

const testJob = {
  title: "Test Job",
  location: "Test Location",
  description: "This is a test job posting",
  requirements: ["Test requirement 1", "Test requirement 2"],
  type: "Full-Time",
  salary: {
    min: 50000,
    max: 100000,
    currency: "USD"
  },
  skills: ["JavaScript", "React"],
  experience: "2+ years",
  education: "Bachelor's degree"
};

// Simple assertion function
function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertContains(text: string, substring: string, message: string) {
  if (!text.includes(substring)) {
    throw new Error(`${message}: expected "${text}" to contain "${substring}"`);
  }
}

function assertHasProperty(obj: any, prop: string, message: string) {
  if (!(prop in obj)) {
    throw new Error(`${message}: expected object to have property "${prop}"`);
  }
}

// Storage for tokens and IDs
let companyToken: string;
let companyId: string;
let userToken: string;
let userId: string;
let jobId: string;
let applicationId: string;

export async function runTests() {
  let mongoServer: MongoMemoryServer | undefined = undefined;
  
  try {
    // Set up MongoDB in-memory server
    process.env.NODE_ENV = 'test';
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    // Try to disconnect first (ignore errors)
    try {
      await mongoose.disconnect();
    } catch (error) {
      // Ignore disconnection errors
    }
    
    // Connect to the in-memory database
    await mongoose.connect(uri);
    console.log('✅ Connected to in-memory MongoDB');
    
    // Clear all collections before testing
    await User.deleteMany({});
    await Company.deleteMany({});
    await Job.deleteMany({});
    await Application.deleteMany({});
    
    // Run authentication tests
    await testAuthentication();
    console.log('✅ Authentication tests passed');
    
    // Run job tests
    await testJobManagement();
    console.log('✅ Job management tests passed');
    
    // Run application tests
    await testApplications();
    console.log('✅ Application tests passed');
    
    // Clean up
    await mongoose.connection.close();
    await mongoServer.stop();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Clean up on error
    try {
      await mongoose.connection.close();
      if (mongoServer) await mongoServer.stop();
    } catch (closeError) {
      console.error('Error during cleanup:', closeError);
    }
    
    throw error;
  }
}

async function testAuthentication() {
  console.log('\n🔍 Running authentication tests...');
  
  // Test company registration
  console.log('  - Testing company registration');
  const companyRegResponse = await request(app)
    .post('/api/auth/register')
    .send(testCompany);
  
  assertEqual(companyRegResponse.status, 201, 'Company registration should return 201');
  assertHasProperty(companyRegResponse.body, 'token', 'Response should have token');
  assertHasProperty(companyRegResponse.body.company, 'id', 'Company should have id');
  assertEqual(companyRegResponse.body.company.companyName, testCompany.companyName, 'Company name should match');
  
  companyToken = companyRegResponse.body.token;
  companyId = companyRegResponse.body.company.id;
  
  // Test company login
  console.log('  - Testing company login');
  const companyLoginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: testCompany.email,
      password: testCompany.password
    });
  
  assertEqual(companyLoginResponse.status, 200, 'Company login should return 200');
  assertHasProperty(companyLoginResponse.body, 'token', 'Response should have token');
  
  // Test user registration
  console.log('  - Testing user registration');
  const userRegResponse = await request(app)
    .post('/api/users/register')
    .send(testUser);
  
  assertEqual(userRegResponse.status, 201, 'User registration should return 201');
  assertHasProperty(userRegResponse.body, 'token', 'Response should have token');
  assertHasProperty(userRegResponse.body.user, 'id', 'User should have id');
  assertEqual(userRegResponse.body.user.firstName, testUser.firstName, 'User first name should match');
  
  userToken = userRegResponse.body.token;
  userId = userRegResponse.body.user.id;
  
  // Test user login
  console.log('  - Testing user login');
  const userLoginResponse = await request(app)
    .post('/api/users/login')
    .send({
      email: testUser.email,
      password: testUser.password
    });
  
  assertEqual(userLoginResponse.status, 200, 'User login should return 200');
  assertHasProperty(userLoginResponse.body, 'token', 'Response should have token');
}

async function testJobManagement() {
  console.log('\n🔍 Running job management tests...');
  
  // Clear companies and recreate test company
  await Company.deleteMany({});
  const companyResponse = await request(app)
    .post('/api/auth/register')
    .send(testCompany);
  companyToken = companyResponse.body.token;
  companyId = companyResponse.body.company.id;
  
  // Test job creation
  console.log('  - Testing job creation');
  const jobResponse = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${companyToken}`)
    .send(testJob);
  
  assertEqual(jobResponse.status, 201, 'Job creation should return 201');
  assertHasProperty(jobResponse.body, 'job', 'Response should have job object');
  assertEqual(jobResponse.body.job.title, testJob.title, 'Job title should match');
  
  jobId = jobResponse.body.job._id;
  
  // Test getting job list
  console.log('  - Testing job listing');
  const jobsResponse = await request(app)
    .get('/api/jobs');
  
  assertEqual(jobsResponse.status, 200, 'Job listing should return 200');
  assertHasProperty(jobsResponse.body, 'jobs', 'Response should have jobs array');
  
  // Test getting a specific job
  console.log('  - Testing job detail retrieval');
  const jobDetailResponse = await request(app)
    .get(`/api/jobs/${jobId}`);
  
  assertEqual(jobDetailResponse.status, 200, 'Job detail should return 200');
  assertEqual(jobDetailResponse.body._id, jobId, 'Job ID should match');
  
  // Test job update
  console.log('  - Testing job update');
  const updatedData = {
    title: "Updated Test Job",
    salary: {
      min: 60000,
      max: 120000,
      currency: "USD"
    }
  };
  
  const updateResponse = await request(app)
    .put(`/api/jobs/${jobId}`)
    .set('Authorization', `Bearer ${companyToken}`)
    .send(updatedData);
  
  assertEqual(updateResponse.status, 200, 'Job update should return 200');
  assertEqual(updateResponse.body.job.title, updatedData.title, 'Updated job title should match');
}

async function testApplications() {
  console.log('\n🔍 Running application tests...');
  
  // Reset data
  await Company.deleteMany({});
  await User.deleteMany({});
  await Job.deleteMany({});
  await Application.deleteMany({});
  
  // Register company
  const companyResponse = await request(app)
    .post('/api/auth/register')
    .send(testCompany);
  companyToken = companyResponse.body.token;
  companyId = companyResponse.body.company.id;
  
  // Register user
  const userResponse = await request(app)
    .post('/api/users/register')
    .send(testUser);
  userToken = userResponse.body.token;
  userId = userResponse.body.user.id;
  
  // Create a job
  const jobResponse = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${companyToken}`)
    .send(testJob);
  jobId = jobResponse.body.job._id;
  
  // Test applying for a job
  console.log('  - Testing job application');
  const application = {
    jobId: jobId,
    coverLetter: "I'm interested in this position",
    resume: "https://example.com/resume.pdf"
  };
  
  const applyResponse = await request(app)
    .post('/api/applications/apply')
    .set('Authorization', `Bearer ${userToken}`)
    .send(application);
  
  assertEqual(applyResponse.status, 201, 'Job application should return 201');
  assertHasProperty(applyResponse.body, 'application', 'Response should have application object');
  assertContains(applyResponse.body.message, 'submitted successfully', 'Response should confirm successful submission');
  
  applicationId = applyResponse.body.application.id;
  
  // Test getting user applications
  console.log('  - Testing user applications retrieval');
  const userAppsResponse = await request(app)
    .get('/api/applications/user/applications')
    .set('Authorization', `Bearer ${userToken}`);
  
  assertEqual(userAppsResponse.status, 200, 'User applications should return 200');
  assertHasProperty(userAppsResponse.body, 'applications', 'Response should have applications array');
  
  // Test getting job applications as company
  console.log('  - Testing company view of job applications');
  const jobAppsResponse = await request(app)
    .get(`/api/applications/job/${jobId}`)
    .set('Authorization', `Bearer ${companyToken}`);
  
  assertEqual(jobAppsResponse.status, 200, 'Job applications should return 200');
  assertHasProperty(jobAppsResponse.body, 'applications', 'Response should have applications array');
  
  // Test updating application status
  console.log('  - Testing application status update');
  const statusResponse = await request(app)
    .put(`/api/applications/${applicationId}/status`)
    .set('Authorization', `Bearer ${companyToken}`)
    .send({ status: 'interviewing' });
  
  assertEqual(statusResponse.status, 200, 'Status update should return 200');
  assertEqual(statusResponse.body.application.status, 'interviewing', 'Updated status should match');
  
  // Test withdrawing an application
  console.log('  - Testing application withdrawal');
  const withdrawResponse = await request(app)
    .delete(`/api/applications/withdraw/${applicationId}`)
    .set('Authorization', `Bearer ${userToken}`);
  
  assertEqual(withdrawResponse.status, 200, 'Withdrawal should return 200');
  assertContains(withdrawResponse.body.message, 'withdrawn successfully', 'Response should confirm successful withdrawal');
}