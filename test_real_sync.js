/**
 * Test Real ClickUp Data Sync
 * Run full sync with real ClickUp data
 */

const ClickUpRealDataSync = require('./clickup_real_data_sync');

// PostgreSQL connection config
const dbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'taskflow_pro',
    user: 'postgres',
    password: '',
    ssl: false
};

const CLICKUP_TOKEN = 'pk_282686567_9YVTHM0C1HQJDMEUWZP8RTP48S4YV5HL';

async function testRealSync() {
    const sync = new ClickUpRealDataSync(CLICKUP_TOKEN, dbConfig);
    
    try {
        console.log('🚀 Starting real ClickUp data sync test...');
        
        const result = await sync.fullSync();
        
        if (result.success) {
            console.log('✅ Sync completed successfully!');
            console.log('📊 Results:', result.counts);
        } else {
            console.log('❌ Sync failed:', result.error);
        }
        
    } catch (error) {
        console.error('❌ Sync error:', error);
    } finally {
        await sync.close();
    }
}

testRealSync();