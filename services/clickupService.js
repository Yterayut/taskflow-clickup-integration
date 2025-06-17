const axios = require('axios');
const crypto = require('crypto');

class ClickUpService {
    constructor() {
        this.baseURL = process.env.CLICKUP_API_BASE || 'https://api.clickup.com/api/v2';
        this.clientId = process.env.CLICKUP_CLIENT_ID;
        this.clientSecret = process.env.CLICKUP_CLIENT_SECRET;
        this.redirectUri = process.env.CLICKUP_REDIRECT_URI || 'http://192.168.20.10:777/api/v1/auth/clickup/callback';
        
        // Create axios instance with default config
        this.api = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        // Add response interceptor for error handling
        this.api.interceptors.response.use(
            response => response,
            error => {
                console.error('ClickUp API Error:', error.response?.data || error.message);
                throw error;
            }
        );
    }

    // OAuth2 Methods
    getAuthorizationUrl(state = null) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri
        });
        
        if (state) {
            params.append('state', state);
        }
        
        return `https://app.clickup.com/api?${params.toString()}`;
    }

    async getAccessToken(code) {
        try {
            const response = await axios.post('https://api.clickup.com/api/v2/oauth/token', {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code
            });
            
            return response.data;
        } catch (error) {
            console.error('Error getting access token:', error.response?.data || error.message);
            throw new Error('Failed to get access token from ClickUp');
        }
    }

    // Set access token for authenticated requests
    setAccessToken(token) {
        this.api.defaults.headers['Authorization'] = token;
    }

    // User and Team Methods
    async getCurrentUser() {
        try {
            const response = await this.api.get('/user');
            return response.data;
        } catch (error) {
            throw new Error('Failed to get current user from ClickUp');
        }
    }

    async getAuthorizedTeams() {
        try {
            const response = await this.api.get('/team');
            return response.data;
        } catch (error) {
            throw new Error('Failed to get authorized teams from ClickUp');
        }
    }

    async getTeamMembers(teamId) {
        try {
            const response = await this.api.get(`/team/${teamId}/member`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get team members for team ${teamId}`);
        }
    }

    // Task Methods
    async getTeamTasks(teamId, options = {}) {
        try {
            const params = new URLSearchParams();
            
            // Add optional parameters
            if (options.archived !== undefined) params.append('archived', options.archived);
            if (options.page !== undefined) params.append('page', options.page);
            if (options.order_by !== undefined) params.append('order_by', options.order_by);
            if (options.reverse !== undefined) params.append('reverse', options.reverse);
            if (options.subtasks !== undefined) params.append('subtasks', options.subtasks);
            if (options.statuses) params.append('statuses', options.statuses.join(','));
            if (options.include_closed !== undefined) params.append('include_closed', options.include_closed);
            if (options.assignees) params.append('assignees', options.assignees.join(','));
            if (options.due_date_gt !== undefined) params.append('due_date_gt', options.due_date_gt);
            if (options.due_date_lt !== undefined) params.append('due_date_lt', options.due_date_lt);
            if (options.date_created_gt !== undefined) params.append('date_created_gt', options.date_created_gt);
            if (options.date_created_lt !== undefined) params.append('date_created_lt', options.date_created_lt);
            
            const url = `/team/${teamId}/task${params.toString() ? `?${params.toString()}` : ''}`;
            const response = await this.api.get(url);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get tasks for team ${teamId}`);
        }
    }

    async getTask(taskId) {
        try {
            const response = await this.api.get(`/task/${taskId}`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get task ${taskId}`);
        }
    }

    async updateTask(taskId, updates) {
        try {
            const response = await this.api.put(`/task/${taskId}`, updates);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to update task ${taskId}`);
        }
    }

    // Workspace Methods
    async getSpaces(teamId) {
        try {
            const response = await this.api.get(`/team/${teamId}/space`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get spaces for team ${teamId}`);
        }
    }

    async getFolders(spaceId) {
        try {
            const response = await this.api.get(`/space/${spaceId}/folder`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get folders for space ${spaceId}`);
        }
    }

    async getLists(folderId) {
        try {
            const response = await this.api.get(`/folder/${folderId}/list`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get lists for folder ${folderId}`);
        }
    }

    // Data Transformation Methods
    transformTaskData(clickupTask) {
        return {
            id: clickupTask.id,
            title: clickupTask.name,
            description: clickupTask.description || '',
            priority: this.mapPriority(clickupTask.priority),
            status: this.mapStatus(clickupTask.status),
            assignee: clickupTask.assignees?.[0]?.username || 'Unassigned',
            assignee_id: clickupTask.assignees?.[0]?.id,
            created_at: new Date(parseInt(clickupTask.date_created)),
            updated_at: new Date(parseInt(clickupTask.date_updated)),
            due_date: clickupTask.due_date ? new Date(parseInt(clickupTask.due_date)) : null,
            time_estimate: clickupTask.time_estimate ? parseInt(clickupTask.time_estimate) : null,
            time_spent: clickupTask.time_spent ? parseInt(clickupTask.time_spent) : null,
            url: clickupTask.url,
            list_id: clickupTask.list?.id,
            folder_id: clickupTask.folder?.id,
            space_id: clickupTask.space?.id,
            team_id: clickupTask.team_id
        };
    }

    transformUserData(clickupUser, taskCount = 0) {
        return {
            id: clickupUser.id,
            name: clickupUser.username,
            email: clickupUser.email,
            role: clickupUser.role?.name || 'Team Member',
            avatar: clickupUser.initials || clickupUser.username.substring(0, 2).toUpperCase(),
            status: this.mapUserStatus(clickupUser),
            current_tasks: taskCount,
            max_tasks: 8, // Default, can be configured
            workload_percentage: Math.round((taskCount / 8) * 100),
            profile_picture: clickupUser.profilePicture,
            color: clickupUser.color,
            timezone: clickupUser.timezone
        };
    }

    // Helper Methods
    mapPriority(clickupPriority) {
        if (!clickupPriority) return 'medium';
        
        const priorityMap = {
            '1': 'critical',
            '2': 'high', 
            '3': 'medium',
            '4': 'low'
        };
        
        return priorityMap[clickupPriority.priority] || 'medium';
    }

    mapStatus(clickupStatus) {
        if (!clickupStatus) return 'pending';
        
        const status = clickupStatus.status?.toLowerCase() || '';
        
        if (status.includes('complete') || status.includes('done') || status.includes('closed')) {
            return 'completed';
        } else if (status.includes('progress') || status.includes('doing') || status.includes('active')) {
            return 'in_progress';
        } else if (status.includes('review') || status.includes('testing')) {
            return 'review';
        } else {
            return 'pending';
        }
    }

    mapUserStatus(clickupUser) {
        // Since ClickUp doesn't provide real-time status, we'll use a default
        // This could be enhanced with custom fields or integrations
        return 'available';
    }

    // Rate limiting helper
    async withRateLimit(fn) {
        const maxRetries = 3;
        let retries = 0;
        
        while (retries < maxRetries) {
            try {
                return await fn();
            } catch (error) {
                if (error.response?.status === 429 && retries < maxRetries - 1) {
                    const retryAfter = error.response.headers['retry-after'] || 60;
                    console.log(`Rate limited, retrying after ${retryAfter} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    retries++;
                } else {
                    throw error;
                }
            }
        }
    }
}

module.exports = ClickUpService;