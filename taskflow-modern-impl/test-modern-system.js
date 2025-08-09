#!/usr/bin/env node

/**
 * Modern System Test Script
 * Tests the new TaskFlow modern implementation
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';

const MODERN_BACKEND_URL = 'http://localhost:5000';
const MODERN_FRONTEND_URL = 'http://localhost:3000';
const TEST_USERS = [
  { email: 'yterayut@gmail.com', password: '12345', role: 'manager' },
  { email: 'chaiwutwck@gmail.com', password: '12345', role: 'team_lead' },
  { email: 'kittipong@example.com', password: '12345', role: 'employee' }
];

let backendProcess = null;
let frontendProcess = null;

async function checkSystemRequirements() {
  console.log('🔍 Checking system requirements...');
  
  try {
    // Check if database exists
    const dbPath = './apps/backend/data/taskflow.db';
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database not found. Run migration first.');
    }
    
    // Check if environment files exist
    const backendEnv = './apps/backend/.env';
    const frontendEnv = './apps/frontend/.env';
    
    if (!fs.existsSync(backendEnv)) {
      throw new Error('Backend .env file not found');
    }
    
    if (!fs.existsSync(frontendEnv)) {
      throw new Error('Frontend .env file not found');
    }
    
    console.log('✅ System requirements check passed');
    return true;
  } catch (error) {
    console.error('❌ System requirements check failed:', error.message);
    return false;
  }
}

async function startBackendServer() {
  console.log('🚀 Starting modern backend server...');
  
  return new Promise((resolve, reject) => {
    const backend = spawn('npm', ['run', 'dev'], {
      cwd: './apps/backend',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });
    
    let output = '';
    
    backend.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Server started') || output.includes('listening')) {
        console.log('✅ Backend server started successfully');
        resolve(backend);
      }
    });
    
    backend.stderr.on('data', (data) => {
      const error = data.toString();
      console.log('Backend:', error);
      if (error.includes('Error') && !error.includes('warning')) {
        reject(new Error('Backend failed to start'));
      }
    });
    
    backend.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Backend exited with code ${code}`));
      }
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error('Backend startup timeout'));
    }, 30000);
    
    backendProcess = backend;
  });
}

async function startFrontendServer() {
  console.log('🎨 Starting modern frontend server...');
  
  return new Promise((resolve, reject) => {
    const frontend = spawn('npm', ['run', 'dev'], {
      cwd: './apps/frontend',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });
    
    let output = '';
    
    frontend.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Local:') || output.includes('localhost:3000')) {
        console.log('✅ Frontend server started successfully');
        resolve(frontend);
      }
    });
    
    frontend.stderr.on('data', (data) => {
      const error = data.toString();
      console.log('Frontend:', error);
    });
    
    frontend.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Frontend exited with code ${code}`));
      }
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error('Frontend startup timeout'));
    }, 30000);
    
    frontendProcess = frontend;
  });
}

async function testBackendHealth() {
  console.log('🏥 Testing backend health...');
  
  try {
    const response = await axios.get(`${MODERN_BACKEND_URL}/health`, {
      timeout: 5000
    });
    
    if (response.data.status === 'healthy') {
      console.log('✅ Backend health check passed');
      console.log(`   Database: ${response.data.services.database.status}`);
      console.log(`   Response time: ${response.data.services.database.responseTime}`);
      return true;
    } else {
      throw new Error('Backend not healthy');
    }
  } catch (error) {
    console.error('❌ Backend health check failed:', error.message);
    return false;
  }
}

async function testUserAuthentication() {
  console.log('🔐 Testing user authentication...');
  
  try {
    for (const user of TEST_USERS) {
      console.log(`   Testing login for ${user.email} (${user.role})...`);
      
      const response = await axios.post(`${MODERN_BACKEND_URL}/api/auth/login`, {
        email: user.email,
        password: user.password
      }, {
        timeout: 5000
      });
      
      if (response.data.success && response.data.accessToken) {
        console.log(`   ✅ ${user.role} login successful`);
      } else {
        throw new Error(`Login failed for ${user.email}`);
      }
    }
    
    console.log('✅ User authentication tests passed');
    return true;
  } catch (error) {
    console.error('❌ User authentication test failed:', error.message);
    return false;
  }
}

async function testFrontendAccess() {
  console.log('🌐 Testing frontend access...');
  
  try {
    const response = await axios.get(MODERN_FRONTEND_URL, {
      timeout: 5000
    });
    
    if (response.status === 200) {
      console.log('✅ Frontend access test passed');
      return true;
    } else {
      throw new Error('Frontend not accessible');
    }
  } catch (error) {
    console.error('❌ Frontend access test failed:', error.message);
    return false;
  }
}

async function generateTestReport(results) {
  const report = {
    test_completed_at: new Date().toISOString(),
    system_status: 'modern_implementation',
    test_results: {
      system_requirements: results.requirements,
      backend_health: results.backendHealth,
      user_authentication: results.authentication,
      frontend_access: results.frontendAccess,
      overall_success: Object.values(results).every(Boolean)
    },
    urls: {
      backend: MODERN_BACKEND_URL,
      frontend: MODERN_FRONTEND_URL,
      health_check: `${MODERN_BACKEND_URL}/health`,
      api_docs: `${MODERN_BACKEND_URL}/api`
    },
    test_users: TEST_USERS.map(u => ({ email: u.email, role: u.role })),
    next_steps: results.authentication ? [
      "System is ready for user testing",
      "Share frontend URL with team for feedback",
      "Conduct user acceptance testing",
      "Prepare for production deployment"
    ] : [
      "Fix authentication issues",
      "Re-run migration if needed",
      "Check database connectivity",
      "Verify environment configuration"
    ]
  };
  
  const reportFile = './system-test-report.json';
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`✅ Test report saved: ${reportFile}`);
  
  return report;
}

function cleanup() {
  console.log('🧹 Cleaning up test processes...');
  
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    console.log('🔒 Backend process terminated');
  }
  
  if (frontendProcess) {
    frontendProcess.kill('SIGTERM');
    console.log('🔒 Frontend process terminated');
  }
}

async function main() {
  console.log('🧪 Starting TaskFlow Modern System Test');
  console.log('=====================================');
  
  const results = {
    requirements: false,
    backendHealth: false,
    authentication: false,
    frontendAccess: false
  };
  
  try {
    // Check system requirements
    results.requirements = await checkSystemRequirements();
    if (!results.requirements) {
      throw new Error('System requirements not met');
    }
    
    // Start servers
    await startBackendServer();
    
    // Wait for backend to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test backend health
    results.backendHealth = await testBackendHealth();
    
    // Test user authentication
    if (results.backendHealth) {
      results.authentication = await testUserAuthentication();
    }
    
    // Start frontend (if backend is working)
    if (results.backendHealth) {
      try {
        await startFrontendServer();
        await new Promise(resolve => setTimeout(resolve, 10000));
        results.frontendAccess = await testFrontendAccess();
      } catch (error) {
        console.log('⚠️  Frontend test skipped:', error.message);
      }
    }
    
    // Generate test report
    const report = await generateTestReport(results);
    
    console.log('\n🎉 System testing completed!');
    console.log('============================');
    console.log(`✅ Requirements: ${results.requirements ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Backend Health: ${results.backendHealth ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Authentication: ${results.authentication ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Frontend Access: ${results.frontendAccess ? 'PASS' : 'FAIL'}`);
    console.log(`\n🏆 Overall: ${report.test_results.overall_success ? 'SUCCESS' : 'PARTIAL SUCCESS'}`);
    
    if (report.test_results.overall_success) {
      console.log('\n🚀 System is ready for user testing!');
      console.log(`Frontend URL: ${MODERN_FRONTEND_URL}`);
      console.log(`Backend API: ${MODERN_BACKEND_URL}`);
      console.log('\nShare these URLs with your team for feedback.');
    }
    
  } catch (error) {
    console.error('❌ System test failed:', error.message);
    
    // Generate failure report
    await generateTestReport(results);
  }
  
  // Keep servers running for manual testing
  console.log('\n⏳ Servers will continue running for manual testing...');
  console.log('Press Ctrl+C to stop servers and exit.');
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    cleanup();
    process.exit(0);
  });
}

// Run the test
main();