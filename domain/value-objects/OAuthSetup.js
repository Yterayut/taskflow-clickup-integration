/**
 * OAuthSetup Value Object
 * Represents the OAuth setup state for master users
 */

class OAuthSetup {
    constructor(isCompleted = false, completedAt = null) {
        this.isCompleted = isCompleted;
        this.completedAt = completedAt;
        this.validate();
    }

    validate() {
        if (typeof this.isCompleted !== 'boolean') {
            throw new Error('OAuth setup completion status must be a boolean');
        }

        if (this.isCompleted && !this.completedAt) {
            throw new Error('Completed OAuth setup must have completion timestamp');
        }

        if (!this.isCompleted && this.completedAt) {
            throw new Error('Incomplete OAuth setup cannot have completion timestamp');
        }
    }

    /**
     * Create pending OAuth setup state
     */
    static createPending() {
        return new OAuthSetup(false, null);
    }

    /**
     * Create completed OAuth setup state
     */
    static createCompleted(completedAt = null) {
        const timestamp = completedAt || new Date();
        return new OAuthSetup(true, timestamp);
    }

    /**
     * Mark OAuth setup as completed
     */
    markCompleted(completedAt = null) {
        const timestamp = completedAt || new Date();
        return new OAuthSetup(true, timestamp);
    }

    /**
     * Check if OAuth setup is required
     */
    isRequired() {
        return !this.isCompleted;
    }

    /**
     * Get days since completion
     */
    getDaysSinceCompletion() {
        if (!this.isCompleted || !this.completedAt) {
            return null;
        }

        const now = new Date();
        const diffMs = now - this.completedAt;
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    /**
     * Convert to plain object for database storage
     */
    toDatabaseObject() {
        return {
            oauth_setup_completed: this.isCompleted,
            oauth_setup_completed_at: this.completedAt
        };
    }

    /**
     * Create from database row
     */
    static fromDatabaseRow(row) {
        return new OAuthSetup(
            row.oauth_setup_completed || false,
            row.oauth_setup_completed_at || null
        );
    }

    /**
     * Convert to safe object for API responses
     */
    toSafeObject() {
        return {
            isCompleted: this.isCompleted,
            completedAt: this.completedAt,
            isRequired: this.isRequired(),
            daysSinceCompletion: this.getDaysSinceCompletion()
        };
    }

    toString() {
        return this.isCompleted ? 'completed' : 'pending';
    }
}

module.exports = { OAuthSetup };