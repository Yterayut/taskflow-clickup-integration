/**
 * ClickUp OAuth Integration Adapter
 * Handles ClickUp OAuth flow and API communication
 */
const axios = require('axios');
const crypto = require('crypto');

class ClickUpOAuthAdapter {
    constructor() {
        this.clientId = process.env.CLICKUP_CLIENT_ID;
        this.clientSecret = process.env.CLICKUP_CLIENT_SECRET;
        this.redirectUri = process.env.CLICKUP_REDIRECT_URI;
        this.scope = process.env.CLICKUP_SCOPE || 'read';
        this.authBaseUrl = 'https://app.clickup.com/api';  // For authorization only
        this.tokenUrl = 'https://api.clickup.com/api/v2/oauth/token';  // For token exchange
        this.apiBaseUrl = 'https://api.clickup.com/api/v2';
        
        // Validate configuration
        this.validateConfiguration();
    }
    
    /**
     * Validate OAuth configuration
     */
    validateConfiguration() {
        const required = ['CLICKUP_CLIENT_ID', 'CLICKUP_CLIENT_SECRET', 'CLICKUP_REDIRECT_URI'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required ClickUp OAuth configuration: ${missing.join(', ')}`);
        }
    }
    
    /**
     * Generate authorization URL for OAuth flow
     */
    getAuthorizationUrl(providedState = null) {
        const state = providedState || this.generateState();
        
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: this.scope,
            state: state
        });
        
        // Store state for validation (in production, use session or database)
        this.lastGeneratedState = state;
        
        return `${this.authBaseUrl}?${params.toString()}`;
    }
    
    /**
     * Generate secure state parameter for CSRF protection
     */
    generateState() {
        return 'taskflow_' + Date.now() + '_' + crypto.randomBytes(16).toString('hex');
    }
    
    /**
     * Validate OAuth state parameter
     */
    validateState(state) {
        // In production, validate against session or database
        // For now, basic validation
        if (!state || !state.startsWith('taskflow_')) {
            return false;
        }
        
        // Check if state is not too old (prevent replay attacks)
        const stateParts = state.split('_');
        if (stateParts.length < 3) {
            return false;
        }
        
        const timestamp = parseInt(stateParts[1]);
        const maxAge = 10 * 60 * 1000; // 10 minutes
        
        return (Date.now() - timestamp) < maxAge;
    }
    
    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForTokens(code) {
        try {
            console.log('🔄 ClickUp token exchange request:', {
                url: this.tokenUrl,
                payload: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret ? '***' : 'MISSING',
                    code: code ? `${code.substring(0, 10)}...` : 'MISSING',
                    redirect_uri: this.redirectUri
                }
            });

            // ClickUp expects form data, not JSON
            const params = new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code,
                redirect_uri: this.redirectUri
            });

            const response = await axios.post(this.tokenUrl, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000 // 10 second timeout
            });
            
            console.log('✅ ClickUp token response:', {
                status: response.status,
                data: response.data,
                headers: response.headers
            });
            
            if (!response.data.access_token) {
                console.error('❌ ClickUp response missing access_token:', response.data);
                throw new Error('No access token received from ClickUp');
            }
            
            return {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                expires_in: response.data.expires_in || 3600, // Default 1 hour if not provided
                token_type: response.data.token_type || 'Bearer',
                scope: response.data.scope || this.scope
            };
        } catch (error) {
            console.error('ClickUp token exchange error:', error.response?.data || error.message);
            
            // Handle specific OAuth errors with better messages
            if (error.response?.data?.ECODE === 'OAUTH_014') {
                throw new Error('OAuth code already used - please start OAuth flow again');
            }
            if (error.response?.data?.ECODE === 'OAUTH_013') {
                throw new Error('OAuth code not found or expired - please start OAuth flow again');
            }
            
            throw new Error(`Failed to exchange code for tokens: ${error.response?.data?.error || error.message}`);
        }
    }
    
    /**
     * Refresh access token using refresh token
     */
    async refreshToken(refreshToken) {
        try {
            // ClickUp expects form data for refresh token too
            const params = new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            });

            const response = await axios.post(this.tokenUrl, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000
            });
            
            if (!response.data.access_token) {
                throw new Error('No access token received from refresh');
            }
            
            return {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token || refreshToken, // Some APIs don't return new refresh token
                expires_in: response.data.expires_in || 3600,
                token_type: response.data.token_type || 'Bearer',
                scope: response.data.scope || this.scope
            };
        } catch (error) {
            console.error('ClickUp token refresh error:', error.response?.data || error.message);
            throw new Error(`Failed to refresh token: ${error.response?.data?.error || error.message}`);
        }
    }
    
    /**
     * Refresh access token using refresh token (for BackgroundAuthService)
     */
    async refreshAccessToken(refreshToken) {
        try {
            console.log('🔄 Background token refresh initiated...');
            
            const result = await this.refreshToken(refreshToken);
            
            console.log('✅ Background token refresh successful');
            return result;
            
        } catch (error) {
            console.error('❌ Background token refresh failed:', error.message);
            throw error;
        }
    }

    /**
     * Perform automatic OAuth authentication (for BackgroundAuthService)
     * Note: This would typically require stored credentials or other automation
     */
    async performAutomaticAuth(credentials) {
        try {
            console.log('🔄 Attempting automatic OAuth authentication...');
            
            // For ClickUp, automatic re-auth typically uses refresh tokens
            // If no refresh token available, this would require manual intervention
            if (credentials.oauthRefreshToken) {
                const result = await this.refreshAccessToken(credentials.oauthRefreshToken);
                
                console.log('✅ Automatic authentication successful using refresh token');
                return result;
            }
            
            // If no refresh token, we cannot perform automatic auth without user interaction
            throw new Error('Automatic authentication requires refresh token - manual intervention needed');
            
        } catch (error) {
            console.error('❌ Automatic authentication failed:', error.message);
            throw error;
        }
    }

    /**
     * Validate token with ClickUp API
     */
    async validateToken(accessToken) {
        try {
            const userInfo = await this.getUserInfo(accessToken);
            
            return {
                isValid: true,
                user: userInfo,
                validatedAt: new Date()
            };
            
        } catch (error) {
            console.error('❌ Token validation failed:', error.message);
            
            if (error.response?.status === 401) {
                return {
                    isValid: false,
                    reason: 'unauthorized',
                    error: error.message
                };
            }
            
            return {
                isValid: false,
                reason: 'network_error',
                error: error.message
            };
        }
    }

    /**
     * Get user information from ClickUp API
     */
    async getUserInfo(accessToken) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/user`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            return response.data.user;
        } catch (error) {
            console.error('ClickUp user info error:', error.response?.data || error.message);
            throw new Error(`Failed to get user info: ${error.response?.data?.error || error.message}`);
        }
    }
    
    /**
     * Validate that the authenticated user is the master user
     */
    validateMasterUser(userInfo) {
        if (!userInfo || !userInfo.email) {
            return false;
        }
        
        const masterEmail = process.env.MASTER_USER_EMAIL?.toLowerCase();
        const userEmail = userInfo.email.toLowerCase();
        
        return userEmail === masterEmail;
    }
    
    /**
     * Test API connection with given token
     */
    async testConnection(accessToken) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/user`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            
            return {
                success: true,
                user: response.data.user
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }
    
    /**
     * Revoke access token
     */
    async revokeToken(accessToken) {
        try {
            // ClickUp doesn't have a standard revoke endpoint
            // This is a placeholder for future implementation
            console.log('Token revocation requested for ClickUp token');
            return { success: true, message: 'Token marked for revocation' };
        } catch (error) {
            console.error('Token revocation error:', error);
            throw new Error(`Failed to revoke token: ${error.message}`);
        }
    }
    
    /**
     * Get ClickUp teams/workspaces
     */
    async getTeams(accessToken) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/team`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            return response.data.teams;
        } catch (error) {
            console.error('ClickUp teams error:', error.response?.data || error.message);
            throw new Error(`Failed to get teams: ${error.response?.data?.error || error.message}`);
        }
    }
    
    /**
     * Get ClickUp spaces for a team
     */
    async getSpaces(accessToken, teamId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/team/${teamId}/space`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            return response.data.spaces;
        } catch (error) {
            console.error('ClickUp spaces error:', error.response?.data || error.message);
            throw new Error(`Failed to get spaces: ${error.response?.data?.error || error.message}`);
        }
    }
    
    /**
     * Get ClickUp lists for a space (including folderless)
     */
    async getLists(accessToken, spaceId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/space/${spaceId}/list`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            return response.data.lists;
        } catch (error) {
            console.error('ClickUp lists error:', error.response?.data || error.message);
            throw new Error(`Failed to get lists: ${error.response?.data?.error || error.message}`);
        }
    }
    
    /**
     * Get ClickUp folders for a space
     */
    async getFolders(accessToken, spaceId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/space/${spaceId}/folder`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            return response.data.folders || [];
        } catch (error) {
            console.warn(`⚠️ Failed to get folders for space ${spaceId}:`, error.message);
            return [];
        }
    }
    
    /**
     * Get ClickUp lists for a folder
     */
    async getListsInFolder(accessToken, folderId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/folder/${folderId}/list`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            return response.data.lists || [];
        } catch (error) {
            console.warn(`⚠️ Failed to get lists for folder ${folderId}:`, error.message);
            return [];
        }
    }
    
    /**
     * Get folderless lists for a space
     */
    async getFolderlessLists(accessToken, spaceId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/space/${spaceId}/list?archived=false`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            // Filter only folderless lists (lists without folder)
            const allLists = response.data.lists || [];
            return allLists.filter(list => !list.folder || list.folder.hidden);
        } catch (error) {
            console.warn(`⚠️ Failed to get folderless lists for space ${spaceId}:`, error.message);
            return [];
        }
    }
    
    /**
     * Get ClickUp tasks for a list with pagination support
     */
    async getTasks(accessToken, listId) {
        try {
            let allTasks = [];
            let page = 0;
            const limit = 100; // Max per ClickUp API
            
            while (true) {
                const response = await axios.get(`${this.apiBaseUrl}/list/${listId}/task`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        page: page,
                        limit: limit,
                        archived: false,
                        include_closed: true, // Include completed tasks
                        subtasks: true,      // Include subtasks
                        include_markdown_description: false
                    },
                    timeout: 15000
                });
                
                const tasks = response.data.tasks || [];
                allTasks.push(...tasks);
                
                console.log(`📋 Page ${page}: Found ${tasks.length} tasks for list ${listId}`);
                
                // Break if we got less than the limit (last page)
                if (tasks.length < limit) {
                    break;
                }
                
                page++;
                
                // Safety limit to prevent infinite loops
                if (page > 50) {
                    console.warn(`⚠️ Hit safety limit (50 pages) for list ${listId}`);
                    break;
                }
            }
            
            console.log(`✅ Total tasks retrieved for list ${listId}: ${allTasks.length}`);
            return allTasks;
        } catch (error) {
            console.error('ClickUp tasks error:', error.response?.data || error.message);
            throw new Error(`Failed to get tasks: ${error.response?.data?.error || error.message}`);
        }
    }
    
    /**
     * Get tasks from multiple lists efficiently
     */
    async getTasksFromLists(accessToken, lists) {
        const allTasks = [];
        
        for (const list of lists) {
            try {
                const tasks = await this.getTasks(accessToken, list.id);
                
                // Add list context to each task
                const tasksWithContext = tasks.map(task => ({
                    ...task,
                    list_name: list.name,
                    list_id: list.id
                }));
                
                allTasks.push(...tasksWithContext);
                
                // Add small delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.warn(`⚠️ Failed to get tasks for list ${list.name}:`, error.message);
            }
        }
        
        return allTasks;
    }
    
    /**
     * Get ClickUp subtasks for a task
     */
    async getSubtasks(accessToken, taskId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/task/${taskId}/subtask`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            return response.data.subtasks || [];
        } catch (error) {
            // Subtasks may not exist or endpoint may not be accessible
            console.warn(`⚠️ Failed to get subtasks for task ${taskId}:`, error.message);
            return [];
        }
    }
    
    /**
     * Get comprehensive ClickUp data for dashboard
     */
    async getComprehensiveData(accessToken) {
        try {
            console.log('🔄 Fetching comprehensive ClickUp data...');
            
            // Get teams first
            const teams = await this.getTeams(accessToken);
            console.log(`📊 Found ${teams.length} teams`);
            
            let allTasks = [];
            let allMembers = new Map();
            let spaces = [];
            
            // Process each team
            for (const team of teams) {
                console.log(`🏢 Processing team: ${team.name}`);
                
                // Add team members to master list
                if (team.members) {
                    team.members.forEach(member => {
                        if (member.user) {
                            allMembers.set(member.user.id, {
                                id: member.user.id,
                                name: member.user.username,
                                email: member.user.email,
                                role: member.user.role_key || 'member',
                                tasks: {
                                    completed: 0,
                                    in_progress: 0,
                                    overdue: 0,
                                    total: 0
                                }
                            });
                        }
                    });
                }
                
                try {
                    // Get spaces for this team
                    const teamSpaces = await this.getSpaces(accessToken, team.id);
                    spaces.push(...teamSpaces);
                    console.log(`📁 Found ${teamSpaces.length} spaces for team ${team.name}`);
                    
                    // Process each space
                    for (const space of teamSpaces) {
                        try {
                            // Get both folderless lists and folders
                            const folderlessLists = await this.getFolderlessLists(accessToken, space.id);
                            const folders = await this.getFolders(accessToken, space.id);
                            
                            console.log(`📋 Found ${folderlessLists.length} folderless lists for space ${space.name}`);
                            console.log(`📁 Found ${folders.length} folders for space ${space.name}`);
                            
                            let allSpaceLists = [...folderlessLists];
                            
                            // Get lists from each folder
                            for (const folder of folders) {
                                try {
                                    const folderLists = await this.getListsInFolder(accessToken, folder.id);
                                    console.log(`📋 Found ${folderLists.length} lists in folder ${folder.name}`);
                                    allSpaceLists.push(...folderLists);
                                } catch (folderError) {
                                    console.warn(`⚠️ Failed to get lists for folder ${folder.name}:`, folderError.message);
                                }
                            }
                            
                            console.log(`📊 Total lists for space ${space.name}: ${allSpaceLists.length}`);
                            
                            // Use batch task fetching for efficiency
                            console.log(`🔄 Fetching tasks from ${allSpaceLists.length} lists...`);
                            const allSpaceTasks = await this.getTasksFromLists(accessToken, allSpaceLists);
                            console.log(`✅ Total tasks from all lists in space ${space.name}: ${allSpaceTasks.length}`);
                            
                            // Process each task
                            for (const task of allSpaceTasks) {
                                try {
                                    const enhancedTask = {
                                        ...task,
                                        team_name: team.name,
                                        space_name: space.name,
                                        is_subtask: false
                                    };
                                    allTasks.push(enhancedTask);
                                    
                                    // Update member task counts for main tasks
                                    if (task.assignees) {
                                        task.assignees.forEach(assignee => {
                                            const member = allMembers.get(assignee.id);
                                            if (member) {
                                                member.tasks.total++;
                                                
                                                // Categorize task status
                                                if (task.status && task.status.status === 'closed') {
                                                    member.tasks.completed++;
                                                } else if (task.due_date && new Date(task.due_date) < new Date()) {
                                                    member.tasks.overdue++;
                                                } else {
                                                    member.tasks.in_progress++;
                                                }
                                            }
                                        });
                                    }
                                } catch (taskError) {
                                    console.warn(`⚠️ Failed to process task ${task.name}:`, taskError.message);
                                }
                            }
                        } catch (listError) {
                            console.warn(`⚠️ Failed to get lists for space ${space.name}:`, listError.message);
                        }
                    }
                } catch (spaceError) {
                    console.warn(`⚠️ Failed to get spaces for team ${team.name}:`, spaceError.message);
                }
            }
            
            // Calculate workload statistics with better status detection
            const now = new Date();
            const workload = {
                completed: allTasks.filter(task => {
                    const status = task.status?.status?.toLowerCase() || '';
                    return status === 'closed' || status === 'complete' || status === 'done' || status === 'completed';
                }).length,
                in_progress: allTasks.filter(task => {
                    const status = task.status?.status?.toLowerCase() || '';
                    const isCompleted = status === 'closed' || status === 'complete' || status === 'done' || status === 'completed';
                    const dueDate = task.due_date ? new Date(parseInt(task.due_date)) : null;
                    const isOverdue = dueDate && dueDate < now;
                    return !isCompleted && !isOverdue;
                }).length,
                overdue: allTasks.filter(task => {
                    const status = task.status?.status?.toLowerCase() || '';
                    const isCompleted = status === 'closed' || status === 'complete' || status === 'done' || status === 'completed';
                    const dueDate = task.due_date ? new Date(parseInt(task.due_date)) : null;
                    return !isCompleted && dueDate && dueDate < now;
                }).length,
                total: allTasks.length
            };
            
            console.log('📊 Workload calculated:', {
                total: workload.total,
                completed: workload.completed,
                in_progress: workload.in_progress,
                overdue: workload.overdue,
                sample_statuses: allTasks.slice(0, 3).map(t => ({
                    name: t.name,
                    status: t.status?.status,
                    due_date: t.due_date ? new Date(parseInt(t.due_date)).toISOString() : null
                }))
            });
            
            // Generate recent activities from recent tasks
            const recentActivities = allTasks
                .filter(task => task.date_updated)
                .sort((a, b) => new Date(b.date_updated) - new Date(a.date_updated))
                .slice(0, 10)
                .map(task => ({
                    type: task.status && task.status.status === 'closed' ? 'task_completed' : 'task_updated',
                    user: task.assignees && task.assignees[0] ? task.assignees[0].username : 'Unknown',
                    description: `${task.name} (${task.list_name})`,
                    time: task.date_updated,
                    task_id: task.id
                }));
            
            console.log(`✅ Comprehensive data fetched: ${allTasks.length} tasks, ${allMembers.size} members, ${workload.total} total items`);
            
            return {
                teams,
                spaces,
                tasks: allTasks,
                workload,
                recent_activities: recentActivities,
                team_members: Array.from(allMembers.values())
            };
        } catch (error) {
            console.error('Comprehensive data fetch error:', error);
            throw new Error(`Failed to fetch comprehensive ClickUp data: ${error.message}`);
        }
    }
    
    /**
     * Health check for ClickUp API
     */
    async healthCheck() {
        try {
            // Test basic connectivity to ClickUp API
            const response = await axios.get(`${this.apiBaseUrl}/user`, {
                timeout: 5000,
                validateStatus: function (status) {
                    // Accept both 200 (valid token) and 401 (invalid token) as "healthy"
                    return status === 200 || status === 401;
                }
            });
            
            return {
                success: true,
                status: response.status,
                message: 'ClickUp API is accessible'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'ClickUp API is not accessible'
            };
        }
    }
}

module.exports = { ClickUpOAuthAdapter };