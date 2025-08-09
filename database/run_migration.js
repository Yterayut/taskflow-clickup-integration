/**
 * Database Migration Runner
 * Executes the single login migration script
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../infrastructure/database/DatabaseClient');

async function runMigration() {
    let dbClient = null;
    
    try {
        console.log('🔄 Starting database migration...');
        
        // Initialize database connection
        dbClient = getDatabase();
        await dbClient.connect();
        
        // Read migration SQL
        const migrationPath = path.join(__dirname, 'single_login_migration.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📋 Executing migration script...');
        
        // Execute migration in a transaction
        await dbClient.transaction(async (client) => {
            await client.query(migrationSQL);
        });
        
        console.log('✅ Migration completed successfully!');
        
        // Verify migration
        console.log('🔍 Verifying migration...');
        const verificationQueries = [
            'SELECT COUNT(*) as count FROM system_status',
            'SELECT column_name FROM information_schema.columns WHERE table_name = \'clickup_tokens\' AND column_name IN (\'scope\', \'token_type\')',
            'SELECT COUNT(*) as count FROM users WHERE role = \'master\''
        ];
        
        for (const query of verificationQueries) {
            const result = await dbClient.query(query);
            console.log('✓', query.substring(0, 50) + '...', 'Result:', result.rows);
        }
        
        console.log('🎯 Migration verification completed!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (dbClient) {
            await dbClient.close();
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    runMigration().catch(error => {
        console.error('Migration runner error:', error);
        process.exit(1);
    });
}

module.exports = { runMigration };