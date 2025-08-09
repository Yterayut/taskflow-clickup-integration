/**
 * Email Value Object
 * Handles email validation and master user detection
 */
class Email {
    constructor(value) {
        this.validateEmail(value);
        this.value = value.toLowerCase().trim();
    }
    
    /**
     * Check if this email belongs to the master user
     */
    isMaster() {
        return this.value === process.env.MASTER_USER_EMAIL?.toLowerCase();
    }
    
    /**
     * Validate email format
     */
    validateEmail(email) {
        if (!email || typeof email !== 'string') {
            throw new Error('Email is required and must be a string');
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            throw new Error('Invalid email format');
        }
        
        if (email.trim().length > 255) {
            throw new Error('Email is too long (maximum 255 characters)');
        }
    }
    
    /**
     * Get the string representation
     */
    toString() {
        return this.value;
    }
    
    /**
     * Check equality with another email
     */
    equals(other) {
        if (!(other instanceof Email)) {
            return false;
        }
        return this.value === other.value;
    }
    
    /**
     * Get domain part of email
     */
    getDomain() {
        return this.value.split('@')[1];
    }
    
    /**
     * Get local part of email (before @)
     */
    getLocalPart() {
        return this.value.split('@')[0];
    }
}

module.exports = { Email };