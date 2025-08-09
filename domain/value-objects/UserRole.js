/**
 * UserRole Value Object
 * Defines user roles and their capabilities
 */
class UserRole {
    static MASTER = 'master';
    static MANAGER = 'manager';
    static TEAM_LEAD = 'team_lead';
    static EMPLOYEE = 'employee';
    static USER = 'user'; // Legacy support
    
    constructor(value) {
        this.validateRole(value);
        this.value = value.toLowerCase();
    }
    
    /**
     * Validate role value
     */
    validateRole(role) {
        if (!role || typeof role !== 'string') {
            throw new Error('Role is required and must be a string');
        }
        
        const validRoles = [UserRole.MASTER, UserRole.MANAGER, UserRole.TEAM_LEAD, UserRole.EMPLOYEE, UserRole.USER];
        if (!validRoles.includes(role.toLowerCase())) {
            throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
        }
    }
    
    /**
     * Check if this is a master role
     */
    isMaster() {
        return this.value === UserRole.MASTER;
    }
    
    /**
     * Check if this is a manager role
     */
    isManager() {
        return this.value === UserRole.MANAGER || this.value === UserRole.MASTER;
    }
    
    /**
     * Check if this is a team lead role
     */
    isTeamLead() {
        return this.value === UserRole.TEAM_LEAD;
    }
    
    /**
     * Check if this is an employee role
     */
    isEmployee() {
        return this.value === UserRole.EMPLOYEE;
    }
    
    /**
     * Check if this is a regular user role (legacy)
     */
    isUser() {
        return this.value === UserRole.USER;
    }
    
    /**
     * Get the string representation
     */
    toString() {
        return this.value;
    }
    
    /**
     * Check equality with another role
     */
    equals(other) {
        if (!(other instanceof UserRole)) {
            return false;
        }
        return this.value === other.value;
    }
    
    /**
     * Get role capabilities
     */
    getCapabilities() {
        switch (this.value) {
            case UserRole.MASTER:
                return {
                    canUseClickUpOAuth: true,
                    canManageSystem: true,
                    canViewAllTasks: true,
                    canConfigureIntegration: true,
                    canManageEmployees: true,
                    canViewReports: true,
                    canManageProjects: true,
                    canViewTeamAnalytics: true,
                    canAccessSystemSettings: true
                };
            case UserRole.MANAGER:
                return {
                    canUseClickUpOAuth: false,
                    canManageSystem: false,
                    canViewAllTasks: true,
                    canConfigureIntegration: false,
                    canManageEmployees: true,
                    canViewReports: true,
                    canManageProjects: true,
                    canViewTeamAnalytics: true,
                    canAccessSystemSettings: false
                };
            case UserRole.TEAM_LEAD:
                return {
                    canUseClickUpOAuth: false,
                    canManageSystem: false,
                    canViewAllTasks: false,
                    canConfigureIntegration: false,
                    canManageEmployees: false,
                    canViewReports: false,
                    canManageProjects: false,
                    canViewTeamTasks: true,
                    canManageTeamMembers: true,
                    canViewTeamAnalytics: true,
                    canViewTeamReports: true,
                    canAccessTeamAttendance: true
                };
            case UserRole.EMPLOYEE:
                return {
                    canUseClickUpOAuth: false,
                    canManageSystem: false,
                    canViewAllTasks: false,
                    canConfigureIntegration: false,
                    canManageEmployees: false,
                    canViewReports: false,
                    canManageProjects: false,
                    canViewOwnTasks: true,
                    canUpdateTaskStatus: true,
                    canViewOwnProfile: true,
                    canAccessKnowledgeBase: true,
                    canMarkAttendance: true
                };
            case UserRole.USER: // Legacy support
                return {
                    canUseClickUpOAuth: false,
                    canManageSystem: false,
                    canViewAllTasks: false,
                    canConfigureIntegration: false
                };
            default:
                return {};
        }
    }
    
    /**
     * Get navigation components for this role
     */
    getNavigationComponents() {
        switch (this.value) {
            case UserRole.MASTER:
            case UserRole.MANAGER:
                return [
                    'Dashboard',
                    'All Tasks',
                    'Team Overview',
                    'Team Analytics',
                    'Employee Management',
                    'Team Ranking',
                    'Reports',
                    'Team Attendance',
                    ...(this.value === UserRole.MASTER ? ['System Settings'] : [])
                ];
            case UserRole.TEAM_LEAD:
                return [
                    'My Team Dashboard',
                    'My Team Members',
                    'Team Tasks',
                    'Team Analytics',
                    'Team Attendance'
                ];
            case UserRole.EMPLOYEE:
                return [
                    'My Dashboard',
                    'My Tasks',
                    'My Profile',
                    'Knowledge Management'
                ];
            case UserRole.USER: // Legacy support
                return ['Dashboard', 'My Tasks'];
            default:
                return [];
        }
    }
    
    /**
     * Get display name for the role
     */
    getDisplayName() {
        switch (this.value) {
            case UserRole.MASTER:
                return 'Master User';
            case UserRole.MANAGER:
                return 'Manager';
            case UserRole.TEAM_LEAD:
                return 'Team Lead';
            case UserRole.EMPLOYEE:
                return 'Employee';
            case UserRole.USER:
                return 'User';
            default:
                return 'Unknown';
        }
    }
}

module.exports = { UserRole };