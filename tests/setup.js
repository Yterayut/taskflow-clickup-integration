// Test setup configuration

// Mock console to reduce noise in tests
// Console mocking will be done in individual test files

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '7899'; // Different port for testing
process.env.CLICKUP_CLIENT_ID = 'test_client_id';
process.env.CLICKUP_CLIENT_SECRET = 'test_client_secret';

// Mock ClickUp API responses
global.mockClickUpResponses = {
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
};

// Clean up after tests
afterEach(() => {
    // Individual test files will handle mock cleanup
});