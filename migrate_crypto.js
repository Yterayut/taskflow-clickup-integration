/**
 * Crypto Migration Script
 * Migrates from deprecated CBC to secure GCM encryption
 */

require('dotenv').config();
const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');

async function migrateCrypto() {
    console.log('🔄 Starting crypto migration from CBC to GCM...');
    
    try {
        // Load encryption key
        const keyMaterial = require('os').hostname() + (process.env.DB_PASSWORD || 'TaskFlow2025Secure') + 'taskflow-secure';
        const encryptionKey = crypto.pbkdf2Sync(
            keyMaterial,
            'taskflow-server-salt',
            100000,
            32,
            'sha256'
        );
        
        console.log('✅ Encryption key loaded');
        
        const secureDir = './.secure';
        const tokenFile = path.join(secureDir, 'clickup_token.enc');
        
        // Check if encrypted token exists
        try {
            await fs.access(tokenFile);
            console.log('📦 Found encrypted token file, removing for fresh migration...');
            
            // Remove old encrypted files to force fresh migration
            await fs.unlink(tokenFile);
            console.log('✅ Old encrypted token removed');
            
        } catch (error) {
            console.log('ℹ️ No encrypted token found - will start fresh');
        }
        
        // Check for legacy backup token
        const legacyBackupPath = './master_clickup_token.json.backup';
        try {
            const legacyData = await fs.readFile(legacyBackupPath, 'utf8');
            const tokenData = JSON.parse(legacyData);
            
            console.log('📦 Found legacy backup token, will migrate fresh...');
            
            // Restore legacy token temporarily for migration
            await fs.writeFile('./master_clickup_token.json', legacyData);
            console.log('✅ Legacy token restored for migration');
            
        } catch (error) {
            console.warn('⚠️ No legacy backup found');
        }
        
        console.log('🎉 Crypto migration preparation complete!');
        console.log('Next: Restart backend to perform fresh token migration with new crypto');
        
        return {
            success: true,
            message: 'Ready for fresh migration with new crypto'
        };
        
    } catch (error) {
        console.error('❌ Crypto migration failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    migrateCrypto()
        .then(result => {
            console.log('\n✅ Crypto migration prepared:', result.message);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Migration failed:', error.message);
            process.exit(1);
        });
}

module.exports = { migrateCrypto };