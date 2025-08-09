// Jest Setup Configuration
require('dotenv').config({ path: '.env.test' });

const { setupTestDatabase, cleanupTestDatabase } = require('./test-setup');

// Global test configuration
jest.setTimeout(30000);

// Mock console methods to reduce noise
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Setup before all tests
beforeAll(async () => {
    try {
        await setupTestDatabase();
        console.info('🧪 Test environment initialized');
    } catch (error) {
        console.error('❌ Test setup failed:', error);
        process.exit(1);
    }
});

// Cleanup after all tests
afterAll(async () => {
    try {
        await cleanupTestDatabase();
        console.info('🧹 Test environment cleaned up');
    } catch (error) {
        console.error('❌ Test cleanup failed:', error);
    }
});

// Reset between test suites
beforeEach(() => {
    // Clear all mocks between tests
    jest.clearAllMocks();
});

// Global test utilities
global.testUtils = {
    // Test user credentials
    testUsers: {
        master: {
            email: 'test.master@example.com',
            password: 'testpass123',
            role: 'master'
        },
        manager: {
            email: 'test.manager@example.com',
            password: 'testpass123',
            role: 'manager'
        },
        teamLead: {
            email: 'test.teamlead@example.com',
            password: 'testpass123',
            role: 'team_lead'
        },
        employee: {
            email: 'test.employee@example.com',
            password: 'testpass123',
            role: 'employee'
        },
        inactive: {
            email: 'inactive.user@example.com',
            password: 'testpass123',
            role: 'employee'
        }
    },
    
    // Helper functions
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // Mock ClickUp responses
    mockClickUpResponses: {
        user: {
            data: {
                user: {
                    id: 123456,
                    username: 'testuser',
                    email: 'test@example.com'
                }
            }
        },
        teams: {
            data: {
                teams: [
                    {
                        id: 'team1',
                        name: 'Test Team 1'
                    }
                ]
            }
        },
        tasks: {
            data: {
                tasks: [
                    {
                        id: 'task1',
                        name: 'Test Task 1',
                        status: {
                            status: 'in progress'
                        },
                        assignees: [
                            {
                                email: 'test@example.com'
                            }
                        ]
                    }
                ]
            }
        }
    }
};