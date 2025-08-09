const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'taskflow_auth',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Starting database migration...');
        
        // Read and execute schema
        const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await client.query(schemaSQL);
        console.log('✅ Database schema created successfully');
        
        // Seed initial users
        await seedUsers(client);
        console.log('✅ Initial users seeded successfully');
        
        console.log('🎉 Database migration completed!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function seedUsers(client) {
    console.log('🌱 Seeding initial users...');
    
    const saltRounds = 12;
    const defaultPassword = '12345';
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
    
    const users = [
        // Master user
        {
            email: 'yterayut@gmail.com',
            full_name: 'Teerayut Yeerahem',
            role: 'master',
            password_hash: hashedPassword
        },
        
        // Manager
        {
            email: 'yterayut@gmail.com', // Same as master for role flexibility
            full_name: 'Teerayut Yeerahem',
            role: 'manager',
            password_hash: hashedPassword
        },
        
        // Team Lead
        {
            email: 'chaiwutwck@gmail.com',
            full_name: 'ชัยวุฒิ ไวเชิงค้า',
            role: 'team_lead',
            password_hash: hashedPassword
        },
        
        // Employees
        {
            email: 'atthakorn.na@ku.th',
            full_name: 'Athakorn NATUNG',
            role: 'employee',
            password_hash: hashedPassword
        },
        {
            email: 'sahassavas.rim@gmail.com',
            full_name: 'Sahatsawat Rimphongern',
            role: 'employee',
            password_hash: hashedPassword
        },
        {
            email: 'primshi1719@gmail.com',
            full_name: 'มัทนพร แก้วอําไพ',
            role: 'employee',
            password_hash: hashedPassword
        },
        {
            email: 'panuwantung@gmail.com',
            full_name: 'PANUWAT PROMRAKSA',
            role: 'employee',
            password_hash: hashedPassword
        },
        {
            email: 'jirapat.sripanya@gmail.com',
            full_name: 'Jirapat Sripanya',
            role: 'employee',
            password_hash: hashedPassword
        },
        {
            email: 'chutithep_ar@kkumail.com',
            full_name: 'Chutithep Phakdeebut',
            role: 'employee',
            password_hash: hashedPassword
        },
        {
            email: 'pongsanzakom@gmail.com',
            full_name: 'Pong',
            role: 'employee',
            password_hash: hashedPassword
        },
        {
            email: 'nisareen.dk@gmail.com',
            full_name: 'Nisareen Daklee',
            role: 'employee',
            password_hash: hashedPassword
        },
        {
            email: 'jthammakit2546@gmail.com',
            full_name: 'Thammakit Ch',
            role: 'employee',
            password_hash: hashedPassword
        }
    ];
    
    for (const user of users) {
        const query = `
            INSERT INTO users (email, full_name, role, password_hash)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (email) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role,
                password_hash = EXCLUDED.password_hash,
                updated_at = CURRENT_TIMESTAMP
        `;
        
        await client.query(query, [
            user.email,
            user.full_name,
            user.role,
            user.password_hash
        ]);
        
        console.log(`👤 User created: ${user.email} (${user.role})`);
    }
}

async function testConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('✅ Database connection successful:', result.rows[0].now);
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Export functions
module.exports = {
    runMigration,
    testConnection,
    pool
};

// Run migration if called directly
if (require.main === module) {
    (async () => {
        try {
            // Test connection first
            const connected = await testConnection();
            if (!connected) {
                process.exit(1);
            }
            
            // Run migration
            await runMigration();
            process.exit(0);
        } catch (error) {
            console.error('Migration failed:', error);
            process.exit(1);
        }
    })();
}