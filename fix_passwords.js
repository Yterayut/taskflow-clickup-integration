#!/usr/bin/env node

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'taskflow_pro',
    user: 'taskflow_user',
    password: 'TaskFlow2025Secure',
});

async function fixPasswords() {
    try {
        console.log('🔧 Fixing user passwords...');
        
        // Generate correct password hash for "12345"
        const hash = await bcrypt.hash('12345', 12);
        console.log('✅ Generated password hash:', hash);
        
        // Update all users
        const result = await pool.query(
            'UPDATE users SET password_hash = $1',
            [hash]
        );
        
        console.log(`✅ Updated ${result.rowCount} users`);
        
        // Verify the hash works
        const isValid = await bcrypt.compare('12345', hash);
        console.log('✅ Password verification:', isValid);
        
        // Test with database
        const userResult = await pool.query(
            'SELECT email, password_hash FROM users WHERE email = $1',
            ['yterayut@gmail.com']
        );
        
        if (userResult.rows.length > 0) {
            const storedHash = userResult.rows[0].password_hash;
            const testResult = await bcrypt.compare('12345', storedHash);
            console.log('✅ Database hash test:', testResult);
            console.log('📧 Test user:', userResult.rows[0].email);
        }
        
        console.log('🎉 Password fix complete!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

fixPasswords();