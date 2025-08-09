#!/usr/bin/env node
/**
 * Token Encryption Migration Script
 * Encrypts all existing plain text tokens in the database
 * 
 * CRITICAL SECURITY: Run this immediately after deployment
 */

require('dotenv').config();
const { getDatabase } = require('../infrastructure/database/DatabaseClient');
const { tokenEncryptionService } = require('../infrastructure/adapters/TokenEncryptionService');

async function encryptExistingTokens() {
    console.log('🔐 Starting token encryption migration...');
    console.log('📊 This will encrypt all existing plain text tokens in the database');
    
    let dbClient;
    
    try {
        // Initialize encryption service
        await tokenEncryptionService.initialize();
        console.log('✅ Encryption service initialized');
        
        // Connect to database
        dbClient = getDatabase();
        await dbClient.connect();
        console.log('✅ Database connection established');
        
        // Get all tokens from database
        const result = await dbClient.query('SELECT * FROM clickup_tokens ORDER BY id');
        const tokens = result.rows;
        
        console.log(`📋 Found ${tokens.length} tokens to process`);
        
        if (tokens.length === 0) {
            console.log('ℹ️  No tokens found to encrypt');
            return;
        }
        
        let encryptedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        // Process each token
        for (const token of tokens) {
            try {
                console.log(`\n🔄 Processing token ID ${token.id} for user ${token.user_id}...`);
                
                let needsUpdate = false;
                const updates = {};
                
                // Check and encrypt access_token
                if (token.access_token) {
                    if (tokenEncryptionService.isEncrypted(token.access_token)) {
                        console.log('   ℹ️  Access token already encrypted');
                    } else {
                        console.log('   🔐 Encrypting access token...');
                        updates.access_token = await tokenEncryptionService.encryptToken(token.access_token);
                        needsUpdate = true;
                    }
                }
                
                // Check and encrypt refresh_token
                if (token.refresh_token) {
                    if (tokenEncryptionService.isEncrypted(token.refresh_token)) {
                        console.log('   ℹ️  Refresh token already encrypted');
                    } else {
                        console.log('   🔐 Encrypting refresh token...');
                        updates.refresh_token = await tokenEncryptionService.encryptToken(token.refresh_token);
                        needsUpdate = true;
                    }
                }
                
                // Update database if needed
                if (needsUpdate) {
                    const updateFields = [];
                    const updateValues = [];
                    let paramCount = 1;
                    
                    if (updates.access_token) {
                        updateFields.push(`access_token = $${paramCount++}`);
                        updateValues.push(updates.access_token);
                    }
                    
                    if (updates.refresh_token) {
                        updateFields.push(`refresh_token = $${paramCount++}`);
                        updateValues.push(updates.refresh_token);
                    }
                    
                    updateFields.push(`updated_at = NOW()`);
                    updateValues.push(token.id);
                    
                    const updateQuery = `
                        UPDATE clickup_tokens 
                        SET ${updateFields.join(', ')}
                        WHERE id = $${paramCount}
                    `;
                    
                    await dbClient.query(updateQuery, updateValues);
                    console.log('   ✅ Token encrypted and saved');
                    encryptedCount++;
                } else {
                    console.log('   ⏭️  No encryption needed');
                    skippedCount++;
                }
                
            } catch (error) {
                console.error(`   ❌ Error processing token ID ${token.id}:`, error.message);
                errorCount++;
            }
        }
        
        // Summary
        console.log('\n🎉 Token encryption migration completed!');
        console.log('📊 Summary:');
        console.log(`   ✅ Encrypted: ${encryptedCount} tokens`);
        console.log(`   ⏭️  Skipped: ${skippedCount} tokens (already encrypted)`);
        console.log(`   ❌ Errors: ${errorCount} tokens`);
        
        if (errorCount > 0) {
            console.log('⚠️  Some tokens failed to encrypt. Please review the errors above.');
            process.exit(1);
        } else {
            console.log('🔐 All tokens are now securely encrypted!');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (dbClient) {
            await dbClient.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    encryptExistingTokens().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { encryptExistingTokens };