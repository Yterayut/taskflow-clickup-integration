/**
 * Team Domain Entity
 * TaskFlow Pro v2.2 - Domain-Driven Design Implementation
 */

class Team {
    constructor({
        id,
        clickupId,
        name,
        description = '',
        leaderId,
        leaderName,
        memberIds = [],
        memberNames = [],
        isActive = true,
        settings = {},
        createdAt = new Date(),
        updatedAt = new Date(),
        lastSyncAt = new Date()
    }) {
        this.id = id;
        this.clickupId = clickupId;
        this.name = name;
        this.description = description;
        this.leaderId = leaderId;
        this.leaderName = leaderName;
        this.memberIds = memberIds || [];
        this.memberNames = memberNames || [];
        this.isActive = isActive;
        this.settings = settings || {};
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.lastSyncAt = lastSyncAt;
        
        this.validate();
    }

    validate() {
        if (!this.name || this.name.trim().length === 0) {
            throw new Error('Team name is required');
        }
        
        if (!this.clickupId) {
            throw new Error('ClickUp team ID is required');
        }
    }

    // Domain methods
    addMember(userId, userName) {
        if (!this.memberIds.includes(userId)) {
            this.memberIds.push(userId);
            this.memberNames.push(userName);
            this.updatedAt = new Date();
        }
    }

    removeMember(userId) {
        const index = this.memberIds.indexOf(userId);
        if (index > -1) {
            this.memberIds.splice(index, 1);
            this.memberNames.splice(index, 1);
            this.updatedAt = new Date();
        }
    }

    assignLeader(userId, userName) {
        this.leaderId = userId;
        this.leaderName = userName;
        this.updatedAt = new Date();
        
        // Make sure leader is also a member
        this.addMember(userId, userName);
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.updatedAt = new Date();
    }

    deactivate() {
        this.isActive = false;
        this.updatedAt = new Date();
    }

    activate() {
        this.isActive = true;
        this.updatedAt = new Date();
    }

    updateDescription(description) {
        this.description = description;
        this.updatedAt = new Date();
    }

    // Business logic methods
    getMemberCount() {
        return this.memberIds.length;
    }

    hasMember(userId) {
        return this.memberIds.includes(userId);
    }

    isLeader(userId) {
        return this.leaderId === userId;
    }

    canUserAccessTeam(userId, userRole) {
        // Master and Manager can access all teams
        if (userRole === 'master' || userRole === 'manager') {
            return true;
        }
        
        // Team leaders can access their teams
        if (userRole === 'team_lead' && this.isLeader(userId)) {
            return true;
        }
        
        // Employees can access if they're team members
        if (userRole === 'employee' && this.hasMember(userId)) {
            return true;
        }
        
        return false;
    }

    getTeamHierarchy() {
        return {
            teamId: this.id,
            teamName: this.name,
            leader: {
                id: this.leaderId,
                name: this.leaderName
            },
            members: this.memberIds.map((id, index) => ({
                id: id,
                name: this.memberNames[index]
            })),
            memberCount: this.getMemberCount()
        };
    }

    // Team performance calculations
    calculateTeamSize() {
        const size = this.getMemberCount();
        if (size <= 3) return 'small';
        if (size <= 8) return 'medium';
        return 'large';
    }

    getTeamStructure() {
        return {
            id: this.id,
            name: this.name,
            size: this.calculateTeamSize(),
            memberCount: this.getMemberCount(),
            hasLeader: !!this.leaderId,
            isActive: this.isActive
        };
    }

    // Convert to API response format
    toJSON() {
        return {
            id: this.id,
            clickupId: this.clickupId,
            name: this.name,
            description: this.description,
            leaderId: this.leaderId,
            leaderName: this.leaderName,
            memberIds: this.memberIds,
            memberNames: this.memberNames,
            isActive: this.isActive,
            settings: this.settings,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastSyncAt: this.lastSyncAt,
            // Computed properties
            memberCount: this.getMemberCount(),
            teamSize: this.calculateTeamSize(),
            hierarchy: this.getTeamHierarchy()
        };
    }

    // Convert to database format
    toDatabaseObject() {
        return {
            id: this.id,
            clickup_id: this.clickupId,
            name: this.name,
            description: this.description,
            leader_id: this.leaderId,
            leader_name: this.leaderName,
            member_ids: JSON.stringify(this.memberIds),
            member_names: JSON.stringify(this.memberNames),
            is_active: this.isActive,
            settings: JSON.stringify(this.settings),
            created_at: this.createdAt,
            updated_at: this.updatedAt,
            last_sync_at: this.lastSyncAt
        };
    }

    // Create from database row
    static fromDatabaseRow(row) {
        return new Team({
            id: row.id,
            clickupId: row.clickup_id,
            name: row.name,
            description: row.description,
            leaderId: row.leader_id,
            leaderName: row.leader_name,
            memberIds: row.member_ids ? JSON.parse(row.member_ids) : [],
            memberNames: row.member_names ? JSON.parse(row.member_names) : [],
            isActive: row.is_active,
            settings: row.settings ? JSON.parse(row.settings) : {},
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastSyncAt: row.last_sync_at
        });
    }

    // Create from ClickUp API response
    static fromClickUpData(clickupTeam) {
        return new Team({
            clickupId: clickupTeam.id,
            name: clickupTeam.name,
            description: clickupTeam.description || '',
            memberIds: clickupTeam.members?.map(member => member.user.id) || [],
            memberNames: clickupTeam.members?.map(member => member.user.username) || [],
            isActive: true,
            settings: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSyncAt: new Date()
        });
    }
}

module.exports = { Team };