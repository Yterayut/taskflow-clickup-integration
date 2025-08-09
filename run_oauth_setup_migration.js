#!/usr/bin/env node

/**
 * OAuth Setup Migration Runner
 * Apply OAuth setup tracking schema changes to production database
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runMigration() {
    console.log('🚀 Starting OAuth Setup Migration...\n');

    // Database configuration
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'taskflow_auth',
        user: process.env.DB_USER || 'taskflow_user',
        password: process.env.DB_PASSWORD
    };

    if (!dbConfig.password) {
        console.error('❌ Error: DB_PASSWORD environment variable is required');
        process.exit(1);
    }

    const client = new Client(dbConfig);

    try {
        // Connect to database
        console.log('📡 Connecting to database...');
        await client.connect();
        console.log('✅ Database connected successfully\n');

        // Read migration file
        const migrationPath = path.join(__dirname, 'database', 'oauth_setup_migration.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Applying OAuth setup migration...');
        
        // Execute migration
        await client.query('BEGIN');
        
        // Split and execute each statement
        const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (const statement of statements) {
            if (statement.trim()) {
                console.log(`   Executing: ${statement.trim().substring(0, 50)}...`);
                await client.query(statement);
            }
        }
        
        await client.query('COMMIT');
        console.log('✅ Migration completed successfully\n');

        // Verify migration results
        console.log('🔍 Verifying migration results...');
        
        // Check users table structure
        const usersCheck = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('oauth_setup_completed', 'oauth_setup_completed_at')
            ORDER BY column_name
        `);
        
        console.log('   Users table new columns:');
        usersCheck.rows.forEach(row => {
            console.log(`     - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });

        // Check clickup_tokens table structure
        const tokensCheck = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'clickup_tokens' 
            AND column_name IN ('is_permanent', 'setup_completed_at')
            ORDER BY column_name
        `);
        
        console.log('   ClickUp tokens table new columns:');
        tokensCheck.rows.forEach(row => {
            console.log(`     - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });

        // Check master user status
        const masterCheck = await client.query(`
            SELECT email, role, oauth_setup_completed, oauth_setup_completed_at 
            FROM users 
            WHERE email = $1
        `, [process.env.MASTER_USER_EMAIL || 'yterayut@gmail.com']);
        
        if (masterCheck.rows.length > 0) {
            const master = masterCheck.rows[0];
            console.log('   Master user status:');
            console.log(`     - Email: ${master.email}`);
            console.log(`     - Role: ${master.role}`);
            console.log(`     - OAuth Setup Required: ${!master.oauth_setup_completed}`);
            console.log(`     - Setup Completed At: ${master.oauth_setup_completed_at || 'N/A'}`);
        } else {
            console.log('   ⚠️  Master user not found in database');
        }

        console.log('\n🎉 OAuth Setup Migration completed successfully!');
        console.log('\n📋 Next Steps:');
        console.log('1. Restart the backend service to pick up domain changes');
        console.log('2. Test master user login flow:');
        console.log('   - First login should require OAuth setup');
        console.log('   - Subsequent logins should use local authentication');
        console.log('3. Verify permanent token storage in database');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        console.error('   Stack trace:', error.stack);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n📡 Database connection closed');
    }
}

// Run migration if called directly
if (require.main === module) {
    // Load environment variables
    require('dotenv').config();
    
    runMigration().catch(error => {
        console.error('❌ Migration runner failed:', error);
        process.exit(1);
    });
}

module.exports = { runMigration };