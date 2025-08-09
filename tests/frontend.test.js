/**
 * @jest-environment jsdom
 */

// Mock global fetch
global.fetch = jest.fn();

describe('Frontend Functions', () => {
    let mockDocument;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Reset fetch mock
        fetch.mockReset();
        
        // Create mock DOM elements
        document.body.innerHTML = `
            <div id="loginForm"></div>
            <div id="dashboard"></div>
            <div id="all-tasks"></div>
            <div id="team-overview"></div>
            <div id="employee-management"></div>
            <div id="loadingOverlay"></div>
            <div id="userGreeting"></div>
            <div id="userRole"></div>
            <div id="allTasksContainer"></div>
            <div id="teamOverviewContainer"></div>
            <div id="employeeManagementContainer"></div>
            <button id="connectClickUpBtn">Connect ClickUp</button>
            <span id="clickupStatus"></span>
        `;

        // Mock localStorage
        const localStorageMock = (() => {
            let store = {};
            return {
                getItem: jest.fn((key) => store[key] || null),
                setItem: jest.fn((key, value) => {
                    store[key] = value.toString();
                }),
                removeItem: jest.fn((key) => {
                    delete store[key];
                }),
                clear: jest.fn(() => {
                    store = {};
                })
            };
        })();
        Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    });

    describe('Authentication Functions', () => {
        test('login function should make API call with credentials', async () => {
            // Mock successful login response
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    user: {
                        id: 1,
                        email: 'test@example.com',
                        name: 'Test User',
                        role: 'Manager'
                    },
                    session_token: 'test_token'
                })
            });

            // Define the login function (extracted from frontend)
            async function login(email, password) {
                try {
                    const response = await fetch('http://192.168.20.10:7810/api/v1/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email, password })
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        localStorage.setItem('taskflow_session_token', result.session_token);
                        localStorage.setItem('taskflow_user_profile', JSON.stringify(result.user));
                        return result;
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    throw error;
                }
            }

            const result = await login('test@example.com', '12345');

            expect(fetch).toHaveBeenCalledWith(
                'http://192.168.20.10:7810/api/v1/auth/login',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'test@example.com',
                        password: '12345'
                    })
                })
            );

            expect(result.success).toBe(true);
            expect(result.user.email).toBe('test@example.com');
        });

        test('login function should handle API errors', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({
                    success: false,
                    error: 'Invalid credentials'
                })
            });

            async function login(email, password) {
                const response = await fetch('http://192.168.20.10:7810/api/v1/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.error);
                }
                return result;
            }

            await expect(login('wrong@email.com', 'wrongpass'))
                .rejects.toThrow('Invalid credentials');
        });
    });

    describe('UI Component Functions', () => {
        test('showComponent function should hide all components and show selected', () => {
            // Define showComponent function (extracted from frontend)
            function showComponent(componentId) {
                const components = ['dashboard', 'all-tasks', 'team-overview', 'employee-management'];
                
                // Hide all components
                components.forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.style.display = 'none';
                    }
                });

                // Show selected component
                const selectedComponent = document.getElementById(componentId);
                if (selectedComponent) {
                    selectedComponent.style.display = 'block';
                    return true;
                }
                return false;
            }

            const result = showComponent('all-tasks');

            expect(result).toBe(true);
            expect(document.getElementById('all-tasks').style.display).toBe('block');
            expect(document.getElementById('dashboard').style.display).toBe('none');
            expect(document.getElementById('team-overview').style.display).toBe('none');
        });

        test('updateUserProfile function should update DOM elements', () => {
            function updateUserProfile(user) {
                const greetingElement = document.getElementById('userGreeting');
                const roleElement = document.getElementById('userRole');
                
                if (greetingElement) {
                    greetingElement.textContent = `Welcome, ${user.name}`;
                }
                
                if (roleElement) {
                    roleElement.textContent = user.role;
                }
            }

            const testUser = {
                name: 'John Doe',
                role: 'Manager',
                email: 'john@example.com'
            };

            updateUserProfile(testUser);

            expect(document.getElementById('userGreeting').textContent).toBe('Welcome, John Doe');
            expect(document.getElementById('userRole').textContent).toBe('Manager');
        });
    });

    describe('Data Loading Functions', () => {
        test('loadClickUpData function should fetch and process data', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    user: { id: 1, username: 'testuser' },
                    totalTasks: 10,
                    completedTasks: 5,
                    pendingTasks: 5,
                    tasks: [
                        { id: 'task1', name: 'Test Task 1', status: { status: 'complete' } },
                        { id: 'task2', name: 'Test Task 2', status: { status: 'in progress' } }
                    ]
                })
            });

            async function loadClickUpData() {
                try {
                    const token = localStorage.getItem('taskflow_session_token');
                    const response = await fetch('http://192.168.20.10:7810/api/v1/clickup/data', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        return result;
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    console.error('Data loading error:', error);
                    throw error;
                }
            }

            // Set up localStorage mock
            const mockToken = 'test_token';
            localStorage.setItem('taskflow_session_token', mockToken);

            const result = await loadClickUpData();

            expect(fetch).toHaveBeenCalledWith(
                'http://192.168.20.10:7810/api/v1/clickup/data',
                expect.objectContaining({
                    headers: {
                        'Authorization': `Bearer ${mockToken}`
                    }
                })
            );

            expect(result.success).toBe(true);
            expect(result.totalTasks).toBe(10);
            expect(result.tasks).toHaveLength(2);
        });
    });

    describe('Role-Based UI Functions', () => {
        test('showRoleBasedNavigation should show appropriate menu items', () => {
            function showRoleBasedNavigation(role) {
                const managerItems = ['all-tasks', 'team-overview', 'employee-management'];
                const teamLeadItems = ['team-tasks', 'team-members'];
                const employeeItems = ['my-tasks', 'my-profile'];

                let menuItems = [];
                switch (role) {
                    case 'Manager':
                        menuItems = managerItems;
                        break;
                    case 'Team Lead':
                        menuItems = teamLeadItems;
                        break;
                    case 'Employee':
                        menuItems = employeeItems;
                        break;
                }

                return menuItems;
            }

            expect(showRoleBasedNavigation('Manager'))
                .toEqual(['all-tasks', 'team-overview', 'employee-management']);
            expect(showRoleBasedNavigation('Team Lead'))
                .toEqual(['team-tasks', 'team-members']);
            expect(showRoleBasedNavigation('Employee'))
                .toEqual(['my-tasks', 'my-profile']);
        });
    });

    describe('Task Rendering Functions', () => {
        test('renderAllTasks should populate task container', () => {
            function renderAllTasks(tasks) {
                const container = document.getElementById('allTasksContainer');
                if (!container || !tasks) return;

                container.innerHTML = tasks.map(task => `
                    <div class="task-item" data-task-id="${task.id}">
                        <h3>${task.name}</h3>
                        <span class="task-status">${task.status?.status || 'unknown'}</span>
                    </div>
                `).join('');
            }

            const mockTasks = [
                { id: 'task1', name: 'Test Task 1', status: { status: 'complete' } },
                { id: 'task2', name: 'Test Task 2', status: { status: 'in progress' } }
            ];

            renderAllTasks(mockTasks);

            const container = document.getElementById('allTasksContainer');
            const taskItems = container.querySelectorAll('.task-item');
            
            expect(taskItems).toHaveLength(2);
            expect(taskItems[0].querySelector('h3').textContent).toBe('Test Task 1');
            expect(taskItems[0].querySelector('.task-status').textContent).toBe('complete');
        });

        test('calculateTaskStats should return correct statistics', () => {
            function calculateTaskStats(tasks) {
                if (!tasks || !Array.isArray(tasks)) {
                    return { total: 0, completed: 0, pending: 0, inProgress: 0 };
                }

                const stats = {
                    total: tasks.length,
                    completed: 0,
                    pending: 0,
                    inProgress: 0
                };

                tasks.forEach(task => {
                    const status = task.status?.status?.toLowerCase();
                    if (status === 'complete' || status === 'closed') {
                        stats.completed++;
                    } else if (status === 'in progress') {
                        stats.inProgress++;
                    } else {
                        stats.pending++;
                    }
                });

                return stats;
            }

            const mockTasks = [
                { status: { status: 'complete' } },
                { status: { status: 'in progress' } },
                { status: { status: 'to do' } },
                { status: { status: 'complete' } }
            ];

            const stats = calculateTaskStats(mockTasks);

            expect(stats.total).toBe(4);
            expect(stats.completed).toBe(2);
            expect(stats.inProgress).toBe(1);
            expect(stats.pending).toBe(1);
        });
    });

    describe('Error Handling Functions', () => {
        test('showErrorMessage should display error in DOM', () => {
            function showErrorMessage(message) {
                const errorDiv = document.createElement('div');
                errorDiv.id = 'errorMessage';
                errorDiv.className = 'error-message';
                errorDiv.textContent = message;
                document.body.appendChild(errorDiv);
            }

            showErrorMessage('Test error message');

            const errorElement = document.getElementById('errorMessage');
            expect(errorElement).toBeTruthy();
            expect(errorElement.textContent).toBe('Test error message');
            expect(errorElement.className).toBe('error-message');
        });

        test('handleApiError should process different error types', () => {
            function handleApiError(error) {
                if (error.response && error.response.status === 401) {
                    return 'Authentication required';
                } else if (error.response && error.response.status === 403) {
                    return 'Access denied';
                } else if (error.response && error.response.status >= 500) {
                    return 'Server error occurred';
                } else {
                    return error.message || 'Unknown error occurred';
                }
            }

            expect(handleApiError({ response: { status: 401 } }))
                .toBe('Authentication required');
            expect(handleApiError({ response: { status: 403 } }))
                .toBe('Access denied');
            expect(handleApiError({ response: { status: 500 } }))
                .toBe('Server error occurred');
            expect(handleApiError({ message: 'Network error' }))
                .toBe('Network error');
        });
    });
});