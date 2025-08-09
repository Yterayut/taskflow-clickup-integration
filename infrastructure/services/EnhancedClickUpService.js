/**
 * Enhanced ClickUp Service with Smart Sync Support
 */
class EnhancedClickUpService {
    constructor(baseUrl = 'https://api.clickup.com/api/v2') {
        this.baseUrl = baseUrl;
    }

    /**
     * Get high priority data (tasks, status, assignees)
     */
    async getHighPriorityData(accessToken) {
        console.log('🔄 Fetching high priority data from ClickUp...');
        
        try {
            // Get recent task updates (last 4 hours)
            const recentTasks = await this.getRecentTasks(accessToken, 4);
            
            return {
                tasks: recentTasks,
                timestamp: new Date().toISOString(),
                dataType: 'high_priority'
            };
        } catch (error) {
            console.error('❌ Failed to fetch high priority data:', error);
            throw error;
        }
    }

    /**
     * Get medium priority data (projects, lists, team members)
     */
    async getMediumPriorityData(accessToken) {
        console.log('🔄 Fetching medium priority data from ClickUp...');
        
        try {
            // Get spaces and lists structure
            const spaces = await this.getSpaces(accessToken);
            const teamMembers = await this.getTeamMembers(accessToken);
            
            return {
                spaces: spaces,
                teamMembers: teamMembers,
                timestamp: new Date().toISOString(),
                dataType: 'medium_priority'
            };
        } catch (error) {
            console.error('❌ Failed to fetch medium priority data:', error);
            throw error;
        }
    }

    /**
     * Get low priority data (archived data, historical metrics)
     */
    async getLowPriorityData(accessToken) {
        console.log('🔄 Fetching low priority data from ClickUp...');
        
        try {
            // Get archived tasks and historical data
            const archivedData = await this.getArchivedData(accessToken);
            
            return {
                archived: archivedData,
                timestamp: new Date().toISOString(),
                dataType: 'low_priority'
            };
        } catch (error) {
            console.error('❌ Failed to fetch low priority data:', error);
            throw error;
        }
    }

    /**
     * Get recent tasks (modified within specified hours)
     */
    async getRecentTasks(accessToken, hoursBack = 4) {
        const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
        
        // Mock implementation - in production, this would call ClickUp API with date filters
        return [
            {
                id: 'task_' + Date.now(),
                name: 'High Priority Task Update',
                status: { status: 'in progress' },
                assignees: [{ id: 'user_1', name: 'Team Member' }],
                due_date: new Date().toISOString(),
                last_updated: new Date().toISOString()
            }
        ];
    }

    /**
     * Get spaces and projects structure
     */
    async getSpaces(accessToken) {
        // Mock implementation
        return [
            {
                id: 'space_1',
                name: 'Development Projects',
                lists: [
                    { id: 'list_1', name: 'Sprint Backlog' },
                    { id: 'list_2', name: 'In Progress' }
                ]
            }
        ];
    }

    /**
     * Get team members
     */
    async getTeamMembers(accessToken) {
        // Mock implementation
        return [
            {
                id: 'user_1',
                username: 'developer1',
                email: 'dev1@example.com',
                role: 'developer'
            }
        ];
    }

    /**
     * Get archived data
     */
    async getArchivedData(accessToken) {
        // Mock implementation
        return [
            {
                id: 'archived_1',
                type: 'completed_project',
                archived_date: new Date().toISOString()
            }
        ];
    }

    /**
     * Comprehensive data fetch (for full sync)
     */
    async getComprehensiveData(accessToken) {
        console.log('🔄 Fetching comprehensive data from ClickUp...');
        
        const [highPriority, mediumPriority, lowPriority] = await Promise.all([
            this.getHighPriorityData(accessToken),
            this.getMediumPriorityData(accessToken),
            this.getLowPriorityData(accessToken)
        ]);

        return {
            tasks: highPriority.tasks,
            spaces: mediumPriority.spaces,
            teamMembers: mediumPriority.teamMembers,
            archived: lowPriority.archived,
            timestamp: new Date().toISOString(),
            dataType: 'comprehensive'
        };
    }

    /**
     * Dashboard data fetch (for compatibility)
     */
    async getDashboardData() {
        console.log('🔄 Fetching dashboard data from ClickUp...');
        
        const [tasks, spaces, teamMembers] = await Promise.all([
            this.getHighPriorityData('mock_token'),
            this.getMediumPriorityData('mock_token'),
            this.getMediumPriorityData('mock_token')
        ]);

        return {
            tasks: tasks.tasks || [],
            spaces: spaces.spaces || [],
            teamMembers: teamMembers.teamMembers || [],
            timestamp: new Date().toISOString(),
            dataType: 'dashboard'
        };
    }

    /**
     * Task data fetch (for compatibility)
     */
    async getTaskData(filters = {}) {
        console.log('🔄 Fetching task data with filters:', filters);
        
        const taskData = await this.getHighPriorityData('mock_token');
        return taskData.tasks || [];
    }

    /**
     * Team data fetch (for compatibility)
     */
    async getTeamData() {
        console.log('🔄 Fetching team data from ClickUp...');
        
        const teamData = await this.getMediumPriorityData('mock_token');
        return {
            members: teamData.teamMembers || [],
            spaces: teamData.spaces || [],
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = { EnhancedClickUpService };
