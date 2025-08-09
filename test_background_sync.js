const { BackgroundSyncService } = require('./infrastructure/services/BackgroundSyncService');
const { EnhancedClickUpService } = require('./infrastructure/services/EnhancedClickUpService');

console.log('🧪 Testing Background Sync Implementation...');

try {
  console.log('✅ BackgroundSyncService import successful');
  console.log('✅ EnhancedClickUpService import successful');
  
  const mockRepo = {
    initialize: async () => {},
    upsertTask: async () => {},
    upsertSpace: async () => {},
    healthCheck: async () => ({ status: 'healthy' }),
    updateSyncMetadata: async () => {}
  };
  
  const mockToken = {
    findMasterToken: async () => ({ accessToken: 'test_token' })
  };
  
  const mockAudit = {
    logEvent: async () => {}
  };
  
  const clickupService = new EnhancedClickUpService();
  const syncService = new BackgroundSyncService({
    clickupService,
    syncRepository: mockRepo,
    tokenRepository: mockToken,
    auditService: mockAudit
  });
  
  console.log('✅ BackgroundSyncService initialization successful');
  console.log('📊 Service Status:', JSON.stringify(syncService.getStatus(), null, 2));
  console.log('🎯 Test completed successfully!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
