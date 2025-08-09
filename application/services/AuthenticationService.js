/**
 * Authentication Application Service
 * Orchestrates authentication workflows for both master and regular users
 */
const { Email } = require('../../domain/value-objects/Email');
const { User } = require('../../domain/entities/User');
const { ClickUpToken } = require('../../domain/entities/ClickUpToken');
const {
    SystemNotReadyError,
    InvalidCredentialsError,
    UserNotFoundError,
    OAuthError,
    UnauthorizedUserError
} = require('../errors/AuthenticationErrors');

class AuthenticationService {
    constructor({
        userRepository,
        tokenRepository,
        clickupIntegration,
        jwtService,
        systemService,
        accountSecurityService = null
    }) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.clickupIntegration = clickupIntegration;
        this.jwtService = jwtService;
        this.systemService = systemService;
        this.accountSecurityService = accountSecurityService;
    }
    
    /**
     * Main login method - routes to appropriate authentication flow
     */
    async login(emailValue, password, rememberMe = false, req = null) {
        try {
            const email = new Email(emailValue);
            
            if (email.isMaster()) {
                return await this.handleMasterUserLogin(emailValue, password, rememberMe, req);
            } else {
                return await this.authenticateRegularUser(email, password, rememberMe, req);
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Handle master user login with OAuth setup state awareness
     */
    async handleMasterUserLogin(email, password, rememberMe = false) {
        const user = await this.userRepository.findByEmail(email);
        
        if (!user) {
            throw new UserNotFoundError('Master user not found');
        }

        console.log('🔐 Master user login attempt:', {
            email,
            requiresOAuth: user.requiresOAuthSetup(),
            canUseLocal: user.canUseLocalAuth(),
            oauthStatus: user.getOAuthSetupStatus()
        });

        // Check if OAuth setup is required (first time)
        if (user.requiresOAuthSetup()) {
            console.log('⚠️ OAuth setup required for master user');
            return {
                status: 'oauth_setup_required',
                redirectUrl: this.generateOAuthUrl(),
                message: 'First time login - ClickUp OAuth setup required',
                userId: user.id,
                requiresOAuth: true
            };
        }

        // OAuth setup is complete, use local authentication with stored tokens
        if (user.canUseLocalAuth()) {
            console.log('✅ Using local authentication for master user');
            const result = await this.authenticateLocalUser(user, password, rememberMe);
            
            // Load stored ClickUp tokens for the authenticated session
            const storedTokens = await this.getStoredClickUpTokens(user.id);
            if (storedTokens) {
                console.log('🔑 Loaded stored ClickUp tokens for session');
                // Update system status with token info if systemService is available
                try {
                    if (this.systemService && this.systemService.updateStatus) {
                        await this.systemService.updateStatus({
                            clickupConnected: true,
                            lastTokenRefresh: storedTokens.setupCompletedAt,
                            masterTokenExpiresAt: null, // Permanent tokens
                            lastHealthCheck: new Date()
                        });
                        console.log('✅ System status updated with stored tokens');
                    }
                } catch (error) {
                    console.warn('⚠️ Could not update system status:', error.message);
                    // Don't fail authentication if system status update fails
                }
            }
            
            return {
                ...result,
                hasStoredTokens: !!storedTokens,
                clickupIntegrationStatus: storedTokens ? 'active' : 'inactive'
            };
        }

        throw new Error('Invalid authentication state for master user');
    }

    /**
     * Complete OAuth setup for master user
     */
    async completeOAuthSetup(userId, tokens, userInfo) {
        const user = await this.userRepository.findById(userId);
        
        if (!user || !user.isMaster()) {
            throw new Error('OAuth setup can only be completed for master users');
        }

        console.log('🔐 Completing OAuth setup for master user:', {
            userId,
            email: user.email.toString(),
            hasTokens: !!tokens
        });

        // Store permanent tokens with enhanced metadata
        const storedToken = await this.storePermanentTokens(userId, tokens, userInfo);
        console.log('✅ Permanent tokens stored:', { tokenId: storedToken.id });
        
        // Mark OAuth setup as complete
        user.completeOAuthSetup();
        await this.userRepository.save(user);
        console.log('✅ OAuth setup marked as completed in user record');

        // Update system status to reflect ClickUp connection
        try {
            if (this.systemService && this.systemService.updateStatus) {
                await this.systemService.updateStatus({
                    clickupConnected: true,
                    lastTokenRefresh: new Date(),
                    masterTokenExpiresAt: null, // Permanent tokens don't expire
                    lastHealthCheck: new Date()
                });
                console.log('✅ System status updated');
            }
        } catch (error) {
            console.warn('⚠️ Could not update system status:', error.message);
            // Don't fail OAuth setup if system status update fails
        }

        // Generate JWT for dashboard access with enhanced claims
        const jwtToken = this.jwtService.generateToken({
            userId: user.id,
            email: user.email.toString(),
            role: user.role.toString(),
            capabilities: user.getCapabilities(),
            displayName: user.role.getDisplayName(),
            fullName: user.fullName,
            oauthSetupCompleted: true
        }, '24h');

        return {
            success: true,
            status: 'oauth_setup_complete',
            token: jwtToken,
            user: user.toSafeObject(),
            redirectUrl: '/?login=success&setup=complete',
            message: 'OAuth setup completed successfully. You can now login with email/password.'
        };
    }

    /**
     * Check OAuth setup status for master user
     */
    async checkOAuthSetupStatus(email) {
        const user = await this.userRepository.findByEmail(email);
        
        if (!user || !user.isMaster()) {
            return { isCompleted: false, exists: false };
        }

        return {
            isCompleted: !user.requiresOAuthSetup(),
            exists: true,
            setupInfo: user.getOAuthSetupStatus()
        };
    }
    
    /**
     * Authenticate regular user with email/password + account lockout protection
     */
    async authenticateRegularUser(email, password, rememberMe, req = null) {
        const emailStr = email.toString();
        
        // 🛡️ SECURITY: Check account lockout status
        if (this.accountSecurityService) {
            const lockStatus = await this.accountSecurityService.isAccountLocked(emailStr);
            
            if (lockStatus.isLocked) {
                const minutesRemaining = lockStatus.lockoutInfo?.minutesRemaining || 0;
                throw new InvalidCredentialsError(
                    `Account is locked due to too many failed login attempts. Please try again in ${minutesRemaining} minutes.`,
                    { 
                        isLocked: true, 
                        minutesRemaining,
                        lockoutCount: lockStatus.lockoutInfo?.lockoutCount || 0
                    }
                );
            }
            
            console.log(`🛡️ Account security check for ${emailStr}:`, {
                needsCaptcha: lockStatus.needsCaptcha,
                remainingAttempts: lockStatus.remainingAttempts
            });
        }
        
        // Find user
        const user = await this.userRepository.findByEmail(emailStr);
        if (!user) {
            // 🛡️ SECURITY: Record failed attempt even for non-existent users
            if (this.accountSecurityService && req) {
                await this.accountSecurityService.recordFailedLoginAttempt(
                    emailStr,
                    req.ip || req.connection?.remoteAddress,
                    req.get('User-Agent')
                );
            }
            throw new UserNotFoundError('Invalid email or password');
        }
        
        // Authenticate user
        const isValidPassword = await user.authenticate(password);
        if (!isValidPassword) {
            // 🛡️ SECURITY: Record failed login attempt
            if (this.accountSecurityService && req) {
                const lockResult = await this.accountSecurityService.recordFailedLoginAttempt(
                    emailStr,
                    req.ip || req.connection?.remoteAddress,
                    req.get('User-Agent')
                );
                
                if (lockResult.isLocked) {
                    throw new InvalidCredentialsError(
                        `Too many failed login attempts. Account locked for ${lockResult.lockoutDurationMinutes} minutes.`,
                        { 
                            isLocked: true, 
                            lockoutDurationMinutes: lockResult.lockoutDurationMinutes,
                            lockoutCount: lockResult.lockoutCount
                        }
                    );
                } else {
                    const remainingAttempts = lockResult.maxAttempts - lockResult.failedAttempts;
                    throw new InvalidCredentialsError(
                        `Invalid password. ${remainingAttempts} attempts remaining before account lockout.`,
                        { 
                            failedAttempts: lockResult.failedAttempts,
                            remainingAttempts,
                            needsCaptcha: lockResult.needsCaptcha
                        }
                    );
                }
            }
            
            throw new InvalidCredentialsError('Invalid email or password');
        }
        
        // 🛡️ SECURITY: Record successful login (resets failed attempts)
        if (this.accountSecurityService && req) {
            await this.accountSecurityService.recordSuccessfulLogin(
                emailStr,
                req.ip || req.connection?.remoteAddress,
                req.get('User-Agent')
            );
        }
        
        // Update last login
        user.updateLastLogin();
        await this.userRepository.save(user);
        
        // Generate JWT with enhanced claims
        const expiresIn = rememberMe ? '30d' : '24h';
        const tokenPayload = {
            userId: user.id,
            email: user.email.toString(),
            role: user.role.toString(),
            capabilities: user.getCapabilities(),
            displayName: user.role.getDisplayName()
        };
        const token = this.jwtService.generateToken(tokenPayload, expiresIn);
        
        return {
            success: true,
            requiresOAuth: false,
            token,
            user: user.toSafeObject()
        };
    }
    
    /**
     * Authenticate user locally (for all users including master after OAuth setup)
     */
    async authenticateLocalUser(user, password, rememberMe = false) {
        // Verify password
        const isPasswordValid = await user.authenticate(password);
        if (!isPasswordValid) {
            throw new InvalidCredentialsError('Invalid password');
        }

        // Update last login
        user.updateLastLogin();
        await this.userRepository.save(user);

        // Generate JWT with enhanced claims
        const expiresIn = rememberMe ? '30d' : '24h';
        const tokenPayload = {
            userId: user.id,
            email: user.email.toString(),
            role: user.role.toString(),
            capabilities: user.getCapabilities(),
            displayName: user.role.getDisplayName()
        };
        const token = this.jwtService.generateToken(tokenPayload, expiresIn);

        return {
            success: true,
            status: 'authenticated',
            token,
            user: user.toSafeObject()
        };
    }

    /**
     * Store permanent tokens for master user with enhanced metadata
     */
    async storePermanentTokens(userId, tokens, userInfo = null) {
        const tokenEntity = new ClickUpToken({
            userId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: null, // Never expires for permanent tokens
            tokenType: tokens.token_type || 'Bearer',
            scope: tokens.scope,
            isPermanent: true,
            setupCompletedAt: new Date(),
            metadata: userInfo ? {
                clickup_user_id: userInfo.user?.id,
                clickup_email: userInfo.user?.email,
                clickup_username: userInfo.user?.username,
                workspace_count: userInfo.teams?.length || 0,
                setup_timestamp: new Date().toISOString()
            } : null
        });

        console.log('💾 Storing permanent ClickUp tokens:', {
            userId,
            tokenType: tokenEntity.tokenType,
            hasRefreshToken: !!tokenEntity.refreshToken,
            isPermanent: tokenEntity.isPermanent,
            metadata: tokenEntity.metadata
        });

        return await this.tokenRepository.storePermanent(tokenEntity);
    }

    /**
     * Get stored ClickUp tokens for master user
     */
    async getStoredClickUpTokens(userId) {
        try {
            const tokens = await this.tokenRepository.findActiveTokensByUser(userId);
            if (tokens && tokens.length > 0) {
                // Return the most recent permanent token
                const permanentToken = tokens.find(t => t.isPermanent) || tokens[0];
                console.log('🔑 Retrieved stored ClickUp tokens:', {
                    userId,
                    tokenId: permanentToken.id,
                    isPermanent: permanentToken.isPermanent,
                    hasRefreshToken: !!permanentToken.refreshToken
                });
                return permanentToken;
            }
            return null;
        } catch (error) {
            console.error('Error retrieving stored tokens:', error);
            return null;
        }
    }

    /**
     * Generate OAuth URL for setup
     */
    generateOAuthUrl() {
        return this.clickupIntegration.getAuthorizationUrl();
    }

    /**
     * Initiate OAuth flow for master user (legacy method for backward compatibility)
     */
    initiateOAuthFlow() {
        const authUrl = this.generateOAuthUrl();
        
        return {
            success: true,
            requiresOAuth: true,
            redirect: true,
            location: authUrl
        };
    }
    
    /**
     * Complete OAuth flow after callback
     */
    async completeOAuthFlow(code, state) {
        try {
            // Validate OAuth state (CSRF protection)
            if (!this.clickupIntegration.validateState(state)) {
                throw new OAuthError('Invalid OAuth state parameter');
            }
            
            // Exchange code for tokens
            const tokenData = await this.clickupIntegration.exchangeCodeForTokens(code);
            
            // Get user info from ClickUp to verify master user
            const userInfo = await this.clickupIntegration.getUserInfo(tokenData.access_token);
            if (!this.clickupIntegration.validateMasterUser(userInfo)) {
                throw new UnauthorizedUserError('Only the master user can authenticate via ClickUp OAuth');
            }
            
            return await this.completeOAuthFlowWithTokens(tokenData, userInfo, state);
        } catch (error) {
            console.error('OAuth flow error:', error);
            throw error;
        }
    }

    /**
     * Complete OAuth flow with pre-exchanged tokens (prevents duplicate token exchange)
     */
    async completeOAuthFlowWithTokens(tokenData, userInfo, state) {
        try {
            // Validate OAuth state (CSRF protection)
            if (!this.clickupIntegration.validateState(state)) {
                throw new OAuthError('Invalid OAuth state parameter');
            }
            
            // Validate master user (already done in route, but double-check)
            if (!this.clickupIntegration.validateMasterUser(userInfo)) {
                throw new UnauthorizedUserError('Only the master user can authenticate via ClickUp OAuth');
            }
            
            // Find master user in database
            const masterUser = await this.userRepository.findByEmail(process.env.MASTER_USER_EMAIL);
            if (!masterUser) {
                throw new UserNotFoundError('Master user not found in database');
            }
            
            // Create and save ClickUp token
            const clickupToken = ClickUpToken.fromOAuthResponse(masterUser.id, tokenData);
            await this.tokenRepository.save(clickupToken);
            
            // Update system status
            await this.systemService.updateStatus({
                clickup_connected: true,
                last_token_refresh: new Date(),
                master_token_expires_at: clickupToken.expiresAt
            });
            
            // Update master user last login
            masterUser.updateLastLogin();
            await this.userRepository.save(masterUser);
            
            // Generate JWT for master user with enhanced claims
            const tokenPayload = {
                userId: masterUser.id,
                email: masterUser.email.toString(),
                role: masterUser.role.toString(),
                capabilities: masterUser.getCapabilities(),
                displayName: masterUser.role.getDisplayName()
            };
            const token = this.jwtService.generateToken(tokenPayload, '24h');
            
            return {
                success: true,
                user: {
                    id: masterUser.id,
                    email: masterUser.email.toString(),
                    role: masterUser.role.toString(),
                    displayName: masterUser.role.getDisplayName(),
                    capabilities: masterUser.getCapabilities()
                },
                token,
                clickup_connected: true
            };
        } catch (error) {
            console.error('OAuth flow with tokens error:', error);
            throw error;
        }
    }
    
    /**
     * Logout user
     */
    async logout(userId) {
        // For now, we just rely on client-side cookie clearing
        // In the future, we could implement token blacklisting
        return {
            success: true,
            message: 'Logged out successfully'
        };
    }
    
    /**
     * Verify JWT token
     */
    async verifyToken(token) {
        try {
            const payload = this.jwtService.verifyToken(token);
            
            // Optional: Check if user still exists and is active
            const user = await this.userRepository.findById(payload.sub);
            if (!user || !user.isActive) {
                throw new Error('User not found or inactive');
            }
            
            return {
                success: true,
                user: user.toSafeObject()
            };
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
    
    /**
     * Refresh JWT token
     */
    async refreshToken(token) {
        try {
            const payload = this.jwtService.verifyToken(token);
            const user = await this.userRepository.findById(payload.sub);
            
            if (!user || !user.isActive) {
                throw new Error('User not found or inactive');
            }
            
            const newToken = this.jwtService.generateToken(user, '24h');
            
            return {
                success: true,
                token: newToken,
                user: user.toSafeObject()
            };
        } catch (error) {
            throw new Error('Failed to refresh token');
        }
    }
    
    /**
     * Change user password
     */
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new UserNotFoundError('User not found');
        }
        
        await user.changePassword(currentPassword, newPassword);
        await this.userRepository.save(user);
        
        return {
            success: true,
            message: 'Password changed successfully'
        };
    }
    
    /**
     * Get user profile with role and permissions
     */
    async getUserProfile(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new UserNotFoundError('User not found');
        }
        
        return {
            user: user.toSafeObject(),
            capabilities: user.getCapabilities(),
            navigation: user.role.getNavigationComponents(),
            displayName: user.role.getDisplayName()
        };
    }
    
    /**
     * Get role-based dashboard configuration
     */
    async getDashboardConfig(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new UserNotFoundError('User not found');
        }
        
        const role = user.role;
        const capabilities = role.getCapabilities();
        const navigation = role.getNavigationComponents();
        
        return {
            role: role.toString(),
            displayName: role.getDisplayName(),
            navigation,
            capabilities,
            defaultComponent: this.getDefaultComponent(role),
            theme: 'default'
        };
    }
    
    /**
     * Get default component for role
     */
    getDefaultComponent(role) {
        switch (role.toString()) {
            case 'master':
            case 'manager':
                return 'Dashboard';
            case 'team_lead':
                return 'My Team Dashboard';
            case 'employee':
                return 'My Dashboard';
            default:
                return 'Dashboard';
        }
    }
}

module.exports = { AuthenticationService };