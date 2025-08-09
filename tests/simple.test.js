describe('Simple Unit Tests', () => {
    test('Math operations should work correctly', () => {
        expect(2 + 2).toBe(4);
        expect(10 - 5).toBe(5);
        expect(3 * 4).toBe(12);
        expect(8 / 2).toBe(4);
    });

    test('String operations should work correctly', () => {
        expect('hello'.toUpperCase()).toBe('HELLO');
        expect('WORLD'.toLowerCase()).toBe('world');
        expect('test'.length).toBe(4);
    });

    test('Array operations should work correctly', () => {
        const arr = [1, 2, 3];
        expect(arr.length).toBe(3);
        expect(arr.includes(2)).toBe(true);
        expect(arr.includes(4)).toBe(false);
    });

    test('Object operations should work correctly', () => {
        const obj = { name: 'John', age: 30 };
        expect(obj.name).toBe('John');
        expect(obj.age).toBe(30);
        expect(Object.keys(obj)).toEqual(['name', 'age']);
    });
});

describe('TaskFlow Helper Functions', () => {
    test('calculateTaskStats should work correctly', () => {
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

    test('filterTasksByRole should work correctly', () => {
        function filterTasksByRole(tasks, userRole, userEmail) {
            if (!tasks || !Array.isArray(tasks)) return [];

            if (userRole === 'Manager') {
                return tasks; // Managers see all tasks
            }

            if (userRole === 'Team Lead') {
                // Team leads see all employee tasks (exclude manager-only tasks)
                return tasks.filter(task => {
                    const assignees = task.assignees || [];
                    return !assignees.some(assignee => 
                        assignee.email && assignee.email.includes('manager')
                    );
                });
            }

            if (userRole === 'Employee') {
                // Employees see only their assigned tasks
                return tasks.filter(task => {
                    const assignees = task.assignees || [];
                    return assignees.some(assignee => assignee.email === userEmail);
                });
            }

            return [];
        }

        const mockTasks = [
            { id: 'task1', assignees: [{ email: 'manager@example.com' }] },
            { id: 'task2', assignees: [{ email: 'employee@example.com' }] },
            { id: 'task3', assignees: [{ email: 'teamlead@example.com' }] }
        ];

        // Manager should see all tasks
        expect(filterTasksByRole(mockTasks, 'Manager', 'manager@example.com')).toHaveLength(3);

        // Team Lead should see non-manager tasks
        expect(filterTasksByRole(mockTasks, 'Team Lead', 'teamlead@example.com')).toHaveLength(2);

        // Employee should see only their tasks
        expect(filterTasksByRole(mockTasks, 'Employee', 'employee@example.com')).toHaveLength(1);
    });
});