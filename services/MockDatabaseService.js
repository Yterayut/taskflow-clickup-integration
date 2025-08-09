/**
 * Mock Database Service for Development
 * สำหรับการพัฒนาและทดสอบโดยไม่ต้องใช้ PostgreSQL จริง
 */
class MockDatabaseService {
    constructor() {
        this.connected = false;
        this.data = new Map();
        this.users = new Map();
        this.sessions = new Map();
        this.syncData = new Map();
        
        // Initialize with sample data
        this.initializeSampleData();
    }

    initializeSampleData() {
        // Sample users
        this.users.set('admin@taskflow.com', {
            id: 1,
            username: 'admin@taskflow.com',
            email: 'admin@taskflow.com',
            role: 'admin',
            password: '$2b$10$hashedpassword',
            created_at: new Date(),
            updated_at: new Date()
        });

        this.users.set('manager@taskflow.com', {
            id: 2,
            username: 'manager@taskflow.com',
            email: 'manager@taskflow.com',
            role: 'manager',
            password: '$2b$10$hashedpassword',
            created_at: new Date(),
            updated_at: new Date()
        });

        console.log('🗄️ Mock Database initialized with sample data');
    }

    async connect() {
        try {
            // Simulate connection delay
            await new Promise(resolve => setTimeout(resolve, 100));
            this.connected = true;
            console.log('✅ Mock Database connected successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ Mock Database connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        this.connected = false;
        console.log('✅ Mock Database disconnected');
    }

    async query(sql, params = []) {
        if (!this.connected) {
            throw new Error('Database not connected');
        }

        console.log('🔍 Mock DB Query:', sql.substring(0, 100) + '...');

        // Simulate different query types
        if (sql.includes('SELECT') && sql.includes('users')) {
            return this.handleUserQuery(sql, params);
        }
        
        if (sql.includes('INSERT') && sql.includes('sessions')) {
            return this.handleSessionInsert(sql, params);
        }

        if (sql.includes('SELECT') && sql.includes('sessions')) {
            return this.handleSessionQuery(sql, params);
        }

        if (sql.includes('DELETE') && sql.includes('sessions')) {
            return this.handleSessionDelete(sql, params);
        }

        // Default mock response
        return { 
            rows: [], 
            rowCount: 0,
            command: 'SELECT'
        };
    }

    handleUserQuery(sql, params) {
        if (sql.includes('WHERE email')) {
            const email = params[0];
            const user = this.users.get(email);
            return {
                rows: user ? [user] : [],
                rowCount: user ? 1 : 0,
                command: 'SELECT'
            };
        }

        // Return all users
        return {
            rows: Array.from(this.users.values()),
            rowCount: this.users.size,
            command: 'SELECT'
        };
    }

    handleSessionInsert(sql, params) {
        const sessionId = params[0] || 'session_' + Date.now();
        const userId = params[1] || 1;
        const sessionData = {
            session_id: sessionId,
            user_id: userId,
            created_at: new Date(),
            updated_at: new Date(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };
        
        this.sessions.set(sessionId, sessionData);
        return {
            rows: [sessionData],
            rowCount: 1,
            command: 'INSERT'
        };
    }

    handleSessionQuery(sql, params) {
        const sessionId = params[0];
        const session = this.sessions.get(sessionId);
        return {
            rows: session ? [session] : [],
            rowCount: session ? 1 : 0,
            command: 'SELECT'
        };
    }

    handleSessionDelete(sql, params) {
        const sessionId = params[0];
        const existed = this.sessions.has(sessionId);
        this.sessions.delete(sessionId);
        return {
            rows: [],
            rowCount: existed ? 1 : 0,
            command: 'DELETE'
        };
    }

    // Enhanced methods for Phase 2
    async storeCache(key, value, ttl = 300) {
        const cacheEntry = {
            value: value,
            created_at: Date.now(),
            expires_at: Date.now() + (ttl * 1000),
            size_bytes: JSON.stringify(value).length
        };
        
        this.data.set(key, cacheEntry);
        console.log(`💾 Mock DB Cache store: ${key} -> ${JSON.stringify(value).substring(0, 50)}... (${cacheEntry.size_bytes} bytes)`);
        
        return { success: true, key, size: cacheEntry.size_bytes };
    }

    async getCache(key) {
        const entry = this.data.get(key);
        if (!entry) {
            return null;
        }

        // Check expiration
        if (Date.now() > entry.expires_at) {
            this.data.delete(key);
            return null;
        }

        console.log(`🔍 Mock DB Cache hit: ${key}`);
        return entry.value;
    }

    async deleteCache(key) {
        const existed = this.data.has(key);
        this.data.delete(key);
        console.log(`🗑️ Mock DB Cache delete: ${key} (${existed ? 'existed' : 'not found'})`);
        return { success: true, deleted: existed };
    }

    async clearCache(pattern = '*') {
        let deletedCount = 0;
        
        if (pattern === '*') {
            deletedCount = this.data.size;
            this.data.clear();
        } else {
            // Simple pattern matching
            const regex = new RegExp(pattern.replace('*', '.*'));
            for (const key of this.data.keys()) {
                if (regex.test(key)) {
                    this.data.delete(key);
                    deletedCount++;
                }
            }
        }
        
        console.log(`🗑️ Mock DB Cache clear: ${pattern} (${deletedCount} entries deleted)`);
        return { success: true, deletedCount };
    }

    async getStats() {
        const totalSize = Array.from(this.data.values())
            .reduce((sum, entry) => sum + entry.size_bytes, 0);

        return {
            entries: this.data.size,
            total_size_bytes: totalSize,
            users: this.users.size,
            sessions: this.sessions.size,
            connected: this.connected
        };
    }

    async healthCheck() {
        return {
            status: this.connected ? 'healthy' : 'disconnected',
            type: 'mock',
            entries: this.data.size,
            uptime: this.connected ? 'connected' : 'disconnected'
        };
    }
}

module.exports = MockDatabaseService;