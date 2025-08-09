/**
 * TaskFlow Pro SPA - Enhanced Security Implementation
 * Phase 2c - Advanced Security Features
 */

// Content Security Policy (CSP) Configuration
const CSP_POLICY = {
    'default-src': "'self'",
    'script-src': "'self' 'unsafe-inline'",
    'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src': "'self' https://fonts.gstatic.com",
    'img-src': "'self' data: https:",
    'connect-src': "'self' ws://192.168.20.10:7813 http://192.168.20.10:7812 https://api.taskflow.pro",
    'frame-ancestors': "'none'",
    'form-action': "'self'",
    'base-uri': "'self'",
    'object-src': "'none'",
    'media-src': "'self'"
};

// Security Headers Configuration
const SECURITY_HEADERS = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), bluetooth=(), midi=(), accelerometer=(), gyroscope=(), magnetometer=(), ambient-light-sensor=(), encrypted-media=(), display-capture=(), document-domain=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

// Security Manager Class
class SecurityManager {
    constructor() {
        this.initSecurityFeatures();
        this.setupSecurityMonitoring();
    }

    initSecurityFeatures() {
        // Apply CSP
        this.applyCSP();
        
        // Setup XSS protection
        this.setupXSSProtection();
        
        // Setup CSRF protection
        this.setupCSRFProtection();
        
        // Setup secure storage
        this.setupSecureStorage();
        
        // Setup input validation
        this.setupInputValidation();
        
        // Setup security headers
        this.setupSecurityHeaders();
    }

    applyCSP() {
        const cspString = Object.entries(CSP_POLICY)
            .map(([directive, value]) => `${directive} ${value}`)
            .join('; ');
        
        // Create meta tag for CSP
        const metaCSP = document.createElement('meta');
        metaCSP.httpEquiv = 'Content-Security-Policy';
        metaCSP.content = cspString;
        document.head.appendChild(metaCSP);
        
        console.log('🛡️ CSP Applied:', cspString);
    }

    setupXSSProtection() {
        // Sanitize all user inputs
        window.sanitizeInput = (input) => {
            if (typeof input !== 'string') return input;
            
            return input
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
        };
        
        // Override innerHTML to prevent XSS
        const originalInnerHTML = Element.prototype.innerHTML;
        Object.defineProperty(Element.prototype, 'innerHTML', {
            set: function(value) {
                if (typeof value === 'string' && value.includes('<script')) {
                    console.warn('🚨 XSS attempt blocked:', value);
                    return;
                }
                return originalInnerHTML.call(this, value);
            },
            get: function() {
                return originalInnerHTML.call(this);
            }
        });
    }

    setupCSRFProtection() {
        // Generate CSRF token
        const csrfToken = this.generateCSRFToken();
        
        // Store in session storage
        sessionStorage.setItem('csrf_token', csrfToken);
        
        // Add to all forms
        document.addEventListener('submit', (e) => {
            if (e.target.tagName === 'FORM') {
                let csrfInput = e.target.querySelector('input[name="_csrf"]');
                if (!csrfInput) {
                    csrfInput = document.createElement('input');
                    csrfInput.type = 'hidden';
                    csrfInput.name = '_csrf';
                    csrfInput.value = csrfToken;
                    e.target.appendChild(csrfInput);
                }
            }
        });
        
        // Add to all AJAX requests
        const originalFetch = window.fetch;
        window.fetch = (url, options = {}) => {
            if (options.method && options.method !== 'GET') {
                options.headers = options.headers || {};
                options.headers['X-CSRF-Token'] = csrfToken;
            }
            return originalFetch(url, options);
        };
    }

    generateCSRFToken() {
        return 'csrf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    setupSecureStorage() {
        // Secure localStorage wrapper
        window.secureStorage = {
            setItem: (key, value) => {
                const encrypted = this.encrypt(JSON.stringify(value));
                localStorage.setItem(key, encrypted);
            },
            
            getItem: (key) => {
                const encrypted = localStorage.getItem(key);
                if (!encrypted) return null;
                
                try {
                    const decrypted = this.decrypt(encrypted);
                    return JSON.parse(decrypted);
                } catch (error) {
                    console.error('🔒 Decryption error:', error);
                    return null;
                }
            },
            
            removeItem: (key) => {
                localStorage.removeItem(key);
            },
            
            clear: () => {
                localStorage.clear();
            }
        };
    }

    encrypt(text) {
        // Simple encryption for demo (use proper encryption in production)
        return btoa(text);
    }

    decrypt(encrypted) {
        // Simple decryption for demo (use proper decryption in production)
        return atob(encrypted);
    }

    setupInputValidation() {
        // Email validation
        window.validateEmail = (email) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        };
        
        // Password strength validation
        window.validatePassword = (password) => {
            const minLength = 8;
            const hasUpperCase = /[A-Z]/.test(password);
            const hasLowerCase = /[a-z]/.test(password);
            const hasNumbers = /\d/.test(password);
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
            
            return {
                isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
                requirements: {
                    minLength: password.length >= minLength,
                    hasUpperCase,
                    hasLowerCase,
                    hasNumbers,
                    hasSpecialChar
                }
            };
        };
        
        // SQL injection prevention
        window.sanitizeSQL = (input) => {
            const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'EXEC', 'UNION', 'SCRIPT'];
            const sanitized = input.replace(/['"]/g, '');
            
            for (const keyword of sqlKeywords) {
                if (sanitized.toUpperCase().includes(keyword)) {
                    console.warn('🚨 Potential SQL injection blocked:', input);
                    return input.replace(new RegExp(keyword, 'gi'), '');
                }
            }
            return sanitized;
        };
    }

    setupSecurityHeaders() {
        // Add security headers to all requests
        const originalFetch = window.fetch;
        window.fetch = (url, options = {}) => {
            options.headers = options.headers || {};
            
            // Add security headers
            Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
                if (!options.headers[header]) {
                    options.headers[header] = value;
                }
            });
            
            return originalFetch(url, options);
        };
    }

    setupSecurityMonitoring() {
        // Monitor for security events
        this.securityEvents = [];
        
        // Monitor failed login attempts
        this.monitorFailedLogins();
        
        // Monitor suspicious activities
        this.monitorSuspiciousActivities();
        
        // Monitor for XSS attempts
        this.monitorXSSAttempts();
        
        // Setup security reporting
        this.setupSecurityReporting();
    }

    monitorFailedLogins() {
        let failedAttempts = 0;
        const maxAttempts = 5;
        const lockoutDuration = 15 * 60 * 1000; // 15 minutes
        
        window.addEventListener('loginFailed', (event) => {
            failedAttempts++;
            
            this.logSecurityEvent({
                type: 'FAILED_LOGIN',
                email: event.detail.email,
                ip: this.getClientIP(),
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            });
            
            if (failedAttempts >= maxAttempts) {
                this.lockoutAccount(lockoutDuration);
            }
        });
        
        window.addEventListener('loginSuccess', () => {
            failedAttempts = 0;
        });
    }

    monitorSuspiciousActivities() {
        // Monitor rapid API calls
        const apiCallTimestamps = [];
        const originalFetch = window.fetch;
        
        window.fetch = (url, options = {}) => {
            const now = Date.now();
            apiCallTimestamps.push(now);
            
            // Remove old timestamps (older than 1 minute)
            const oneMinuteAgo = now - 60000;
            const recentCalls = apiCallTimestamps.filter(timestamp => timestamp > oneMinuteAgo);
            
            if (recentCalls.length > 100) {
                this.logSecurityEvent({
                    type: 'SUSPICIOUS_ACTIVITY',
                    description: 'Rapid API calls detected',
                    count: recentCalls.length,
                    timestamp: new Date().toISOString()
                });
            }
            
            return originalFetch(url, options);
        };
    }

    monitorXSSAttempts() {
        // Monitor for XSS attempts in input fields
        document.addEventListener('input', (event) => {
            const value = event.target.value;
            const xssPatterns = [
                /<script/i,
                /javascript:/i,
                /on\w+\s*=/i,
                /<iframe/i,
                /<object/i,
                /<embed/i
            ];
            
            for (const pattern of xssPatterns) {
                if (pattern.test(value)) {
                    this.logSecurityEvent({
                        type: 'XSS_ATTEMPT',
                        pattern: pattern.source,
                        value: value,
                        element: event.target.tagName,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Clear the input
                    event.target.value = '';
                    
                    // Show warning
                    this.showSecurityWarning('Potentially malicious input detected and blocked');
                    break;
                }
            }
        });
    }

    lockoutAccount(duration) {
        const lockoutEnd = Date.now() + duration;
        localStorage.setItem('account_lockout', lockoutEnd);
        
        this.showSecurityWarning(`Account locked due to multiple failed login attempts. Try again in ${duration / 60000} minutes.`);
        
        // Disable login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.style.display = 'none';
        }
        
        // Show lockout message
        const lockoutMessage = document.createElement('div');
        lockoutMessage.innerHTML = `
            <div style="background: #ff4d4f; color: white; padding: 1rem; border-radius: 4px; text-align: center;">
                Account temporarily locked. Please try again later.
            </div>
        `;
        document.body.appendChild(lockoutMessage);
    }

    isAccountLocked() {
        const lockoutEnd = localStorage.getItem('account_lockout');
        if (!lockoutEnd) return false;
        
        if (Date.now() > parseInt(lockoutEnd)) {
            localStorage.removeItem('account_lockout');
            return false;
        }
        
        return true;
    }

    logSecurityEvent(event) {
        this.securityEvents.push(event);
        console.warn('🚨 Security Event:', event);
        
        // Send to server if critical
        if (['FAILED_LOGIN', 'XSS_ATTEMPT', 'SUSPICIOUS_ACTIVITY'].includes(event.type)) {
            this.reportSecurityEvent(event);
        }
    }

    async reportSecurityEvent(event) {
        try {
            await fetch('/api/v2/security/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
                credentials: 'include'
            });
        } catch (error) {
            console.error('Failed to report security event:', error);
        }
    }

    setupSecurityReporting() {
        // Generate security report
        window.getSecurityReport = () => {
            return {
                timestamp: new Date().toISOString(),
                events: this.securityEvents,
                totalEvents: this.securityEvents.length,
                eventTypes: this.getEventTypeSummary(),
                recommendations: this.getSecurityRecommendations()
            };
        };
    }

    getEventTypeSummary() {
        const summary = {};
        this.securityEvents.forEach(event => {
            summary[event.type] = (summary[event.type] || 0) + 1;
        });
        return summary;
    }

    getSecurityRecommendations() {
        const recommendations = [];
        
        if (this.securityEvents.some(e => e.type === 'FAILED_LOGIN')) {
            recommendations.push('Consider implementing two-factor authentication');
        }
        
        if (this.securityEvents.some(e => e.type === 'XSS_ATTEMPT')) {
            recommendations.push('Review input validation and sanitization');
        }
        
        if (this.securityEvents.some(e => e.type === 'SUSPICIOUS_ACTIVITY')) {
            recommendations.push('Monitor for potential DDoS attacks');
        }
        
        return recommendations;
    }

    showSecurityWarning(message) {
        const warning = document.createElement('div');
        warning.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4d4f;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        warning.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 0.5rem;">🚨 Security Warning</div>
            <div>${message}</div>
            <button onclick="this.parentElement.remove()" style="position: absolute; top: 5px; right: 5px; background: none; border: none; color: white; cursor: pointer;">&times;</button>
        `;
        
        document.body.appendChild(warning);
        
        setTimeout(() => {
            if (warning.parentElement) {
                warning.remove();
            }
        }, 10000);
    }

    getClientIP() {
        // In a real implementation, this would get the actual client IP
        return 'Unknown';
    }
}

// Session Security Manager
class SessionSecurityManager {
    constructor() {
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.warningTime = 5 * 60 * 1000; // 5 minutes before timeout
        this.initSessionSecurity();
    }

    initSessionSecurity() {
        this.setupSessionTimeout();
        this.setupActivityMonitoring();
        this.setupSecureSessionStorage();
    }

    setupSessionTimeout() {
        let lastActivity = Date.now();
        
        // Monitor user activity
        const resetTimer = () => {
            lastActivity = Date.now();
        };
        
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });
        
        // Check session timeout
        setInterval(() => {
            const timeSinceLastActivity = Date.now() - lastActivity;
            
            if (timeSinceLastActivity > this.sessionTimeout) {
                this.handleSessionTimeout();
            } else if (timeSinceLastActivity > this.sessionTimeout - this.warningTime) {
                this.showTimeoutWarning();
            }
        }, 60000); // Check every minute
    }

    setupActivityMonitoring() {
        // Monitor for suspicious session activities
        const activities = [];
        
        window.addEventListener('focus', () => {
            activities.push({ type: 'FOCUS', timestamp: Date.now() });
        });
        
        window.addEventListener('blur', () => {
            activities.push({ type: 'BLUR', timestamp: Date.now() });
        });
        
        // Monitor for session hijacking attempts
        const originalUserAgent = navigator.userAgent;
        setInterval(() => {
            if (navigator.userAgent !== originalUserAgent) {
                this.handlePotentialHijacking();
            }
        }, 30000);
    }

    setupSecureSessionStorage() {
        // Encrypt session data
        const originalSetItem = sessionStorage.setItem;
        const originalGetItem = sessionStorage.getItem;
        
        sessionStorage.setItem = (key, value) => {
            const encrypted = btoa(JSON.stringify({ value, timestamp: Date.now() }));
            return originalSetItem.call(sessionStorage, key, encrypted);
        };
        
        sessionStorage.getItem = (key) => {
            const encrypted = originalGetItem.call(sessionStorage, key);
            if (!encrypted) return null;
            
            try {
                const decrypted = JSON.parse(atob(encrypted));
                
                // Check if data is expired (24 hours)
                if (Date.now() - decrypted.timestamp > 24 * 60 * 60 * 1000) {
                    sessionStorage.removeItem(key);
                    return null;
                }
                
                return decrypted.value;
            } catch (error) {
                sessionStorage.removeItem(key);
                return null;
            }
        };
    }

    handleSessionTimeout() {
        // Clear all session data
        localStorage.removeItem('taskflow_token');
        sessionStorage.clear();
        
        // Show timeout message
        alert('Your session has expired due to inactivity. Please log in again.');
        
        // Redirect to login
        window.location.reload();
    }

    showTimeoutWarning() {
        const remaining = Math.ceil((this.sessionTimeout - (Date.now() - this.lastActivity)) / 60000);
        
        if (confirm(`Your session will expire in ${remaining} minutes. Do you want to extend it?`)) {
            // Extend session by making an API call
            fetch('/api/v2/auth/extend-session', {
                method: 'POST',
                credentials: 'include'
            });
        }
    }

    handlePotentialHijacking() {
        console.error('🚨 Potential session hijacking detected');
        
        // Force logout
        this.handleSessionTimeout();
    }
}

// Initialize security managers
const securityManager = new SecurityManager();
const sessionSecurityManager = new SessionSecurityManager();

// Export security functions
window.securityManager = securityManager;
window.sessionSecurityManager = sessionSecurityManager;

console.log('🛡️ Enhanced security features initialized');