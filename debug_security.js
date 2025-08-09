/**
 * Debug script to test security routes registration
 */

const express = require('express');
const app = express();

// Basic middleware
app.use(express.json());

// Mock services for routes
app.set('accountSecurityService', {
    healthCheck: async () => ({
        status: 'healthy',
        initialized: true
    })
});

// Load security routes
try {
    const securityRoutes = require('./api/routes/securityRoutes');
    app.use('/api/v2/security', securityRoutes);
    console.log('✅ Security routes loaded and registered');
} catch (error) {
    console.error('❌ Error loading security routes:', error);
}

// Test health endpoint
const PORT = 7813;
app.listen(PORT, () => {
    console.log(`🚀 Debug server running on port ${PORT}`);
    
    // Test the health endpoint
    setTimeout(async () => {
        try {
            const response = await fetch(`http://localhost:${PORT}/api/v2/security/health`);
            const result = await response.json();
            console.log('✅ Security health test result:', result);
        } catch (error) {
            console.error('❌ Health test failed:', error);
        }
        process.exit(0);
    }, 1000);
});