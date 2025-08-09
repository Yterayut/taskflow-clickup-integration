/**
 * Task Domain Entity
 * TaskFlow Pro v2.2 - Domain-Driven Design Implementation
 */

class Task {
    constructor({
        id,
        clickupId,
        name,
        description,
        status,
        priority,
        assigneeId,
        assigneeName,
        teamId,
        spaceId,
        folderId,
        listId,
        dueDate = null,
        startDate = null,
        timeEstimate = null,
        timeSpent = null,
        tags = [],
        customFields = {},
        url,
        createdAt,
        updatedAt,
        lastSyncAt = new Date()
    }) {
        this.id = id;
        this.clickupId = clickupId;
        this.name = name;
        this.description = description;
        this.status = status;
        this.priority = priority;
        this.assigneeId = assigneeId;
        this.assigneeName = assigneeName;
        this.teamId = teamId;
        this.spaceId = spaceId;
        this.folderId = folderId;
        this.listId = listId;
        this.dueDate = dueDate;
        this.startDate = startDate;
        this.timeEstimate = timeEstimate;
        this.timeSpent = timeSpent;
        this.tags = tags || [];
        this.customFields = customFields || {};
        this.url = url;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.lastSyncAt = lastSyncAt;
        
        this.validate();
    }

    validate() {
        if (!this.name || this.name.trim().length === 0) {
            throw new Error('Task name is required');
        }
        
        if (!this.clickupId) {
            throw new Error('ClickUp ID is required');
        }
        
        if (!this.status) {
            throw new Error('Task status is required');
        }
    }

    // Domain methods
    updateStatus(newStatus) {
        this.status = newStatus;
        this.updatedAt = new Date();
        this.lastSyncAt = new Date();
    }

    assignTo(userId, userName) {
        this.assigneeId = userId;
        this.assigneeName = userName;
        this.updatedAt = new Date();
        this.lastSyncAt = new Date();
    }

    updatePriority(newPriority) {
        this.priority = newPriority;
        this.updatedAt = new Date();
        this.lastSyncAt = new Date();
    }

    addTimeSpent(hours) {
        this.timeSpent = (this.timeSpent || 0) + hours;
        this.updatedAt = new Date();
    }

    setDueDate(dueDate) {
        this.dueDate = dueDate;
        this.updatedAt = new Date();
    }

    addTag(tag) {
        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
            this.updatedAt = new Date();
        }
    }

    removeTag(tag) {
        this.tags = this.tags.filter(t => t !== tag);
        this.updatedAt = new Date();
    }

    setCustomField(fieldName, value) {
        this.customFields[fieldName] = value;
        this.updatedAt = new Date();
    }

    // Business logic methods
    isOverdue() {
        if (!this.dueDate) return false;
        return new Date() > new Date(this.dueDate) && !this.isCompleted();
    }

    isCompleted() {
        const completedStatuses = ['complete', 'closed', 'done'];
        return completedStatuses.includes(this.status?.toLowerCase());
    }

    isInProgress() {
        const inProgressStatuses = ['in progress', 'active', 'working'];
        return inProgressStatuses.includes(this.status?.toLowerCase());
    }

    isDueSoon(days = 3) {
        if (!this.dueDate) return false;
        const daysUntilDue = Math.ceil((new Date(this.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= days && daysUntilDue >= 0;
    }

    getCompletionPercentage() {
        if (this.isCompleted()) return 100;
        if (!this.timeEstimate || !this.timeSpent) return 0;
        return Math.min(Math.round((this.timeSpent / this.timeEstimate) * 100), 100);
    }

    // Productivity metrics
    getProductivityScore() {
        let score = 0;
        
        // Completion bonus
        if (this.isCompleted()) score += 100;
        else if (this.isInProgress()) score += 50;
        
        // On-time bonus
        if (this.isCompleted() && this.dueDate && new Date(this.updatedAt) <= new Date(this.dueDate)) {
            score += 25;
        }
        
        // Priority factor
        if (this.priority === 'urgent') score *= 1.5;
        else if (this.priority === 'high') score *= 1.3;
        else if (this.priority === 'normal') score *= 1.1;
        
        return Math.round(score);
    }

    // Convert to API response format
    toJSON() {
        return {
            id: this.id,
            clickupId: this.clickupId,
            name: this.name,
            description: this.description,
            status: this.status,
            priority: this.priority,
            assigneeId: this.assigneeId,
            assigneeName: this.assigneeName,
            teamId: this.teamId,
            spaceId: this.spaceId,
            folderId: this.folderId,
            listId: this.listId,
            dueDate: this.dueDate,
            startDate: this.startDate,
            timeEstimate: this.timeEstimate,
            timeSpent: this.timeSpent,
            tags: this.tags,
            customFields: this.customFields,
            url: this.url,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastSyncAt: this.lastSyncAt,
            // Computed properties
            isOverdue: this.isOverdue(),
            isCompleted: this.isCompleted(),
            isInProgress: this.isInProgress(),
            isDueSoon: this.isDueSoon(),
            completionPercentage: this.getCompletionPercentage(),
            productivityScore: this.getProductivityScore()
        };
    }

    // Convert to database format
    toDatabaseObject() {
        return {
            id: this.id,
            clickup_id: this.clickupId,
            name: this.name,
            description: this.description,
            status: this.status,
            priority: this.priority,
            assignee_id: this.assigneeId,
            assignee_name: this.assigneeName,
            team_id: this.teamId,
            space_id: this.spaceId,
            folder_id: this.folderId,
            list_id: this.listId,
            due_date: this.dueDate,
            start_date: this.startDate,
            time_estimate: this.timeEstimate,
            time_spent: this.timeSpent,
            tags: JSON.stringify(this.tags),
            custom_fields: JSON.stringify(this.customFields),
            url: this.url,
            created_at: this.createdAt,
            updated_at: this.updatedAt,
            last_sync_at: this.lastSyncAt
        };
    }

    // Create from database row
    static fromDatabaseRow(row) {
        return new Task({
            id: row.id,
            clickupId: row.clickup_id,
            name: row.name,
            description: row.description,
            status: row.status,
            priority: row.priority,
            assigneeId: row.assignee_id,
            assigneeName: row.assignee_name,
            teamId: row.team_id,
            spaceId: row.space_id,
            folderId: row.folder_id,
            listId: row.list_id,
            dueDate: row.due_date,
            startDate: row.start_date,
            timeEstimate: row.time_estimate,
            timeSpent: row.time_spent,
            tags: row.tags ? JSON.parse(row.tags) : [],
            customFields: row.custom_fields ? JSON.parse(row.custom_fields) : {},
            url: row.url,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastSyncAt: row.last_sync_at
        });
    }

    // Create from ClickUp API response
    static fromClickUpData(clickupTask) {
        return new Task({
            clickupId: clickupTask.id,
            name: clickupTask.name,
            description: clickupTask.description || '',
            status: clickupTask.status?.status || 'open',
            priority: clickupTask.priority?.priority || 'normal',
            assigneeId: clickupTask.assignees?.[0]?.id || null,
            assigneeName: clickupTask.assignees?.[0]?.username || null,
            teamId: clickupTask.team_id,
            spaceId: clickupTask.space?.id,
            folderId: clickupTask.folder?.id,
            listId: clickupTask.list?.id,
            dueDate: clickupTask.due_date ? new Date(parseInt(clickupTask.due_date)) : null,
            startDate: clickupTask.start_date ? new Date(parseInt(clickupTask.start_date)) : null,
            timeEstimate: clickupTask.time_estimate ? parseInt(clickupTask.time_estimate) : null,
            timeSpent: clickupTask.time_spent ? parseInt(clickupTask.time_spent) : null,
            tags: clickupTask.tags?.map(tag => tag.name) || [],
            customFields: clickupTask.custom_fields?.reduce((acc, field) => {
                acc[field.name] = field.value;
                return acc;
            }, {}) || {},
            url: clickupTask.url,
            createdAt: new Date(parseInt(clickupTask.date_created)),
            updatedAt: new Date(parseInt(clickupTask.date_updated)),
            lastSyncAt: new Date()
        });
    }
}

module.exports = { Task };