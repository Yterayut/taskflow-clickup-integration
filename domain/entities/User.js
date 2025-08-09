/**
 * User Entity
 * Core user domain object with authentication capabilities
 */
const bcrypt = require('bcrypt');
const { Email } = require('../value-objects/Email');
const { UserRole } = require('../value-objects/UserRole');
const { OAuthSetup } = require('../value-objects/OAuthSetup');

class User {
    constructor({
        id,
        email,
        passwordHash,
        role,
        fullName = null,
        lastLogin = null,
        isActive = true,
        createdAt = null,
        updatedAt = null,
        oauthSetupCompleted = false,
        oauthSetupCompletedAt = null
    }) {
        this.id = id;
        this.email = new Email(email);
        this.passwordHash = passwordHash;
        this.role = new UserRole(role);
        this.fullName = fullName;
        this.lastLogin = lastLogin;
        this.isActive = isActive;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.oauthSetup = new OAuthSetup(oauthSetupCompleted, oauthSetupCompletedAt);
    }
    
    /**
     * Check if this user is the master user
     */
    isMaster() {
        return this.email.isMaster() && this.role.isMaster();
    }

    /**
     * Check if OAuth setup is required for this user
     */
    requiresOAuthSetup() {
        return this.isMaster() && this.oauthSetup.isRequired();
    }

    /**
     * Check if user can use local authentication
     */
    canUseLocalAuth() {
        return !this.isMaster() || !this.oauthSetup.isRequired();
    }

    /**
     * Complete OAuth setup for master user
     */
    completeOAuthSetup(completedAt = null) {
        if (!this.isMaster()) {
            throw new Error('OAuth setup can only be completed for master users');
        }
        
        this.oauthSetup = this.oauthSetup.markCompleted(completedAt);
        this.updatedAt = new Date();
        
        // Domain event could be emitted here
        // this.addDomainEvent(new MasterUserOAuthSetupCompleted(this.id, completedAt));
    }

    /**
     * Get OAuth setup status
     */
    getOAuthSetupStatus() {
        return this.oauthSetup.toSafeObject();
    }
    
    /**
     * Authenticate user with provided password
     */
    async authenticate(password) {
        if (!password || typeof password !== 'string') {
            throw new Error('Password is required');
        }
        
        if (!this.isActive) {
            throw new Error('User account is deactivated');
        }
        
        try {
            return await bcrypt.compare(password, this.passwordHash);
        } catch (error) {
            throw new Error('Authentication failed');
        }
    }
    
    /**
     * Update last login timestamp
     */
    updateLastLogin() {
        this.lastLogin = new Date();
        this.updatedAt = new Date();
    }
    
    /**
     * Deactivate user account
     */
    deactivate() {
        this.isActive = false;
        this.updatedAt = new Date();
    }
    
    /**
     * Activate user account
     */
    activate() {
        this.isActive = true;
        this.updatedAt = new Date();
    }
    
    /**
     * Update user profile information
     */
    updateProfile({ fullName }) {
        if (fullName !== undefined) {
            this.fullName = fullName;
        }
        this.updatedAt = new Date();
    }
    
    /**
     * Change user password
     */
    async changePassword(currentPassword, newPassword) {
        // Verify current password
        const isCurrentPasswordValid = await this.authenticate(currentPassword);
        if (!isCurrentPasswordValid) {
            throw new Error('Current password is incorrect');
        }
        
        // Validate new password
        this.validatePassword(newPassword);
        
        // Hash new password
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
        this.passwordHash = await bcrypt.hash(newPassword, saltRounds);
        this.updatedAt = new Date();
    }
    
    /**
     * Validate password strength
     */
    validatePassword(password) {
        if (!password || typeof password !== 'string') {
            throw new Error('Password is required');
        }
        
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        
        if (password.length > 100) {
            throw new Error('Password is too long (maximum 100 characters)');
        }
        
        // Additional password strength requirements can be added here
    }
    
    /**
     * Get user capabilities based on role
     */
    getCapabilities() {
        return this.role.getCapabilities();
    }
    
    /**
     * Convert to safe object for API responses (without sensitive data)
     */
    toSafeObject() {
        return {
            id: this.id,
            email: this.email.toString(),
            role: this.role.toString(),
            fullName: this.fullName,
            lastLogin: this.lastLogin,
            isActive: this.isActive,
            createdAt: this.createdAt,
            capabilities: this.getCapabilities(),
            oauthSetup: this.oauthSetup.toSafeObject()
        };
    }
    
    /**
     * Convert to database object
     */
    toDatabaseObject() {
        return {
            id: this.id,
            email: this.email.toString(),
            password_hash: this.passwordHash,
            role: this.role.toString(),
            full_name: this.fullName,
            last_login: this.lastLogin,
            is_active: this.isActive,
            created_at: this.createdAt,
            updated_at: this.updatedAt,
            ...this.oauthSetup.toDatabaseObject()
        };
    }
    
    /**
     * Create User from database row
     */
    static fromDatabaseRow(row) {
        return new User({
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            role: row.role,
            fullName: row.full_name,
            lastLogin: row.last_login,
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            oauthSetupCompleted: row.oauth_setup_completed || false,
            oauthSetupCompletedAt: row.oauth_setup_completed_at || null
        });
    }
    
    /**
     * Create new user with hashed password
     */
    static async createNew({
        email,
        password,
        role,
        fullName = null
    }) {
        const userEmail = new Email(email);
        const userRole = new UserRole(role);
        
        // Validate password
        User.prototype.validatePassword(password);
        
        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        return new User({
            email: userEmail.toString(),
            passwordHash,
            role: userRole.toString(),
            fullName,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
}

module.exports = { User };