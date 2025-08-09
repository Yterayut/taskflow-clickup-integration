/**
 * Manual Test - Simple validation without complex dependencies
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 TaskFlow Modern System - Manual Test');
console.log('======================================');

function testMigrationResults() {
  console.log('📊 Testing migration results...');
  
  try {
    // Check migration summary
    const summaryPath = './migration/migration-summary.json';
    if (fs.existsSync(summaryPath)) {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      
      console.log('✅ Migration summary found');
      console.log(`   👥 Users imported: ${summary.imported_data.users.total}`);
      console.log(`   👤 Managers: ${summary.imported_data.users.by_role.manager}`);
      console.log(`   👥 Team Leads: ${summary.imported_data.users.by_role.team_lead}`);
      console.log(`   👨‍💻 Employees: ${summary.imported_data.users.by_role.employee}`);
      console.log(`   🏢 Teams: ${summary.imported_data.teams.total}`);
      
      return summary;
    } else {
      console.log('⚠️  Migration summary not found');
      return null;
    }
  } catch (error) {
    console.error('❌ Error reading migration summary:', error.message);
    return null;
  }
}

function testProjectFiles() {
  console.log('📁 Testing project files...');
  
  const criticalFiles = [
    './apps/backend/src/server.ts',
    './apps/backend/src/database/schema.ts',
    './apps/backend/.env',
    './apps/frontend/src/App.tsx',
    './apps/frontend/.env',
    './docker-compose.yml',
    './README.md',
    './DEPLOYMENT_GUIDE.md'
  ];
  
  let allExists = true;
  const results = {};
  
  criticalFiles.forEach(filePath => {
    const exists = fs.existsSync(filePath);
    results[filePath] = exists;
    
    if (exists) {
      const stats = fs.statSync(filePath);
      console.log(`   ✅ ${filePath} (${Math.round(stats.size/1024)}KB)`);
    } else {
      console.log(`   ❌ ${filePath} - MISSING`);
      allExists = false;
    }
  });
  
  return { allExists, results };
}

function testConfiguration() {
  console.log('⚙️  Testing configuration...');
  
  try {
    // Check backend .env
    const backendEnv = './apps/backend/.env';
    if (fs.existsSync(backendEnv)) {
      const envContent = fs.readFileSync(backendEnv, 'utf8');
      
      const hasJwtSecret = envContent.includes('JWT_SECRET=') && 
                          !envContent.includes('your-super-secret');
      const hasClickupConfig = envContent.includes('CLICKUP_CLIENT_ID=DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL');
      const hasDatabase = envContent.includes('DATABASE_PATH=');
      
      console.log(`   ✅ Backend .env exists`);
      console.log(`   ${hasJwtSecret ? '✅' : '⚠️ '} JWT Secret configured`);
      console.log(`   ${hasClickupConfig ? '✅' : '⚠️ '} ClickUp integration configured`);
      console.log(`   ${hasDatabase ? '✅' : '⚠️ '} Database path configured`);
      
      return { hasJwtSecret, hasClickupConfig, hasDatabase };
    } else {
      console.log('   ❌ Backend .env not found');
      return { hasJwtSecret: false, hasClickupConfig: false, hasDatabase: false };
    }
  } catch (error) {
    console.error('❌ Error checking configuration:', error.message);
    return { hasJwtSecret: false, hasClickupConfig: false, hasDatabase: false };
  }
}

function generateReadinessReport(migration, files, config) {
  console.log('\n🎯 System Readiness Report');
  console.log('=========================');
  
  const migrationReady = migration && migration.imported_data.users.total > 0;
  const filesReady = files.allExists;
  const configReady = config.hasJwtSecret && config.hasClickupConfig && config.hasDatabase;
  
  console.log(`Data Migration: ${migrationReady ? '✅ COMPLETE' : '❌ INCOMPLETE'}`);
  console.log(`Project Files: ${filesReady ? '✅ COMPLETE' : '❌ MISSING FILES'}`);
  console.log(`Configuration: ${configReady ? '✅ READY' : '⚠️  NEEDS REVIEW'}`);
  
  const overallReady = migrationReady && filesReady && configReady;
  
  console.log(`\n🏆 Overall Status: ${overallReady ? '🟢 READY FOR TESTING' : '🟡 NEEDS ATTENTION'}`);
  
  if (overallReady) {
    console.log('\n🚀 Ready for Manual Testing!');
    console.log('============================');
    console.log('Next Steps:');
    console.log('1. Manual Backend Test:');
    console.log('   cd apps/backend');
    console.log('   npm install --legacy-peer-deps');
    console.log('   npm start');
    console.log('');
    console.log('2. Manual Frontend Test:');
    console.log('   cd apps/frontend');
    console.log('   npm install --legacy-peer-deps');
    console.log('   npm run dev');
    console.log('');
    console.log('3. Test URLs:');
    console.log('   Backend: http://localhost:5000/health');
    console.log('   Frontend: http://localhost:3000');
    console.log('');
    console.log('4. Test Credentials:');
    console.log('   Manager: yterayut@gmail.com / 12345');
    console.log('   Team Lead: chaiwutwck@gmail.com / 12345');
    console.log('   Employee: kittipong@example.com / 12345');
    
  } else {
    console.log('\n🔧 Issues to Fix:');
    if (!migrationReady) console.log('- Re-run migration: cd migration && npm run import');
    if (!filesReady) console.log('- Check missing project files');
    if (!configReady) console.log('- Review configuration files');
  }
  
  return overallReady;
}

function main() {
  try {
    const migration = testMigrationResults();
    const files = testProjectFiles();
    const config = testConfiguration();
    
    const readiness = generateReadinessReport(migration, files, config);
    
    // Save test report
    const report = {
      timestamp: new Date().toISOString(),
      system_status: 'modern_implementation',
      tests: {
        migration: !!migration,
        files: files.allExists,
        configuration: config.hasJwtSecret && config.hasClickupConfig
      },
      readiness: readiness,
      migration_data: migration,
      next_action: readiness ? 'manual_testing' : 'fix_issues'
    };
    
    fs.writeFileSync('./manual-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Test report saved: manual-test-report.json');
    
  } catch (error) {
    console.error('❌ Manual test failed:', error.message);
  }
}

main();