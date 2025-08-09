#!/usr/bin/env node

/**
 * Migration Script: users_config.json to PostgreSQL
 * Converts existing user data to database with bcrypt password hashing
 */

require('dotenv').config();
const fs = require('fs');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');

// Database configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'taskflow_pro',
    user: process.env.DB_USER || 'taskflow_user', 
    password: process.env.DB_PASSWORD || 'TaskFlow2025Secure',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;

// Role mapping from old system to new simplified roles
const ROLE_MAPPING = {
    'Manager': 'master',      // yterayut@gmail.com becomes master
    'Team Lead': 'user',      // All others become regular users
    'Employee': 'user'
};

async function initializeDatabase() {
    console.log('🚀 Starting database migration...');
    
    try {
        // Test database connection
        const client = await pool.connect();
        console.log('✅ Database connection successful');
        
        // Execute schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📋 Executing database schema...');
        await client.query(schema);
        console.log('✅ Database schema created successfully');
        
        client.release();
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
}

async function migrateUsers() {
    console.log('👥 Starting user migration from users_config.json...');
    
    try {
        // Read existing users
        const usersConfigPath = path.join(__dirname, '..', 'users_config.json');
        if (!fs.existsSync(usersConfigPath)) {
            throw new Error('users_config.json not found');
        }
        
        const usersConfig = JSON.parse(fs.readFileSync(usersConfigPath, 'utf8'));
        console.log(`📊 Found ${usersConfig.users.length} users to migrate`);
        
        const client = await pool.connect();
        
        for (const user of usersConfig.users) {
            console.log(`🔄 Processing user: ${user.email} (${user.role})`);
            
            // Hash password with bcrypt
            const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
            
            // Map role to new system
            let newRole = ROLE_MAPPING[user.role] || 'user';
            
            // Special handling for master user
            if (user.email === 'yterayut@gmail.com') {
                newRole = 'master';
                console.log(`🎯 Setting ${user.email} as MASTER user`);
            }
            
            // Insert user into database
            const insertQuery = `
                INSERT INTO users (email, password_hash, role, full_name, created_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (email) 
                DO UPDATE SET 
                    password_hash = EXCLUDED.password_hash,
                    role = EXCLUDED.role,
                    full_name = EXCLUDED.full_name,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, email, role
            `;
            
            const result = await client.query(insertQuery, [
                user.email,
                passwordHash,
                newRole,
                user.name
            ]);
            
            const savedUser = result.rows[0];
            console.log(`✅ User migrated: ${savedUser.email} (ID: ${savedUser.id}, Role: ${savedUser.role})`);
        }
        
        client.release();
        
        // Summary
        const summaryQuery = 'SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY role';
        const summaryClient = await pool.connect();
        const summary = await summaryClient.query(summaryQuery);
        summaryClient.release();
        
        console.log('\n📊 Migration Summary:');
        summary.rows.forEach(row => {
            console.log(`   ${row.role}: ${row.count} users`);
        });
        
        console.log('\n✨ User migration completed successfully!');
        
    } catch (error) {
        console.error('❌ User migration error:', error);
        throw error;
    }
}

async function verifyMigration() {
    console.log('\n🔍 Verifying migration...');
    
    try {
        const client = await pool.connect();
        
        // Check master user
        const masterQuery = 'SELECT * FROM users WHERE role = $1';
        const masterResult = await client.query(masterQuery, ['master']);
        
        if (masterResult.rows.length === 1) {
            const master = masterResult.rows[0];
            console.log(`✅ Master user verified: ${master.email}`);
            
            // Verify password can be compared
            const passwordCheck = await bcrypt.compare('12345', master.password_hash);
            console.log(`✅ Password hashing verified: ${passwordCheck ? 'PASS' : 'FAIL'}`);
        } else {
            console.log(`❌ Master user issue: Found ${masterResult.rows.length} master users (should be 1)`);
        }
        
        // Check total users
        const totalQuery = 'SELECT COUNT(*) as total FROM users';
        const totalResult = await client.query(totalQuery);
        console.log(`✅ Total users in database: ${totalResult.rows[0].total}`);
        
        client.release();
        
    } catch (error) {
        console.error('❌ Verification error:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('🎯 TaskFlow Pro Database Migration');
        console.log('==================================');
        
        await initializeDatabase();
        await migrateUsers();
        await verifyMigration();
        
        console.log('\n🎉 Migration completed successfully!');
        console.log('\n🔧 Next steps:');
        console.log('   1. Update backend to use PostgreSQL instead of users_config.json');
        console.log('   2. Test login with migrated users');
        console.log('   3. Implement JWT + HttpOnly cookies');
        
    } catch (error) {
        console.error('\n💥 Migration failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run migration
if (require.main === module) {
    main();
}

module.exports = { migrateUsers, initializeDatabase, verifyMigration };