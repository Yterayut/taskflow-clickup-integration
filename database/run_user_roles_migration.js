#!/usr/bin/env node

/**
 * TaskFlow Pro v3.3 - User Roles Migration Script
 * Updates user roles according to new organizational structure
 */

const fs = require('fs');
const path = require('path');

// Import database configuration
const { Database } = require('./config');

async function runUserRolesMigration() {
    console.log('🔄 Starting User Roles Migration...');
    console.log('📅 Date:', new Date().toISOString());
    
    try {
        // Read the SQL migration file
        const sqlFile = path.join(__dirname, 'update_user_roles.sql');
        const migrationSQL = fs.readFileSync(sqlFile, 'utf8');
        
        console.log('📖 Reading migration SQL file...');
        
        // Split SQL file into individual statements
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`🔧 Found ${statements.length} SQL statements to execute`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`\n⚡ Executing statement ${i + 1}/${statements.length}:`);
            console.log(`📝 ${statement.substring(0, 80)}${statement.length > 80 ? '...' : ''}`);
            
            try {
                const result = await Database.query(statement);
                console.log(`✅ Success: ${result.rowCount || 0} rows affected`);
                
                // Show results for SELECT statements
                if (result.rows && result.rows.length > 0 && statement.toLowerCase().includes('select')) {
                    console.log('📊 Results:');
                    console.table(result.rows);
                }
            } catch (statementError) {
                console.error(`❌ Error in statement ${i + 1}:`, statementError.message);
                throw statementError;
            }
        }
        
        console.log('\n🎉 User Roles Migration completed successfully!');
        console.log('📋 Summary:');
        console.log('  - Manager: yterayut@gmail.com (Teerayut Yeerahem)');
        console.log('  - Team Lead: chaiwutwck@gmail.com (ชัยวุฒิ ไวเชิงค้า)');
        console.log('  - Employees: 9 users updated from "user" to "employee" role');
        
        return { success: true, message: 'Migration completed successfully' };
        
    } catch (error) {
        console.error('💥 Migration failed:', error);
        return { success: false, error: error.message };
    }
}

// Health check before migration
async function checkDatabaseHealth() {
    console.log('🏥 Checking database health...');
    
    try {
        const health = await Database.healthCheck();
        console.log('✅ Database Status:', health.status);
        console.log('🕐 Database Time:', health.timestamp);
        
        if (health.status !== 'healthy') {
            throw new Error('Database is not healthy');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Database health check failed:', error);
        return false;
    }
}

// Backup current roles before migration
async function backupCurrentRoles() {
    console.log('💾 Creating backup of current user roles...');
    
    try {
        const result = await Database.query(`
            SELECT email, full_name, role, created_at, updated_at 
            FROM users 
            ORDER BY email
        `);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(__dirname, `user_roles_backup_${timestamp}.json`);
        
        fs.writeFileSync(backupFile, JSON.stringify(result.rows, null, 2));
        console.log(`📁 Backup saved to: ${backupFile}`);
        
        return backupFile;
    } catch (error) {
        console.error('❌ Backup failed:', error);
        throw error;
    }
}

// Main execution
async function main() {
    console.log('🚀 TaskFlow Pro v3.3 - User Roles Migration');
    console.log('=' .repeat(50));
    
    try {
        // Step 1: Health check
        const isHealthy = await checkDatabaseHealth();
        if (!isHealthy) {
            process.exit(1);
        }
        
        // Step 2: Backup
        const backupFile = await backupCurrentRoles();
        
        // Step 3: Run migration
        const result = await runUserRolesMigration();
        
        if (result.success) {
            console.log('\n✅ ALL OPERATIONS COMPLETED SUCCESSFULLY!');
            console.log(`📁 Backup file: ${backupFile}`);
            console.log('🔄 Next: Test user authentication with updated roles');
            process.exit(0);
        } else {
            console.error('\n❌ MIGRATION FAILED:', result.error);
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n💥 UNEXPECTED ERROR:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    runUserRolesMigration,
    checkDatabaseHealth,
    backupCurrentRoles
};