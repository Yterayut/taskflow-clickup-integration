/**
 * Integration Script - Add ClickUp Sync to Backend
 * Integrates the new sync service into existing single_login_backend.js
 */
const fs = require('fs');
const path = require('path');

function integrateSync() {
    console.log('🔄 Integrating ClickUp Sync into backend...');
    
    // Read current backend file
    const backendPath = path.join(__dirname, 'single_login_backend.js');
    let backendContent = fs.readFileSync(backendPath, 'utf8');
    
    // Add sync imports after existing imports
    const importAdditions = `
// ClickUp Sync Service imports (Phase 1)
const { ClickUpSyncRepository } = require('./infrastructure/repositories/ClickUpSyncRepository');
const { ClickUpSyncService } = require('./application/services/ClickUpSyncService');
const localDataRoutes = require('./api/routes/localDataRoutes');
`;

    // Find where to insert imports (after existing API routes imports)
    const importInsertPoint = backendContent.indexOf('const clickupDataRoutes = require');
    if (importInsertPoint !== -1) {
        const nextLine = backendContent.indexOf('\n', importInsertPoint) + 1;
        backendContent = backendContent.slice(0, nextLine) + importAdditions + backendContent.slice(nextLine);
    }

    // Add sync service initialization in the initializeServices function
    const syncServiceInit = `
        console.log('🔄 Initializing ClickUp sync services...');
        const syncRepository = new ClickUpSyncRepository(dbClient);
        const syncService = new ClickUpSyncService({
            clickupIntegration,
            syncRepository,
            tokenRepository
        });
`;

    // Find the service initialization section
    const serviceInitPoint = backendContent.indexOf('console.log(\'🔄 Initializing application services...\');');
    if (serviceInitPoint !== -1) {
        const nextLine = backendContent.indexOf('\n', serviceInitPoint);
        const insertPoint = backendContent.indexOf('// Store services in app', nextLine);
        if (insertPoint !== -1) {
            backendContent = backendContent.slice(0, insertPoint) + syncServiceInit + '\n        ' + backendContent.slice(insertPoint);
        }
    }

    // Add services to app storage
    const serviceStorage = `        app.set('syncRepository', syncRepository);
        app.set('syncService', syncService);
`;

    const appSetPoint = backendContent.indexOf('app.set(\'tokenRepository\', tokenRepository);');
    if (appSetPoint !== -1) {
        const nextLine = backendContent.indexOf('\n', appSetPoint) + 1;
        backendContent = backendContent.slice(0, nextLine) + serviceStorage + backendContent.slice(nextLine);
    }

    // Add local data routes
    const routeAddition = `
// Phase 1: Local ClickUp data routes (fast local database)
app.use('/api/v2/local', localDataRoutes);
`;

    const routeInsertPoint = backendContent.indexOf('app.use(\'/api/v2/clickup\', clickupDataRoutes);');
    if (routeInsertPoint !== -1) {
        const nextLine = backendContent.indexOf('\n', routeInsertPoint) + 1;
        backendContent = backendContent.slice(0, nextLine) + routeAddition + backendContent.slice(nextLine);
    }

    // Add initial sync on startup
    const initialSyncAddition = `
        // Perform initial sync if no data exists
        console.log('🔄 Checking for existing sync data...');
        const syncMeta = await syncService.getSyncStatus();
        if (!syncMeta.sync_metadata || syncMeta.sync_metadata.total_tasks === 0) {
            console.log('📡 No sync data found, performing initial sync...');
            try {
                await syncService.performFullSync();
                console.log('✅ Initial sync completed successfully');
            } catch (error) {
                console.warn('⚠️ Initial sync failed, will retry later:', error.message);
            }
        } else {
            console.log('✅ Existing sync data found, skipping initial sync');
        }
`;

    const serverStartPoint = backendContent.indexOf('console.log(`🚀 TaskFlow Pro authentication server running on port ${PORT}`);');
    if (serverStartPoint !== -1) {
        const insertPoint = backendContent.lastIndexOf('\n', serverStartPoint);
        backendContent = backendContent.slice(0, insertPoint) + initialSyncAddition + backendContent.slice(insertPoint);
    }

    // Write integrated backend
    const integratedBackendPath = path.join(__dirname, 'single_login_backend_with_sync.js');
    fs.writeFileSync(integratedBackendPath, backendContent);
    
    console.log('✅ Backend integration completed!');
    console.log('📁 Integrated backend saved as: single_login_backend_with_sync.js');
    
    return integratedBackendPath;
}

// Run integration
if (require.main === module) {
    try {
        integrateSync();
    } catch (error) {
        console.error('❌ Integration failed:', error);
        process.exit(1);
    }
}

module.exports = { integrateSync };