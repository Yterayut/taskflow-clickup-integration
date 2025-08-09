/**
 * Task Management Application Service
 * TaskFlow Pro v2.2 - Domain-Driven Design Implementation
 * Orchestrates task management operations between domain and infrastructure
 */

const { Task } = require('../../domain/entities/Task');
const { Team } = require('../../domain/entities/Team');
const { TeamManagementDomainService } = require('../../domain/services/TeamManagementDomainService');

class TaskManagementApplicationService {
    constructor({
        taskRepository,
        teamRepository,
        userRepository,
        clickupAdapter,
        auditLoggingService
    }) {
        this.taskRepository = taskRepository;
        this.teamRepository = teamRepository;
        this.userRepository = userRepository;
        this.clickupAdapter = clickupAdapter;
        this.auditLoggingService = auditLoggingService;
        this.teamManagementDomainService = new TeamManagementDomainService();
    }

    /**
     * Get dashboard data based on user role
     */
    async getDashboardData(userId, userRole) {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            let dashboardData = {};

            switch (userRole) {
                case 'master':
                case 'manager':
                    dashboardData = await this._getManagerDashboard(user);
                    break;
                case 'team_lead':
                    dashboardData = await this._getTeamLeadDashboard(user);
                    break;
                case 'employee':
                    dashboardData = await this._getEmployeeDashboard(user);
                    break;
                default:
                    throw new Error('Invalid user role');
            }

            await this.auditLoggingService.logEvent({
                userId,
                action: 'dashboard_accessed',
                details: { role: userRole },
                riskLevel: 'low'
            });

            return dashboardData;
        } catch (error) {
            await this.auditLoggingService.logEvent({
                userId,
                action: 'dashboard_access_failed',
                details: { error: error.message, role: userRole },
                riskLevel: 'medium'
            });
            throw error;
        }
    }

    /**
     * Get tasks with role-based filtering
     */
    async getTasks(userId, userRole, filters = {}) {
        try {
            let tasks = [];

            switch (userRole) {
                case 'master':
                case 'manager':
                    tasks = await this.taskRepository.findAll(filters);
                    break;
                case 'team_lead':
                    const userTeams = await this.teamRepository.findByLeaderId(userId);
                    const teamIds = userTeams.map(team => team.id);
                    tasks = await this.taskRepository.findByTeamIds(teamIds, filters);
                    break;
                case 'employee':
                    tasks = await this.taskRepository.findByAssigneeId(userId, filters);
                    break;
                default:
                    throw new Error('Invalid user role');
            }

            // Convert to domain entities and apply business logic
            const taskEntities = tasks.map(task => Task.fromDatabaseRow(task));
            
            return taskEntities.map(task => task.toJSON());
        } catch (error) {
            await this.auditLoggingService.logEvent({
                userId,
                action: 'task_access_failed',
                details: { error: error.message, filters },
                riskLevel: 'medium'
            });
            throw error;
        }
    }

    /**
     * Generate team ranking with customizable criteria
     */
    async generateTeamRanking(userId, userRole, criteria = {}) {
        try {
            if (!['master', 'manager'].includes(userRole)) {
                throw new Error('Insufficient permissions for team ranking');
            }

            const teams = await this.teamRepository.findAll();
            const tasks = await this.taskRepository.findAll();

            const teamEntities = teams.map(team => Team.fromDatabaseRow(team));
            const taskEntities = tasks.map(task => Task.fromDatabaseRow(task));

            const ranking = this.teamManagementDomainService.generateTeamRanking(
                teamEntities,
                taskEntities,
                criteria
            );

            await this.auditLoggingService.logEvent({
                userId,
                action: 'team_ranking_generated',
                details: { criteria, teamsCount: teams.length },
                riskLevel: 'low'
            });

            return ranking;
        } catch (error) {
            await this.auditLoggingService.logEvent({
                userId,
                action: 'team_ranking_failed',
                details: { error: error.message },
                riskLevel: 'medium'
            });
            throw error;
        }
    }

    /**
     * Analyze team workload distribution
     */
    async analyzeTeamWorkload(userId, userRole, teamId) {
        try {
            const user = await this.userRepository.findById(userId);
            const team = await this.teamRepository.findById(teamId);
            
            if (!team) {
                throw new Error('Team not found');
            }

            // Check permissions
            if (!team.canUserAccessTeam(userId, userRole)) {
                throw new Error('Insufficient permissions to access team data');
            }

            const tasks = await this.taskRepository.findByTeamId(teamId);
            const members = await this.userRepository.findByIds(team.memberIds);

            const teamEntity = Team.fromDatabaseRow(team);
            const taskEntities = tasks.map(task => Task.fromDatabaseRow(task));

            const workloadAnalysis = this.teamManagementDomainService.analyzeWorkloadDistribution(
                teamEntity,
                taskEntities,
                members
            );

            await this.auditLoggingService.logEvent({
                userId,
                action: 'workload_analysis_performed',
                details: { teamId, membersCount: members.length },
                riskLevel: 'low'
            });

            return workloadAnalysis;
        } catch (error) {
            await this.auditLoggingService.logEvent({
                userId,
                action: 'workload_analysis_failed',
                details: { error: error.message, teamId },
                riskLevel: 'medium'
            });
            throw error;
        }
    }

    /**
     * Generate attendance report
     */
    async generateAttendanceReport(userId, userRole, period = 'monthly', teamId = null) {
        try {
            const startDate = this._getReportStartDate(period);
            const endDate = new Date();

            let tasks = [];
            let teams = [];

            if (userRole === 'master' || userRole === 'manager') {
                if (teamId) {
                    tasks = await this.taskRepository.findByTeamId(teamId, {
                        startDate,
                        endDate
                    });
                    teams = [await this.teamRepository.findById(teamId)];
                } else {
                    tasks = await this.taskRepository.findAll({
                        startDate,
                        endDate
                    });
                    teams = await this.teamRepository.findAll();
                }
            } else if (userRole === 'team_lead') {
                const userTeams = await this.teamRepository.findByLeaderId(userId);
                teams = teamId 
                    ? userTeams.filter(team => team.id === teamId)
                    : userTeams;
                
                const teamIds = teams.map(team => team.id);
                tasks = await this.taskRepository.findByTeamIds(teamIds, {
                    startDate,
                    endDate
                });
            } else {
                throw new Error('Insufficient permissions for attendance reports');
            }

            const report = this._generateAttendanceAnalysis(tasks, teams, period, startDate, endDate);

            await this.auditLoggingService.logEvent({
                userId,
                action: 'attendance_report_generated',
                details: { period, teamId, tasksCount: tasks.length },
                riskLevel: 'low'
            });

            return report;
        } catch (error) {
            await this.auditLoggingService.logEvent({
                userId,
                action: 'attendance_report_failed',
                details: { error: error.message, period, teamId },
                riskLevel: 'medium'
            });
            throw error;
        }
    }

    /**
     * Export data to CSV format
     */
    async exportToCSV(userId, userRole, exportType, filters = {}) {
        try {
            let data = [];
            let filename = '';

            switch (exportType) {
                case 'tasks':
                    data = await this._getTasksForExport(userId, userRole, filters);
                    filename = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
                    break;
                case 'team_ranking':
                    data = await this.generateTeamRanking(userId, userRole, filters.criteria);
                    filename = `team_ranking_${new Date().toISOString().split('T')[0]}.csv`;
                    break;
                case 'attendance':
                    data = await this.generateAttendanceReport(userId, userRole, filters.period, filters.teamId);
                    filename = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
                    break;
                default:
                    throw new Error('Invalid export type');
            }

            const csvContent = this._convertToCSV(data, exportType);

            await this.auditLoggingService.logEvent({
                userId,
                action: 'data_exported',
                details: { exportType, recordsCount: Array.isArray(data) ? data.length : 1 },
                riskLevel: 'medium'
            });

            return {
                filename,
                content: csvContent,
                mimeType: 'text/csv'
            };
        } catch (error) {
            await this.auditLoggingService.logEvent({
                userId,
                action: 'export_failed',
                details: { error: error.message, exportType },
                riskLevel: 'high'
            });
            throw error;
        }
    }

    /**
     * Private helper methods
     */
    async _getManagerDashboard(user) {
        const [totalTasks, totalTeams, totalMembers] = await Promise.all([
            this.taskRepository.countAll(),
            this.teamRepository.countAll(),
            this.userRepository.countActive()
        ]);

        const recentTasks = await this.taskRepository.findRecent(10);
        const teams = await this.teamRepository.findAll();
        
        const teamEntities = teams.map(team => Team.fromDatabaseRow(team));
        const tasks = await this.taskRepository.findAll();
        const taskEntities = tasks.map(task => Task.fromDatabaseRow(task));

        const performanceOverview = teamEntities.map(team => 
            this.teamManagementDomainService.calculateTeamPerformance(team, taskEntities)
        );

        return {
            user: user.toSafeObject(),
            summary: {
                totalTasks,
                totalTeams,
                totalMembers,
                completedTasks: taskEntities.filter(task => task.isCompleted()).length,
                overdueTasks: taskEntities.filter(task => task.isOverdue()).length
            },
            recentTasks: recentTasks.map(task => Task.fromDatabaseRow(task).toJSON()),
            teamPerformance: performanceOverview,
            accessibleFeatures: user.getCapabilities()
        };
    }

    async _getTeamLeadDashboard(user) {
        const userTeams = await this.teamRepository.findByLeaderId(user.id);
        const teamIds = userTeams.map(team => team.id);
        
        const [teamTasks, teamMembers] = await Promise.all([
            this.taskRepository.findByTeamIds(teamIds),
            this.userRepository.findByTeamIds(teamIds)
        ]);

        const taskEntities = teamTasks.map(task => Task.fromDatabaseRow(task));

        return {
            user: user.toSafeObject(),
            teams: userTeams.map(team => Team.fromDatabaseRow(team).toJSON()),
            summary: {
                totalTeamTasks: teamTasks.length,
                totalTeamMembers: teamMembers.length,
                completedTasks: taskEntities.filter(task => task.isCompleted()).length,
                overdueTasks: taskEntities.filter(task => task.isOverdue()).length
            },
            recentTasks: taskEntities.slice(0, 10).map(task => task.toJSON()),
            teamMembers: teamMembers.map(member => member.toSafeObject()),
            accessibleFeatures: user.getCapabilities()
        };
    }

    async _getEmployeeDashboard(user) {
        const userTasks = await this.taskRepository.findByAssigneeId(user.id);
        const taskEntities = userTasks.map(task => Task.fromDatabaseRow(task));

        const userTeam = await this.teamRepository.findByMemberId(user.id);

        return {
            user: user.toSafeObject(),
            team: userTeam ? Team.fromDatabaseRow(userTeam).toJSON() : null,
            summary: {
                totalTasks: userTasks.length,
                completedTasks: taskEntities.filter(task => task.isCompleted()).length,
                inProgressTasks: taskEntities.filter(task => task.isInProgress()).length,
                overdueTasks: taskEntities.filter(task => task.isOverdue()).length
            },
            tasks: taskEntities.map(task => task.toJSON()),
            productivity: {
                averageScore: taskEntities.length > 0 
                    ? taskEntities.reduce((sum, task) => sum + task.getProductivityScore(), 0) / taskEntities.length
                    : 0,
                completionRate: taskEntities.length > 0
                    ? (taskEntities.filter(task => task.isCompleted()).length / taskEntities.length) * 100
                    : 0
            },
            accessibleFeatures: user.getCapabilities()
        };
    }

    _getReportStartDate(period) {
        const now = new Date();
        const startDate = new Date(now);

        switch (period) {
            case 'weekly':
                startDate.setDate(now.getDate() - 7);
                break;
            case 'monthly':
                startDate.setMonth(now.getMonth() - 1);
                break;
            case 'quarterly':
                startDate.setMonth(now.getMonth() - 3);
                break;
            case 'yearly':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            default:
                startDate.setMonth(now.getMonth() - 1);
        }

        return startDate;
    }

    _generateAttendanceAnalysis(tasks, teams, period, startDate, endDate) {
        const taskEntities = tasks.map(task => Task.fromDatabaseRow(task));
        const teamEntities = teams.map(team => Team.fromDatabaseRow(team));

        const attendanceData = teamEntities.map(team => {
            const teamTasks = taskEntities.filter(task => task.teamId === team.id);
            const activeDays = this._getActiveDaysFromTasks(teamTasks, startDate, endDate);
            
            return {
                teamId: team.id,
                teamName: team.name,
                memberCount: team.getMemberCount(),
                totalTasks: teamTasks.length,
                completedTasks: teamTasks.filter(task => task.isCompleted()).length,
                activeDays: activeDays.length,
                attendanceScore: this._calculateAttendanceScore(teamTasks, activeDays, period)
            };
        });

        return {
            period,
            startDate,
            endDate,
            summary: {
                totalTeams: teams.length,
                averageAttendance: attendanceData.reduce((sum, team) => sum + team.attendanceScore, 0) / attendanceData.length
            },
            teamAttendance: attendanceData
        };
    }

    _getActiveDaysFromTasks(tasks, startDate, endDate) {
        const activeDays = new Set();
        
        tasks.forEach(task => {
            if (task.updatedAt && task.updatedAt >= startDate && task.updatedAt <= endDate) {
                activeDays.add(task.updatedAt.toDateString());
            }
        });

        return Array.from(activeDays);
    }

    _calculateAttendanceScore(tasks, activeDays, period) {
        const expectedDays = this._getExpectedWorkingDays(period);
        const attendanceRate = activeDays.length / expectedDays;
        const taskCompletionRate = tasks.length > 0 
            ? tasks.filter(task => task.isCompleted()).length / tasks.length 
            : 0;

        return Math.round(((attendanceRate * 0.6) + (taskCompletionRate * 0.4)) * 100);
    }

    _getExpectedWorkingDays(period) {
        switch (period) {
            case 'weekly': return 5;
            case 'monthly': return 22;
            case 'quarterly': return 66;
            case 'yearly': return 260;
            default: return 22;
        }
    }

    async _getTasksForExport(userId, userRole, filters) {
        const tasks = await this.getTasks(userId, userRole, filters);
        return tasks;
    }

    _convertToCSV(data, exportType) {
        if (!Array.isArray(data) || data.length === 0) {
            return 'No data available for export';
        }

        const headers = this._getCSVHeaders(exportType);
        const rows = data.map(item => this._getCSVRow(item, exportType));

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    _getCSVHeaders(exportType) {
        switch (exportType) {
            case 'tasks':
                return ['ID', 'Name', 'Status', 'Priority', 'Assignee', 'Team', 'Due Date', 'Completion Rate'];
            case 'team_ranking':
                return ['Rank', 'Team Name', 'Completion Rate', 'Productivity Score', 'Ranking Score'];
            case 'attendance':
                return ['Team Name', 'Member Count', 'Total Tasks', 'Completed Tasks', 'Active Days', 'Attendance Score'];
            default:
                return ['Data'];
        }
    }

    _getCSVRow(item, exportType) {
        switch (exportType) {
            case 'tasks':
                return [
                    item.id || '',
                    `"${item.name || ''}"`,
                    item.status || '',
                    item.priority || '',
                    item.assigneeName || '',
                    item.teamId || '',
                    item.dueDate || '',
                    item.completionPercentage || 0
                ];
            case 'team_ranking':
                return [
                    item.rank || '',
                    `"${item.teamName || ''}"`,
                    item.metrics?.completionRate || 0,
                    item.metrics?.averageProductivityScore || 0,
                    item.rankingScore || 0
                ];
            case 'attendance':
                return [
                    `"${item.teamName || ''}"`,
                    item.memberCount || 0,
                    item.totalTasks || 0,
                    item.completedTasks || 0,
                    item.activeDays || 0,
                    item.attendanceScore || 0
                ];
            default:
                return [JSON.stringify(item)];
        }
    }
}

module.exports = { TaskManagementApplicationService };