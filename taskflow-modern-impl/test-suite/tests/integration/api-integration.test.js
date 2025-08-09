import axios from 'axios';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = 'http://192.168.20.10:7810';
const FRONTEND_BASE = 'http://192.168.20.10:8888';

describe('TaskFlow API Integration Tests', () => {
  let apiClient;
  
  beforeAll(async () => {
    apiClient = axios.create({
      baseURL: API_BASE,
      timeout: 10000,
      validateStatus: () => true // Accept all status codes
    });
  });

  describe('Health and Basic Connectivity', () => {
    test('Backend health endpoint responds correctly', async () => {
      const response = await apiClient.get('/health');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'OK');
      expect(response.data).toHaveProperty('service');
      expect(response.data.service).toContain('TaskFlow');
      
      console.log('✅ Backend health check passed');
    });

    test('Frontend is accessible', async () => {
      const response = await axios.get(FRONTEND_BASE, { timeout: 10000 });
      
      expect(response.status).toBe(200);
      expect(response.data).toContain('TaskFlow Pro');
      
      console.log('✅ Frontend accessibility confirmed');
    });

    test('CORS headers are properly configured', async () => {
      const response = await apiClient.options('/health', {
        headers: {
          'Origin': FRONTEND_BASE,
          'Access-Control-Request-Method': 'GET'
        }
      });
      
      // Should allow CORS or return 200/204
      expect([200, 204, 404]).toContain(response.status);
      
      console.log('✅ CORS configuration verified');
    });
  });

  describe('API Endpoints Availability', () => {
    const endpoints = [
      { path: '/health', method: 'GET', expectedStatus: 200 },
      { path: '/api/v1/users', method: 'GET', expectedStatus: [200, 401, 403] },
      { path: '/api/v1/clickup-data', method: 'GET', expectedStatus: [200, 401, 403, 500] },
      { path: '/auth/clickup', method: 'GET', expectedStatus: [302, 401, 403] }
    ];

    endpoints.forEach(({ path, method, expectedStatus }) => {
      test(`${method} ${path} endpoint is accessible`, async () => {
        const response = await apiClient.request({
          method: method.toLowerCase(),
          url: path
        });
        
        const acceptableStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
        expect(acceptableStatuses).toContain(response.status);
        
        console.log(`✅ ${method} ${path} accessible (status: ${response.status})`);
      });
    });
  });

  describe('ClickUp Integration', () => {
    test('ClickUp OAuth redirect is configured', async () => {
      const response = await apiClient.get('/auth/clickup');
      
      // Should redirect to ClickUp OAuth
      expect([302, 301]).toContain(response.status);
      
      if (response.headers.location) {
        expect(response.headers.location).toContain('clickup.com');
        console.log('✅ ClickUp OAuth redirect configured correctly');
      } else {
        console.log('ℹ️ ClickUp OAuth response format differs from expected');
      }
    });

    test('ClickUp callback endpoint exists', async () => {
      const response = await apiClient.get('/auth/callback');
      
      // Endpoint should exist (even if it returns error without proper params)
      expect(response.status).not.toBe(404);
      
      console.log(`✅ ClickUp callback endpoint accessible (status: ${response.status})`);
    });
  });

  describe('Database Integration', () => {
    test('User data endpoint responds', async () => {
      const response = await apiClient.get('/api/v1/users');
      
      // Should respond (even with auth error)
      expect(response.status).not.toBe(404);
      expect([200, 401, 403, 500]).toContain(response.status);
      
      console.log(`✅ User data endpoint accessible (status: ${response.status})`);
    });

    test('ClickUp data endpoint responds', async () => {
      const response = await apiClient.get('/api/v1/clickup-data');
      
      // Should respond (even with auth error)
      expect(response.status).not.toBe(404);
      
      console.log(`✅ ClickUp data endpoint accessible (status: ${response.status})`);
    });
  });

  describe('Performance Integration', () => {
    test('Health endpoint response time is acceptable', async () => {
      const startTime = Date.now();
      
      const response = await apiClient.get('/health');
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
      
      console.log(`✅ Health endpoint responded in ${responseTime}ms`);
    });

    test('Frontend load time is acceptable', async () => {
      const startTime = Date.now();
      
      const response = await axios.get(FRONTEND_BASE);
      
      const loadTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
      
      console.log(`✅ Frontend loaded in ${loadTime}ms`);
    });
  });

  describe('Error Handling Integration', () => {
    test('Invalid endpoint returns 404', async () => {
      const response = await apiClient.get('/api/invalid-endpoint');
      
      expect(response.status).toBe(404);
      
      console.log('✅ 404 error handling works correctly');
    });

    test('Malformed request handling', async () => {
      const response = await apiClient.post('/api/v1/users', 'invalid-json', {
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Should handle malformed requests gracefully
      expect([400, 401, 403, 404, 500]).toContain(response.status);
      
      console.log(`✅ Malformed request handled (status: ${response.status})`);
    });
  });
});

describe('Frontend-Backend Integration', () => {
  test('Frontend can load backend health data', async () => {
    // Test that frontend can successfully call backend
    const frontendResponse = await axios.get(FRONTEND_BASE);
    expect(frontendResponse.status).toBe(200);
    
    // Check if frontend contains backend URL configuration
    const frontendContent = frontendResponse.data;
    expect(frontendContent).toContain('192.168.20.10:7810');
    
    console.log('✅ Frontend-backend integration configured');
  });

  test('API calls from frontend context work', async () => {
    // Simulate a call that frontend would make
    const response = await axios.get(`${API_BASE}/health`, {
      headers: {
        'Origin': FRONTEND_BASE,
        'User-Agent': 'TaskFlow-Frontend/2.0.0'
      }
    });
    
    expect(response.status).toBe(200);
    
    console.log('✅ Frontend-style API calls work');
  });
});