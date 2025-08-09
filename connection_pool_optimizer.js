/**
 * Connection Pool Optimizer for TaskFlow Pro
 * Manages database connections and HTTP request pooling
 */

const http = require('http');
const https = require('https');

class ConnectionPoolOptimizer {
    constructor(config = {}) {
        this.config = {
            maxPoolSize: 20,
            minPoolSize: 5,
            acquireTimeout: 30000,
            idleTimeout: 300000,
            maxUses: 1000,
            ...config
        };
        
        this.pools = new Map();
        this.stats = {
            created: 0,
            acquired: 0,
            released: 0,
            destroyed: 0,
            timeouts: 0
        };
        
        this.setupHttpAgents();
        this.startPoolMonitoring();
    }

    setupHttpAgents() {
        // Optimize HTTP agent settings
        this.httpAgent = new http.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: this.config.maxPoolSize,
            maxFreeSockets: this.config.minPoolSize,
            timeout: 60000
        });
        
        this.httpsAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: this.config.maxPoolSize,
            maxFreeSockets: this.config.minPoolSize,
            timeout: 60000
        });
    }

    getOptimizedAxiosConfig() {
        return {
            httpAgent: this.httpAgent,
            httpsAgent: this.httpsAgent,
            timeout: 10000,
            maxContentLength: 50 * 1024 * 1024, // 50MB
            maxBodyLength: 50 * 1024 * 1024,
            validateStatus: (status) => status < 500 // Don't throw on 4xx
        };
    }

    async createDatabasePool(connectionConfig) {
        const poolName = connectionConfig.database || 'default';
        
        if (this.pools.has(poolName)) {
            return this.pools.get(poolName);
        }
        
        const pool = {
            connections: [],
            waiting: [],
            config: connectionConfig,
            stats: {
                active: 0,
                idle: 0,
                waiting: 0
            }
        };
        
        // Pre-create minimum connections
        for (let i = 0; i < this.config.minPoolSize; i++) {
            const connection = await this.createConnection(connectionConfig);
            pool.connections.push({
                connection,
                inUse: false,
                created: Date.now(),
                uses: 0
            });
        }
        
        this.pools.set(poolName, pool);
        console.log('🔗 Database pool created:', poolName, 'with', this.config.minPoolSize, 'connections');
        
        return pool;
    }

    async acquireConnection(poolName = 'default') {
        const pool = this.pools.get(poolName);
        if (!pool) {
            throw new Error('Pool not found: ' + poolName);
        }
        
        // Find available connection
        for (const item of pool.connections) {
            if (!item.inUse) {
                item.inUse = true;
                item.uses++;
                this.stats.acquired++;
                pool.stats.active++;
                pool.stats.idle--;
                return item.connection;
            }
        }
        
        // Create new connection if pool not at max
        if (pool.connections.length < this.config.maxPoolSize) {
            const connection = await this.createConnection(pool.config);
            const item = {
                connection,
                inUse: true,
                created: Date.now(),
                uses: 1
            };
            
            pool.connections.push(item);
            this.stats.created++;
            this.stats.acquired++;
            pool.stats.active++;
            
            return connection;
        }
        
        // Wait for available connection
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.stats.timeouts++;
                reject(new Error('Connection acquire timeout'));
            }, this.config.acquireTimeout);
            
            pool.waiting.push({
                resolve: (connection) => {
                    clearTimeout(timeout);
                    resolve(connection);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
            
            pool.stats.waiting++;
        });
    }

    releaseConnection(connection, poolName = 'default') {
        const pool = this.pools.get(poolName);
        if (!pool) return;
        
        const item = pool.connections.find(item => item.connection === connection);
        if (!item) return;
        
        item.inUse = false;
        this.stats.released++;
        pool.stats.active--;
        pool.stats.idle++;
        
        // Check if connection should be retired
        if (item.uses >= this.config.maxUses || 
            Date.now() - item.created > this.config.idleTimeout) {
            this.destroyConnection(item, pool);
            return;
        }
        
        // Serve waiting requests
        if (pool.waiting.length > 0) {
            const waiter = pool.waiting.shift();
            item.inUse = true;
            item.uses++;
            pool.stats.active++;
            pool.stats.idle--;
            pool.stats.waiting--;
            waiter.resolve(connection);
        }
    }

    async createConnection(config) {
        // Mock database connection creation
        return {
            id: Math.random().toString(36).substr(2, 9),
            config,
            query: async (sql, params) => {
                // Simulate query execution
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                return { rows: [], rowCount: 0 };
            },
            close: () => {
                // Simulate connection close
            }
        };
    }

    destroyConnection(item, pool) {
        try {
            item.connection.close();
        } catch (error) {
            console.warn('Error closing connection:', error.message);
        }
        
        const index = pool.connections.indexOf(item);
        if (index > -1) {
            pool.connections.splice(index, 1);
        }
        
        this.stats.destroyed++;
    }

    startPoolMonitoring() {
        setInterval(() => {
            this.monitorPools();
        }, 60000); // Monitor every minute
    }

    monitorPools() {
        for (const [name, pool] of this.pools) {
            const stats = {
                name,
                total: pool.connections.length,
                active: pool.stats.active,
                idle: pool.stats.idle,
                waiting: pool.stats.waiting
            };
            
            console.log('📊 Pool stats:', JSON.stringify(stats));
            
            // Health check: ensure minimum connections
            const idleCount = pool.connections.filter(item => !item.inUse).length;
            if (idleCount < this.config.minPoolSize) {
                this.ensureMinimumConnections(pool).catch(console.error);
            }
        }
    }

    async ensureMinimumConnections(pool) {
        const needed = this.config.minPoolSize - pool.connections.filter(item => !item.inUse).length;
        
        for (let i = 0; i < needed; i++) {
            if (pool.connections.length >= this.config.maxPoolSize) break;
            
            try {
                const connection = await this.createConnection(pool.config);
                pool.connections.push({
                    connection,
                    inUse: false,
                    created: Date.now(),
                    uses: 0
                });
                this.stats.created++;
                pool.stats.idle++;
            } catch (error) {
                console.error('Failed to create connection:', error.message);
                break;
            }
        }
    }

    getStats() {
        const poolStats = {};
        for (const [name, pool] of this.pools) {
            poolStats[name] = {
                total: pool.connections.length,
                active: pool.stats.active,
                idle: pool.stats.idle,
                waiting: pool.stats.waiting
            };
        }
        
        return {
            global: this.stats,
            pools: poolStats,
            agents: {
                http: {
                    sockets: this.httpAgent.sockets,
                    freeSockets: this.httpAgent.freeSockets
                },
                https: {
                    sockets: this.httpsAgent.sockets,
                    freeSockets: this.httpsAgent.freeSockets
                }
            }
        };
    }

    async close() {
        for (const [name, pool] of this.pools) {
            for (const item of pool.connections) {
                this.destroyConnection(item, pool);
            }
        }
        
        this.pools.clear();
        this.httpAgent.destroy();
        this.httpsAgent.destroy();
    }
}

module.exports = { ConnectionPoolOptimizer };