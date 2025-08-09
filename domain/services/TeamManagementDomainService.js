/**
 * Team Management Domain Service
 * TaskFlow Pro v2.2 - Domain-Driven Design Implementation
 * Contains complex business logic for team operations
 */

class TeamManagementDomainService {
    constructor() {
        // Domain service doesn't have dependencies on infrastructure
    }

    /**
     * Calculate team performance metrics
     */
    calculateTeamPerformance(team, tasks = [], members = []) {
        if (!team || !Array.isArray(tasks)) {
            throw new Error('Team and tasks are required for performance calculation');
        }

        const teamTasks = tasks.filter(task => task.teamId === team.id);
        const completedTasks = teamTasks.filter(task => task.isCompleted());
        const overdueTasks = teamTasks.filter(task => task.isOverdue());
        const inProgressTasks = teamTasks.filter(task => task.isInProgress());

        // Calculate basic metrics
        const totalTasks = teamTasks.length;
        const completionRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;
        const overdueRate = totalTasks > 0 ? (overdueTasks.length / totalTasks) * 100 : 0;

        // Calculate average productivity score
        const totalProductivityScore = teamTasks.reduce((sum, task) => sum + task.getProductivityScore(), 0);
        const averageProductivityScore = totalTasks > 0 ? totalProductivityScore / totalTasks : 0;

        // Calculate team velocity (tasks completed per time period)
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        const recentCompletedTasks = completedTasks.filter(task => 
            task.updatedAt && new Date(task.updatedAt) >= last30Days
        );

        return {
            teamId: team.id,
            teamName: team.name,
            memberCount: team.getMemberCount(),
            metrics: {
                totalTasks,
                completedTasks: completedTasks.length,
                inProgressTasks: inProgressTasks.length,
                overdueTasks: overdueTasks.length,
                completionRate: Math.round(completionRate * 100) / 100,
                overdueRate: Math.round(overdueRate * 100) / 100,
                averageProductivityScore: Math.round(averageProductivityScore),
                monthlyVelocity: recentCompletedTasks.length
            },
            performance: this._calculatePerformanceGrade(completionRate, overdueRate, averageProductivityScore)
        };
    }

    /**
     * Generate team ranking based on performance
     */
    generateTeamRanking(teams, tasks, customCriteria = {}) {
        if (!Array.isArray(teams) || !Array.isArray(tasks)) {
            throw new Error('Teams and tasks arrays are required');
        }

        const teamPerformances = teams.map(team => 
            this.calculateTeamPerformance(team, tasks)
        );

        // Apply custom ranking criteria
        const weights = {
            completionRate: customCriteria.completionRateWeight || 0.4,
            productivityScore: customCriteria.productivityScoreWeight || 0.3,
            velocity: customCriteria.velocityWeight || 0.2,
            overduepenalty: customCriteria.overduePenaltyWeight || 0.1
        };

        // Calculate ranking scores
        const rankedTeams = teamPerformances.map(performance => {
            const metrics = performance.metrics;
            const score = (
                (metrics.completionRate * weights.completionRate) +
                (metrics.averageProductivityScore * weights.productivityScore / 100) +
                (metrics.monthlyVelocity * weights.velocity * 10) -
                (metrics.overdueRate * weights.overduepenalty)
            );

            return {
                ...performance,
                rankingScore: Math.max(0, Math.round(score * 100) / 100)
            };
        });

        // Sort by ranking score (descending)
        rankedTeams.sort((a, b) => b.rankingScore - a.rankingScore);

        // Add ranking positions
        return rankedTeams.map((team, index) => ({
            ...team,
            rank: index + 1,
            percentile: Math.round(((rankedTeams.length - index) / rankedTeams.length) * 100)
        }));
    }

    /**
     * Analyze team workload distribution
     */
    analyzeWorkloadDistribution(team, tasks, members) {
        if (!team || !Array.isArray(tasks) || !Array.isArray(members)) {
            throw new Error('Team, tasks, and members are required');
        }

        const teamTasks = tasks.filter(task => task.teamId === team.id);
        const workloadByMember = {};

        // Initialize workload for all team members
        team.memberIds.forEach(memberId => {
            workloadByMember[memberId] = {
                memberId,
                memberName: team.memberNames[team.memberIds.indexOf(memberId)],
                totalTasks: 0,
                completedTasks: 0,
                inProgressTasks: 0,
                overdueTasks: 0,
                totalTimeSpent: 0,
                productivityScore: 0
            };
        });

        // Calculate workload metrics for each member
        teamTasks.forEach(task => {
            if (task.assigneeId && workloadByMember[task.assigneeId]) {
                const memberWorkload = workloadByMember[task.assigneeId];
                memberWorkload.totalTasks++;
                
                if (task.isCompleted()) memberWorkload.completedTasks++;
                if (task.isInProgress()) memberWorkload.inProgressTasks++;
                if (task.isOverdue()) memberWorkload.overdueTasks++;
                
                memberWorkload.totalTimeSpent += task.timeSpent || 0;
                memberWorkload.productivityScore += task.getProductivityScore();
            }
        });

        // Calculate additional metrics
        Object.values(workloadByMember).forEach(memberWorkload => {
            memberWorkload.completionRate = memberWorkload.totalTasks > 0 
                ? (memberWorkload.completedTasks / memberWorkload.totalTasks) * 100 
                : 0;
            memberWorkload.averageProductivityScore = memberWorkload.totalTasks > 0
                ? memberWorkload.productivityScore / memberWorkload.totalTasks
                : 0;
        });

        // Identify workload imbalances
        const workloads = Object.values(workloadByMember);
        const avgTasksPerMember = workloads.reduce((sum, w) => sum + w.totalTasks, 0) / workloads.length;
        const workloadVariance = workloads.reduce((sum, w) => sum + Math.pow(w.totalTasks - avgTasksPerMember, 2), 0) / workloads.length;

        return {
            teamId: team.id,
            teamName: team.name,
            memberWorkloads: workloads,
            analysis: {
                averageTasksPerMember: Math.round(avgTasksPerMember * 100) / 100,
                workloadVariance: Math.round(workloadVariance * 100) / 100,
                isBalanced: workloadVariance <= avgTasksPerMember * 0.5, // Threshold for balanced workload
                recommendations: this._generateWorkloadRecommendations(workloads, avgTasksPerMember)
            }
        };
    }

    /**
     * Determine if team structure is optimal
     */
    evaluateTeamStructure(team, tasks) {
        if (!team) {
            throw new Error('Team is required for structure evaluation');
        }

        const memberCount = team.getMemberCount();
        const hasLeader = !!team.leaderId;
        const teamTasks = tasks ? tasks.filter(task => task.teamId === team.id) : [];
        
        const evaluation = {
            teamId: team.id,
            teamName: team.name,
            structure: {
                memberCount,
                hasLeader,
                teamSize: team.calculateTeamSize(),
                isActive: team.isActive
            },
            assessment: {
                optimal: true,
                issues: [],
                recommendations: []
            }
        };

        // Evaluate team size
        if (memberCount < 2) {
            evaluation.assessment.optimal = false;
            evaluation.assessment.issues.push('Team too small for effective collaboration');
            evaluation.assessment.recommendations.push('Consider adding more team members');
        } else if (memberCount > 12) {
            evaluation.assessment.optimal = false;
            evaluation.assessment.issues.push('Team too large for efficient management');
            evaluation.assessment.recommendations.push('Consider splitting into smaller teams');
        }

        // Evaluate leadership
        if (!hasLeader && memberCount > 3) {
            evaluation.assessment.optimal = false;
            evaluation.assessment.issues.push('No designated team leader for team coordination');
            evaluation.assessment.recommendations.push('Assign a team leader for better coordination');
        }

        // Evaluate task distribution
        if (teamTasks.length > memberCount * 10) {
            evaluation.assessment.optimal = false;
            evaluation.assessment.issues.push('High task-to-member ratio may lead to burnout');
            evaluation.assessment.recommendations.push('Consider redistributing tasks or adding resources');
        }

        return evaluation;
    }

    /**
     * Private helper methods
     */
    _calculatePerformanceGrade(completionRate, overdueRate, productivityScore) {
        let grade = 'F';
        let score = 0;

        // Base score from completion rate (0-40 points)
        score += Math.min(completionRate, 100) * 0.4;

        // Productivity score contribution (0-30 points)
        score += Math.min(productivityScore, 100) * 0.3;

        // Penalty for overdue tasks (0-20 points penalty)
        score -= Math.min(overdueRate, 100) * 0.2;

        // Bonus for efficiency (0-10 points)
        if (completionRate > 80 && overdueRate < 10) {
            score += 10;
        }

        // Assign letter grade
        if (score >= 90) grade = 'A+';
        else if (score >= 85) grade = 'A';
        else if (score >= 80) grade = 'A-';
        else if (score >= 75) grade = 'B+';
        else if (score >= 70) grade = 'B';
        else if (score >= 65) grade = 'B-';
        else if (score >= 60) grade = 'C+';
        else if (score >= 55) grade = 'C';
        else if (score >= 50) grade = 'C-';
        else if (score >= 45) grade = 'D+';
        else if (score >= 40) grade = 'D';
        else if (score >= 35) grade = 'D-';

        return {
            grade,
            score: Math.round(score * 100) / 100,
            description: this._getGradeDescription(grade)
        };
    }

    _getGradeDescription(grade) {
        const descriptions = {
            'A+': 'Exceptional performance - outstanding results',
            'A': 'Excellent performance - exceeds expectations',
            'A-': 'Very good performance - above average',
            'B+': 'Good performance - meets expectations well',
            'B': 'Satisfactory performance - meets basic expectations',
            'B-': 'Acceptable performance - slightly below average',
            'C+': 'Fair performance - needs improvement',
            'C': 'Marginal performance - requires attention',
            'C-': 'Poor performance - significant improvement needed',
            'D+': 'Unsatisfactory performance - immediate action required',
            'D': 'Very poor performance - critical intervention needed',
            'D-': 'Failing performance - urgent restructuring required',
            'F': 'Critical failure - team requires immediate overhaul'
        };

        return descriptions[grade] || 'Unknown performance level';
    }

    _generateWorkloadRecommendations(workloads, avgTasksPerMember) {
        const recommendations = [];
        const threshold = avgTasksPerMember * 0.3; // 30% threshold for rebalancing

        workloads.forEach(workload => {
            if (workload.totalTasks > avgTasksPerMember + threshold) {
                recommendations.push({
                    type: 'redistribute',
                    member: workload.memberName,
                    message: `${workload.memberName} is overloaded with ${workload.totalTasks} tasks (${Math.round((workload.totalTasks - avgTasksPerMember) * 100) / 100} above average)`
                });
            } else if (workload.totalTasks < avgTasksPerMember - threshold) {
                recommendations.push({
                    type: 'assign_more',
                    member: workload.memberName,
                    message: `${workload.memberName} has capacity for more tasks (${Math.round((avgTasksPerMember - workload.totalTasks) * 100) / 100} below average)`
                });
            }

            if (workload.completionRate < 60) {
                recommendations.push({
                    type: 'support',
                    member: workload.memberName,
                    message: `${workload.memberName} has low completion rate (${Math.round(workload.completionRate)}%) - may need support or training`
                });
            }
        });

        return recommendations;
    }
}

module.exports = { TeamManagementDomainService };