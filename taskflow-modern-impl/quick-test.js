#!/usr/bin/env node

/**
 * Quick Manual Test for Modern System
 * Simple verification that the migration worked properly
 */

import fs from 'fs';
import Database from 'better-sqlite3';
import axios from 'axios';

console.log('🧪 TaskFlow Modern System - Quick Test');
console.log('====================================');

async function testDatabase() {
  console.log('🗄️  Testing database...');
  
  try {
    const dbPath = './apps/backend/data/taskflow.db';
    
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file not found');
    }
    
    const db = new Database(dbPath);
    
    // Test database queries
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get();
    const teamCount = db.prepare('SELECT COUNT(*) as count FROM teams').get();
    
    // Get sample user data
    const sampleUsers = db.prepare('SELECT email, full_name FROM users LIMIT 3').all();
    const roles = db.prepare('SELECT name, display_name FROM roles').all();
    
    db.close();
    
    console.log('✅ Database test successful');
    console.log(`   👥 Users: ${userCount.count}`);
    console.log(`   🎭 Roles: ${roleCount.count}`);
    console.log(`   🏢 Teams: ${teamCount.count}`);
    
    console.log('   📋 Sample Users:');
    sampleUsers.forEach(user => {
      console.log(`      - ${user.email} (${user.full_name})`);
    });
    
    console.log('   🎭 Roles Available:');
    roles.forEach(role => {
      console.log(`      - ${role.name}: ${role.display_name}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    return false;
  }
}

async function testLegacySystem() {
  console.log('🔍 Testing legacy system connectivity...');
  
  try {
    const response = await axios.get('http://192.168.20.10:7810/health', { timeout: 5000 });
    
    console.log('✅ Legacy system is running');
    console.log(`   📊 Status: ${response.data.status}`);
    console.log(`   🔗 Service: ${response.data.service}`);
    
    return true;
  } catch (error) {
    console.log('⚠️  Legacy system not accessible:', error.message);
    return false;
  }
}

function testProjectStructure() {
  console.log('📁 Testing project structure...');
  
  const requiredFiles = [
    './apps/backend/package.json',
    './apps/frontend/package.json',
    './apps/backend/.env',
    './apps/frontend/.env',
    './migration/migration-summary.json',
    './docker-compose.yml',
    './README.md'
  ];
  
  let allExists = true;
  
  for (const filePath of requiredFiles) {
    if (fs.existsSync(filePath)) {
      console.log(`   ✅ ${filePath}`);
    } else {
      console.log(`   ❌ ${filePath} - MISSING`);
      allExists = false;
    }
  }
  
  return allExists;
}

function generateQuickTestSummary(dbTest, legacyTest, structureTest) {
  console.log('\n📊 Quick Test Summary');
  console.log('====================');
  console.log(`Database Migration: ${dbTest ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Project Structure: ${structureTest ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Legacy System: ${legacyTest ? '✅ RUNNING' : '⚠️  OFFLINE'}`);
  
  const overallSuccess = dbTest && structureTest;
  console.log(`\n🏆 Overall Status: ${overallSuccess ? '✅ READY' : '❌ ISSUES FOUND'}`);
  
  if (overallSuccess) {
    console.log('\n🚀 Next Steps:');
    console.log('1. Start modern backend: cd apps/backend && npm install && npm start');
    console.log('2. Start modern frontend: cd apps/frontend && npm install && npm run dev');
    console.log('3. Access modern system: http://localhost:3000');
    console.log('4. Test login with migrated users');
    console.log('5. Compare with legacy system: http://192.168.20.10:8888');
  } else {
    console.log('\n🔧 Fix Required:');
    if (!dbTest) console.log('- Re-run migration: cd migration && npm run import');
    if (!structureTest) console.log('- Check missing files and regenerate');
  }
  
  return overallSuccess;
}

async function main() {
  try {
    const dbTest = await testDatabase();
    const legacyTest = await testLegacySystem();
    const structureTest = testProjectStructure();
    
    const success = generateQuickTestSummary(dbTest, legacyTest, structureTest);
    
    // Save test results
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: {
        database: dbTest,
        legacy_system: legacyTest,
        project_structure: structureTest
      },
      overall_success: success,
      next_action: success ? 'proceed_to_manual_testing' : 'fix_issues_first'
    };
    
    fs.writeFileSync('./quick-test-results.json', JSON.stringify(testResults, null, 2));
    console.log('\n📄 Test results saved to: quick-test-results.json');
    
  } catch (error) {
    console.error('❌ Quick test failed:', error.message);
  }
}

main();