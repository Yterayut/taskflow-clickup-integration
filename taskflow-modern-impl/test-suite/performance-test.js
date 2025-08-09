#!/usr/bin/env node
/**
 * TaskFlow Pro - Performance Testing Suite
 * Load testing and performance benchmarks
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

const CONFIG = {
  baseURL: 'http://192.168.20.10:8888',
  apiURL: 'http://192.168.20.10:7810',
  concurrentUsers: 10,
  testDuration: 30000, // 30 seconds
  requestTimeout: 5000
};

class PerformanceTester {
  constructor() {
    this.results = {
      loadTest: {},
      stressTest: {},
      endurance: {},
      latency: {}
    };
  }

  async loadTest() {
    console.log('\n🔥 Load Testing - Simulating normal user load');
    console.log('='.repeat(50));
    
    const promises = [];
    const startTime = performance.now();
    
    // Simulate concurrent users
    for (let i = 0; i < CONFIG.concurrentUsers; i++) {
      promises.push(this.simulateUser(i));
    }
    
    const results = await Promise.allSettled(promises);
    const endTime = performance.now();
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    this.results.loadTest = {
      totalUsers: CONFIG.concurrentUsers,
      successful,
      failed,
      duration: Math.round(endTime - startTime),
      successRate: Math.round((successful / CONFIG.concurrentUsers) * 100)
    };
    
    console.log(`✅ Load Test Complete:`);
    console.log(`   Users: ${CONFIG.concurrentUsers}`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success Rate: ${this.results.loadTest.successRate}%`);
    console.log(`   Duration: ${this.results.loadTest.duration}ms`);
  }

  async simulateUser(userId) {
    const requests = [
      { url: CONFIG.baseURL, name: 'Frontend Load' },
      { url: `${CONFIG.apiURL}/health`, name: 'Health Check' },
      { url: `${CONFIG.baseURL}/?view=my-tasks`, name: 'My Tasks View' },
      { url: `${CONFIG.baseURL}/?view=team-overview`, name: 'Team Overview' },
      { url: `${CONFIG.apiURL}/api/v1/clickup-data`, name: 'ClickUp Data' }
    ];
    
    const userResults = [];
    
    for (const request of requests) {
      try {
        const startTime = performance.now();
        const response = await axios.get(request.url, { 
          timeout: CONFIG.requestTimeout,
          validateStatus: () => true
        });
        const endTime = performance.now();
        
        userResults.push({
          name: request.name,
          status: response.status,
          duration: Math.round(endTime - startTime),
          success: response.status < 400
        });
      } catch (error) {
        userResults.push({
          name: request.name,
          status: 0,
          duration: 0,
          success: false,
          error: error.message
        });
      }
    }
    
    return userResults;
  }

  async latencyTest() {
    console.log('\n⚡ Latency Testing - Response time analysis');
    console.log('='.repeat(50));
    
    const endpoints = [
      { url: `${CONFIG.apiURL}/health`, name: 'Health Check' },
      { url: CONFIG.baseURL, name: 'Frontend' },
      { url: `${CONFIG.apiURL}/api/v1/clickup-data`, name: 'ClickUp Data' }
    ];
    
    const latencyResults = {};
    
    for (const endpoint of endpoints) {
      const measurements = [];
      
      // Take 10 measurements per endpoint
      for (let i = 0; i < 10; i++) {
        try {
          const startTime = performance.now();
          await axios.get(endpoint.url, { 
            timeout: CONFIG.requestTimeout,
            validateStatus: () => true
          });
          const endTime = performance.now();
          
          measurements.push(endTime - startTime);
        } catch (error) {
          measurements.push(CONFIG.requestTimeout);
        }
      }
      
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const min = Math.min(...measurements);
      const max = Math.max(...measurements);
      
      latencyResults[endpoint.name] = {
        average: Math.round(avg),
        min: Math.round(min),
        max: Math.round(max),
        measurements: measurements.map(m => Math.round(m))
      };
      
      console.log(`📊 ${endpoint.name}:`);
      console.log(`   Avg: ${Math.round(avg)}ms`);
      console.log(`   Min: ${Math.round(min)}ms`);
      console.log(`   Max: ${Math.round(max)}ms`);
    }
    
    this.results.latency = latencyResults;
  }

  async stressTest() {
    console.log('\n💪 Stress Testing - High load simulation');
    console.log('='.repeat(50));
    
    const stressUsers = CONFIG.concurrentUsers * 3; // 3x normal load
    const promises = [];
    const startTime = performance.now();
    
    for (let i = 0; i < stressUsers; i++) {
      promises.push(this.quickUserFlow(i));
    }
    
    const results = await Promise.allSettled(promises);
    const endTime = performance.now();
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    this.results.stressTest = {
      totalUsers: stressUsers,
      successful,
      failed,
      duration: Math.round(endTime - startTime),
      successRate: Math.round((successful / stressUsers) * 100)
    };
    
    console.log(`🔥 Stress Test Complete:`);
    console.log(`   Users: ${stressUsers}`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success Rate: ${this.results.stressTest.successRate}%`);
    console.log(`   Duration: ${this.results.stressTest.duration}ms`);
  }

  async quickUserFlow(userId) {
    // Simplified user flow for stress testing
    const response = await axios.get(CONFIG.baseURL, { 
      timeout: 2000,
      validateStatus: () => true
    });
    
    return response.status < 500; // Accept everything except server errors
  }

  async enduranceTest() {
    console.log('\n🏃 Endurance Testing - Sustained load');
    console.log('='.repeat(50));
    
    const startTime = performance.now();
    const testDuration = 15000; // 15 seconds for demo
    let requestCount = 0;
    let successCount = 0;
    
    console.log(`Running for ${testDuration/1000} seconds...`);
    
    while ((performance.now() - startTime) < testDuration) {
      try {
        const response = await axios.get(`${CONFIG.apiURL}/health`, { 
          timeout: 1000,
          validateStatus: () => true
        });
        
        requestCount++;
        if (response.status === 200) {
          successCount++;
        }
      } catch (error) {
        requestCount++;
      }
      
      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const actualDuration = performance.now() - startTime;
    const rps = Math.round((requestCount / actualDuration) * 1000);
    
    this.results.endurance = {
      duration: Math.round(actualDuration),
      totalRequests: requestCount,
      successfulRequests: successCount,
      requestsPerSecond: rps,
      successRate: Math.round((successCount / requestCount) * 100)
    };
    
    console.log(`⏱️  Endurance Test Complete:`);
    console.log(`   Duration: ${Math.round(actualDuration)}ms`);
    console.log(`   Total Requests: ${requestCount}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Requests/sec: ${rps}`);
    console.log(`   Success Rate: ${this.results.endurance.successRate}%`);
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      configuration: CONFIG,
      results: this.results,
      summary: {
        loadTestPassed: this.results.loadTest.successRate >= 90,
        stressTestPassed: this.results.stressTest.successRate >= 70,
        enduranceTestPassed: this.results.endurance.successRate >= 85,
        avgLatencyAcceptable: this.results.latency['Health Check']?.average < 500
      }
    };
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`🔥 Load Test: ${report.summary.loadTestPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`💪 Stress Test: ${report.summary.stressTestPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🏃 Endurance Test: ${report.summary.enduranceTestPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`⚡ Latency Test: ${report.summary.avgLatencyAcceptable ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n📈 Key Metrics:');
    console.log(`   Load Test Success Rate: ${this.results.loadTest.successRate}%`);
    console.log(`   Stress Test Success Rate: ${this.results.stressTest.successRate}%`);
    console.log(`   Endurance Success Rate: ${this.results.endurance.successRate}%`);
    console.log(`   Average Health Check Latency: ${this.results.latency['Health Check']?.average}ms`);
    
    return report;
  }
}

// Execute Performance Tests
console.log('🚀 TaskFlow Pro - Performance Testing Suite');
console.log('='.repeat(60));

const tester = new PerformanceTester();

try {
  await tester.latencyTest();
  await tester.loadTest();
  await tester.stressTest();
  await tester.enduranceTest();
  
  const report = tester.generateReport();
  
  // Save performance report
  const fs = await import('fs/promises');
  await fs.writeFile('performance-results.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Performance report saved to performance-results.json');
  
  const allPassed = Object.values(report.summary).every(test => test === true);
  console.log(`\n🎯 Overall Performance: ${allPassed ? '✅ EXCELLENT' : '⚠️ NEEDS OPTIMIZATION'}`);
  
} catch (error) {
  console.error('❌ Performance testing failed:', error.message);
  process.exit(1);
}