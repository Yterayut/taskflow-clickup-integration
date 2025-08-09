#!/usr/bin/env node
/**
 * Migration and Integration Script for Enhanced Token Management
 * Migrates existing system to use enhanced token management
 */

const fs = require('fs').promises;
const path = require('path');

class TokenMigrationIntegrator {
    constructor() {
        this.backendFile = './single_login_backend.js';
        this.backupDir = './migration_backup';
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    }

    /**
     * Main migration process
     */
    async migrate() {
        console.log('🚀 Starting Enhanced Token Management Migration...\n');

        try {
            // Step 1: Create backup
            await this.createBackup();
            
            // Step 2: Migrate legacy token
            await this.migrateLegacyToken();
            
            // Step 3: Update backend integration
            await this.updateBackendIntegration();
            
            // Step 4: Deploy enhanced login page
            await this.deployEnhancedLogin();
            
            // Step 5: Restart backend service
            await this.restartBackendService();
            
            console.log('\n✅ Migration completed successfully!');
            console.log('\n📋 Next Steps:');
            console.log('1. Access: http://192.168.20.10:8888/enhanced_login_with_token_manager.html');
            console.log('2. Master user (yterayut@gmail.com) should complete OAuth re-authentication');
            console.log('3. Verify token auto-refresh functionality');
            console.log('4. Monitor token status via the enhanced UI');

        } catch (error) {
            console.error('❌ Migration failed:', error);
            console.log('\n🔄 Rollback instructions:');
            console.log(`1. Restore from backup: ${this.backupDir}`);
            console.log('2. Restart original backend service');
            process.exit(1);
        }
    }

    /**
     * Create backup of current system
     */
    async createBackup() {
        console.log('📁 Creating system backup...');
        
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            
            // Backup current backend
            const backendContent = await fs.readFile(this.backendFile, 'utf8');
            await fs.writeFile(
                path.join(this.backupDir, `single_login_backend_${this.timestamp}.js`),
                backendContent
            );

            // Backup current token file
            try {
                const tokenContent = await fs.readFile('./master_clickup_token.json', 'utf8');
                await fs.writeFile(
                    path.join(this.backupDir, `master_clickup_token_${this.timestamp}.json`),
                    tokenContent
                );
                console.log('✅ Backed up existing token file');
            } catch (error) {
                console.log('ℹ️  No existing token file to backup');
            }

            console.log('✅ System backup created');

        } catch (error) {
            throw new Error(`Backup creation failed: ${error.message}`);
        }
    }

    /**
     * Migrate legacy token to enhanced format
     */
    async migrateLegacyToken() {
        console.log('🔄 Migrating legacy token...');
        
        const { EnhancedTokenManager } = require('./enhanced_token_manager');
        const tokenManager = new EnhancedTokenManager();
        
        const migrationResult = await tokenManager.migrateLegacyToken();
        
        if (migrationResult?.migrationRequired) {
            console.log('⚠️  Legacy token detected - requires OAuth re-authentication');
            console.log(`   Legacy user: ${migrationResult.legacyToken.clickupUsername}`);
            console.log(`   Last used: ${migrationResult.legacyToken.lastUsed}`);
        } else {
            console.log('✅ Token already in enhanced format or migration completed');
        }
    }

    /**
     * Update backend to integrate enhanced token management
     */
    async updateBackendIntegration() {
        console.log('🔧 Updating backend integration...');

        const backendContent = await fs.readFile(this.backendFile, 'utf8');
        
        // Check if already integrated
        if (backendContent.includes('EnhancedTokenManager')) {
            console.log('✅ Backend already has enhanced token management');
            return;
        }

        // Add enhanced imports
        const enhancedImports = `
// Enhanced Token Management
const { EnhancedTokenManager } = require('./enhanced_token_manager');
const { EnhancedOAuthHandler } = require('./enhanced_oauth_handler');
const masterTokenRoutes = require('./api/routes/masterTokenRoutes');
`;

        // Add enhanced middleware setup
        const enhancedMiddleware = `
// Enhanced Token Management Setup
const enhancedTokenManager = new EnhancedTokenManager();
const enhancedOAuthHandler = new EnhancedOAuthHandler(clickupIntegration);

// Set enhanced services
app.set('enhancedTokenManager', enhancedTokenManager);
app.set('enhancedOAuthHandler', enhancedOAuthHandler);
`;

        // Add enhanced routes
        const enhancedRoutes = `
// Enhanced OAuth routes (replace standard OAuth)
app.use('/auth', enhancedOAuthHandler.createRoutes());

// Master token management routes
app.use('/api/v2/master-token', masterTokenRoutes);
`;

        // Insert enhancements into backend
        let updatedContent = backendContent;

        // Add imports after existing imports
        const importInsertPoint = updatedContent.indexOf('const app = express();');
        updatedContent = updatedContent.slice(0, importInsertPoint) + 
                        enhancedImports + '\n' + 
                        updatedContent.slice(importInsertPoint);

        // Add middleware setup after app setup
        const middlewareInsertPoint = updatedContent.indexOf('// API routes');
        updatedContent = updatedContent.slice(0, middlewareInsertPoint) + 
                        enhancedMiddleware + '\n' + 
                        updatedContent.slice(middlewareInsertPoint);

        // Replace OAuth routes with enhanced routes
        updatedContent = updatedContent.replace(
            /app\.use\('\/auth', oauthRoutes\);/,
            enhancedRoutes
        );

        // Write updated backend
        await fs.writeFile(this.backendFile, updatedContent);
        console.log('✅ Backend integration updated');
    }

    /**
     * Deploy enhanced login page
     */
    async deployEnhancedLogin() {
        console.log('🚀 Deploying enhanced login page...');

        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
            // Copy enhanced login to server
            await execAsync(`scp enhanced_login_with_token_manager.html one-climate@192.168.20.10:/home/one-climate/team-workload/`);
            
            // Deploy to web directory
            await execAsync(`ssh one-climate@192.168.20.10 "sudo cp /home/one-climate/team-workload/enhanced_login_with_token_manager.html /var/www/taskflow/"`);
            
            console.log('✅ Enhanced login page deployed');
            
        } catch (error) {
            console.log('⚠️  Manual deployment required:', error.message);
            console.log('   Run: scp enhanced_login_with_token_manager.html one-climate@192.168.20.10:/home/one-climate/team-workload/');
            console.log('   Then: ssh one-climate@192.168.20.10 "sudo cp /home/one-climate/team-workload/enhanced_login_with_token_manager.html /var/www/taskflow/"');
        }
    }

    /**
     * Restart backend service with enhanced features
     */
    async restartBackendService() {
        console.log('🔄 Restarting backend service...');

        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
            // Copy updated files to server
            await execAsync(`scp single_login_backend.js enhanced_token_manager.js enhanced_oauth_handler.js one-climate@192.168.20.10:/home/one-climate/team-workload/`);
            await execAsync(`scp -r api/ one-climate@192.168.20.10:/home/one-climate/team-workload/`);
            
            // Stop current backend
            await execAsync(`ssh one-climate@192.168.20.10 "pkill -f single_login_backend.js"`);
            
            // Start enhanced backend
            await execAsync(`ssh one-climate@192.168.20.10 "cd /home/one-climate/team-workload && nohup node single_login_backend.js > enhanced_backend_${this.timestamp}.log 2>&1 &"`);
            
            // Wait for startup
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Test backend health
            const { stdout } = await execAsync(`curl -s http://192.168.20.10:7812/health`);
            const healthData = JSON.parse(stdout);
            
            if (healthData.status === 'OK') {
                console.log('✅ Enhanced backend service running');
                console.log(`   Service: ${healthData.service}`);
                console.log(`   Version: ${healthData.version}`);
            } else {
                throw new Error('Backend health check failed');
            }
            
        } catch (error) {
            console.log('⚠️  Manual service restart required:', error.message);
            console.log('   1. Copy files: scp single_login_backend.js enhanced_token_manager.js enhanced_oauth_handler.js one-climate@192.168.20.10:/home/one-climate/team-workload/');
            console.log('   2. Restart: ssh one-climate@192.168.20.10 "cd /home/one-climate/team-workload && pkill -f single_login_backend.js && nohup node single_login_backend.js > enhanced_backend.log 2>&1 &"');
        }
    }

    /**
     * Validate migration success
     */
    async validateMigration() {
        console.log('🧪 Validating migration...');

        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
            // Test enhanced token status endpoint
            const { stdout } = await execAsync(`curl -s http://192.168.20.10:7812/api/v2/master-token/status`);
            const tokenStatus = JSON.parse(stdout);
            
            if (tokenStatus.success) {
                console.log('✅ Enhanced token management API working');
                console.log(`   Token status: ${tokenStatus.token_status.status}`);
                console.log(`   Message: ${tokenStatus.token_status.message}`);
            } else {
                throw new Error('Token status API not responding correctly');
            }

            // Test enhanced login page
            const response = await execAsync(`curl -I http://192.168.20.10:8888/enhanced_login_with_token_manager.html`);
            if (response.stdout.includes('200 OK')) {
                console.log('✅ Enhanced login page accessible');
            } else {
                throw new Error('Enhanced login page not accessible');
            }

            console.log('✅ Migration validation passed');
            
        } catch (error) {
            console.log('⚠️  Migration validation warnings:', error.message);
        }
    }
}

// CLI execution
if (require.main === module) {
    const migrator = new TokenMigrationIntegrator();
    
    // Add command line options
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Enhanced Token Management Migration Tool

Usage: node migrate_and_integrate_enhanced_tokens.js [options]

Options:
  --help, -h          Show this help message
  --validate-only     Only validate current migration state
  --backup-only       Only create backup, don't migrate

Description:
  Migrates existing ClickUp token management to enhanced format with:
  - Automatic token refresh
  - Proactive expiry management
  - Enhanced OAuth flow
  - Real-time status monitoring
  - Better error handling
        `);
        process.exit(0);
    }
    
    if (args.includes('--validate-only')) {
        migrator.validateMigration().then(() => {
            console.log('✅ Validation completed');
        }).catch(console.error);
    } else if (args.includes('--backup-only')) {
        migrator.createBackup().then(() => {
            console.log('✅ Backup completed');
        }).catch(console.error);
    } else {
        migrator.migrate().then(() => {
            // Run validation after migration
            return migrator.validateMigration();
        }).catch(console.error);
    }
}

module.exports = { TokenMigrationIntegrator };