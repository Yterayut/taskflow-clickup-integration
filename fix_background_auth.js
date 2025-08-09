/**
 * Background Authentication Fix Script
 * Resolves crypto key issues and initializes token auto-refresh
 */

require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

async function fixBackgroundAuth() {
    console.log('🔧 [ARCHITECT] Starting Background Authentication Fix...');
    
    try {
        // 1. Set up encryption key environment variable
        const keyMaterial = require('os').hostname() + (process.env.DB_PASSWORD || 'TaskFlow2025Secure') + 'taskflow-secure';
        const encryptionKey = crypto.pbkdf2Sync(
            keyMaterial,
            'taskflow-server-salt',
            100000,
            32,
            'sha256'
        );
        
        // Store as environment variable for the session
        process.env.TASKFLOW_ENCRYPTION_KEY = encryptionKey.toString('hex');
        console.log('✅ Encryption key generated and set');
        
        // 2. Test secure storage initialization
        const { SecureCredentialStorage } = require('./infrastructure/storage/SecureCredentialStorage');
        const secureStorage = new SecureCredentialStorage({
            logger: console,
            storageDir: './.secure'
        });
        
        await secureStorage.initialize();
        console.log('✅ Secure storage initialized successfully');
        
        // 3. Migrate existing token if available
        const legacyTokenPath = './master_clickup_token.json';
        try {
            const legacyTokenData = await fs.readFile(legacyTokenPath, 'utf8');
            const tokenData = JSON.parse(legacyTokenData);
            
            console.log('📦 Found legacy token, migrating...');
            
            const enhancedTokenData = {
                accessToken: tokenData.accessToken,
                tokenType: tokenData.tokenType || 'Bearer',
                userEmail: tokenData.userEmail,
                lastUsed: tokenData.lastUsed || new Date().toISOString(),
                migratedFrom: 'legacy_file',
                migratedAt: new Date().toISOString(),
                refreshToken: tokenData.refreshToken || null
            };
            
            await secureStorage.storeToken(enhancedTokenData);
            console.log('✅ Token migration completed');
            
            // Backup legacy file
            await fs.rename(legacyTokenPath, `${legacyTokenPath}.backup`);
            console.log('✅ Legacy token file backed up');
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('ℹ️ No legacy token found - will start fresh');
            } else {
                console.warn('⚠️ Token migration failed:', error.message);
            }
        }
        
        // 4. Test background auth integration
        console.log('🔄 Testing background authentication integration...');
        
        // Import and test the integration
        const { BackgroundAuthIntegration } = require('./application/services/BackgroundAuthIntegration');
        const { ClickUpOAuthAdapter } = require('./infrastructure/adapters/ClickUpOAuthAdapter');
        const { SystemService } = require('./application/services/SystemService');
        
        // Create minimal OAuth adapter for testing
        const clickupOAuth = new ClickUpOAuthAdapter({
            clientId: process.env.CLICKUP_CLIENT_ID,
            clientSecret: process.env.CLICKUP_CLIENT_SECRET,
            redirectUri: process.env.CLICKUP_REDIRECT_URI
        });
        
        // Create minimal system service
        const systemService = new SystemService();
        
        const backgroundAuth = new BackgroundAuthIntegration(
            clickupOAuth,
            systemService,
            console
        );
        
        await backgroundAuth.initialize();
        console.log('✅ Background authentication integration initialized');
        
        // 5. Create environment variable file for production
        const envContent = `# Background Authentication Environment Variables
TASKFLOW_ENCRYPTION_KEY=${encryptionKey.toString('hex')}
SECURE_STORAGE_DIR=./.secure
`;
        
        await fs.writeFile('./.env.secure', envContent);
        console.log('✅ Secure environment file created');
        
        console.log('');
        console.log('🎉 Background Authentication Fix Complete!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Restart the backend service');
        console.log('2. Background auth will automatically refresh tokens');
        console.log('3. No more manual OAuth needed');
        
        return {
            success: true,
            encryptionKey: encryptionKey.toString('hex'),
            message: 'Background authentication fixed and ready'
        };
        
    } catch (error) {
        console.error('❌ Background Authentication Fix Failed:', error);
        throw error;
    }
}

// Run the fix if called directly
if (require.main === module) {
    fixBackgroundAuth()
        .then(result => {
            console.log('\n✅ Fix completed:', result.message);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Fix failed:', error.message);
            process.exit(1);
        });
}

module.exports = { fixBackgroundAuth };