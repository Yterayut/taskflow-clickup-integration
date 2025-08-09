#!/usr/bin/env node

/**
 * Legacy Data Export Script
 * Exports data from the current TaskFlow system to prepare for modern migration
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

const LEGACY_SYSTEM = {
  BASE_URL: 'http://192.168.20.10:7810',
  FRONTEND_URL: 'http://192.168.20.10:8888',
  USERS_CONFIG: '/Users/teerayutyeerahem/team-workload/users_config.json'
};

const OUTPUT_DIR = './migration/exported-data';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function checkLegacySystemHealth() {
  try {
    console.log('🔍 Checking legacy system health...');
    const response = await axios.get(`${LEGACY_SYSTEM.BASE_URL}/health`, { timeout: 5000 });
    console.log('✅ Legacy system is healthy:', response.data.status);
    return true;
  } catch (error) {
    console.log('❌ Legacy system health check failed:', error.message);
    return false;
  }
}

async function exportUsersData() {
  console.log('👥 Exporting users data...');
  
  try {
    // Read users config file
    if (fs.existsSync(LEGACY_SYSTEM.USERS_CONFIG)) {
      const usersData = JSON.parse(fs.readFileSync(LEGACY_SYSTEM.USERS_CONFIG, 'utf8'));
      
      const exportedUsers = {
        exported_at: new Date().toISOString(),
        source: 'users_config.json',
        total_users: Object.keys(usersData).length,
        users: usersData
      };

      const outputFile = path.join(OUTPUT_DIR, `users_${TIMESTAMP}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(exportedUsers, null, 2));
      console.log(`✅ Users data exported: ${outputFile}`);
      console.log(`   📊 Total users: ${exportedUsers.total_users}`);
      
      return exportedUsers;
    } else {
      console.log('⚠️  Users config file not found');
      return null;
    }
  } catch (error) {
    console.error('❌ Error exporting users:', error.message);
    return null;
  }
}

async function exportClickUpData() {
  console.log('📋 Exporting ClickUp data...');
  
  try {
    // Try to get ClickUp data from legacy API
    const response = await axios.get(`${LEGACY_SYSTEM.BASE_URL}/api/v1/clickup-data`, {
      timeout: 30000
    });

    if (response.data.success) {
      const clickupData = {
        exported_at: new Date().toISOString(),
        source: 'legacy_api_clickup_data',
        data: response.data.data
      };

      const outputFile = path.join(OUTPUT_DIR, `clickup_data_${TIMESTAMP}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(clickupData, null, 2));
      
      console.log(`✅ ClickUp data exported: ${outputFile}`);
      console.log(`   📊 Teams: ${clickupData.data.teams?.length || 0}`);
      console.log(`   📊 Spaces: ${clickupData.data.spaces?.length || 0}`);
      console.log(`   📊 Tasks: ${clickupData.data.tasks?.length || 0}`);
      
      return clickupData;
    } else {
      console.log('⚠️  No ClickUp data available from legacy API');
      return null;
    }
  } catch (error) {
    console.error('❌ Error exporting ClickUp data:', error.message);
    return null;
  }
}

async function exportSystemConfiguration() {
  console.log('⚙️  Exporting system configuration...');
  
  const configFiles = [
    '/Users/teerayutyeerahem/team-workload/master_auth_service.js',
    '/Users/teerayutyeerahem/team-workload/current_frontend.html',
    '/Users/teerayutyeerahem/team-workload/users_config.json',
    '/Users/teerayutyeerahem/team-workload/deploy_real_clickup.sh'
  ];

  const exportedConfig = {
    exported_at: new Date().toISOString(),
    source: 'legacy_system_files',
    files: {}
  };

  for (const filePath of configFiles) {
    try {
      if (fs.existsSync(filePath)) {
        const fileName = path.basename(filePath);
        const stats = fs.statSync(filePath);
        
        exportedConfig.files[fileName] = {
          path: filePath,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          exists: true
        };

        // Copy important files to export directory
        if (fileName.endsWith('.json') || fileName.endsWith('.js')) {
          const destPath = path.join(OUTPUT_DIR, `legacy_${fileName}`);
          fs.copyFileSync(filePath, destPath);
        }
      } else {
        exportedConfig.files[path.basename(filePath)] = {
          path: filePath,
          exists: false
        };
      }
    } catch (error) {
      console.log(`⚠️  Error processing ${filePath}: ${error.message}`);
    }
  }

  const outputFile = path.join(OUTPUT_DIR, `system_config_${TIMESTAMP}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(exportedConfig, null, 2));
  console.log(`✅ System configuration exported: ${outputFile}`);
  
  return exportedConfig;
}

async function generateMigrationReport(usersData, clickupData, configData) {
  console.log('📊 Generating migration report...');
  
  const report = {
    migration_assessment: {
      timestamp: new Date().toISOString(),
      legacy_system: {
        base_url: LEGACY_SYSTEM.BASE_URL,
        frontend_url: LEGACY_SYSTEM.FRONTEND_URL,
        accessible: await checkLegacySystemHealth()
      },
      data_export: {
        users: {
          exported: !!usersData,
          count: usersData?.total_users || 0,
          file: usersData ? `users_${TIMESTAMP}.json` : null
        },
        clickup: {
          exported: !!clickupData,
          teams: clickupData?.data?.teams?.length || 0,
          tasks: clickupData?.data?.tasks?.length || 0,
          file: clickupData ? `clickup_data_${TIMESTAMP}.json` : null
        },
        configuration: {
          exported: !!configData,
          files_found: Object.keys(configData?.files || {}).length,
          file: configData ? `system_config_${TIMESTAMP}.json` : null
        }
      },
      migration_readiness: {
        users_ready: !!usersData,
        data_ready: !!clickupData,
        config_ready: !!configData,
        overall_ready: !!(usersData && clickupData && configData)
      },
      next_steps: [
        "Review exported data for completeness",
        "Prepare modern system database",
        "Run migration scripts",
        "Validate migrated data",
        "Conduct user acceptance testing",
        "Plan production cutover"
      ],
      estimated_migration_time: {
        data_migration: "2-4 hours",
        testing_validation: "1-2 days", 
        user_training: "1 week",
        total_timeline: "1-2 weeks"
      }
    }
  };

  const reportFile = path.join(OUTPUT_DIR, `migration_report_${TIMESTAMP}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`✅ Migration report generated: ${reportFile}`);
  console.log('\n📋 Migration Assessment Summary:');
  console.log(`   👥 Users: ${report.migration_assessment.data_export.users.count} exported`);
  console.log(`   📋 Tasks: ${report.migration_assessment.data_export.clickup.tasks} exported`);
  console.log(`   ⚙️  Config files: ${report.migration_assessment.data_export.configuration.files_found} processed`);
  console.log(`   ✅ Ready for migration: ${report.migration_assessment.migration_readiness.overall_ready ? 'YES' : 'NO'}`);
  
  return report;
}

async function main() {
  console.log('🚀 Starting TaskFlow Legacy Data Export');
  console.log('=====================================');
  
  try {
    // Check legacy system availability
    const systemHealthy = await checkLegacySystemHealth();
    
    // Export data components
    const usersData = await exportUsersData();
    const clickupData = await exportClickUpData();
    const configData = await exportSystemConfiguration();
    
    // Generate migration report
    const report = await generateMigrationReport(usersData, clickupData, configData);
    
    console.log('\n🎉 Data export completed successfully!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log('=====================================');
    
    if (report.migration_assessment.migration_readiness.overall_ready) {
      console.log('✅ System is ready for migration to modern architecture');
    } else {
      console.log('⚠️  Some data exports failed - review before proceeding');
    }
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  }
}

// Run the export
main();