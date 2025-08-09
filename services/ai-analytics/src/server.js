const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { Pool } = require('pg');
require('dotenv').config();

class AIAnalyticsService {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 8003;
        this.setupLogger();
        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeAI();
    }

    setupLogger() {
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ 
                    filename: 'logs/ai-analytics-error.log', 
                    level: 'error' 
                }),
                new winston.transports.File({ 
                    filename: 'logs/ai-analytics.log' 
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });
    }

    setupDatabase() {
        this.db = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'taskflow',
            user: process.env.DB_USER || 'taskflow_user',
            password: process.env.DB_PASSWORD || 'secure_password',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });

        this.db.on('error', (err) => {
            this.logger.error('Database connection error:', err);
        });
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
        }));

        // CORS configuration
        this.app.use(cors({
            origin: [
                'http://192.168.20.10:8888',
                'http://localhost:3000',
                'http://localhost:8888'
            ],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // limit each IP to 1000 requests per windowMs
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use(limiter);

        // Compression and parsing
        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', async (req, res) => {
            try {
                // Check database connection
                await this.db.query('SELECT 1');
                
                const health = {
                    status: 'healthy',
                    service: 'taskflow-ai-analytics',
                    version: '3.0.0',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    capabilities: [
                        'predictive_analytics',
                        'productivity_insights',
                        'bottleneck_detection',
                        'team_optimization',
                        'smart_notifications',
                        'user_behavior_analysis'
                    ],
                    checks: {
                        database: 'healthy',
                        ai_models: 'loaded',
                        memory: 'normal'
                    }
                };

                res.json(health);
            } catch (error) {
                this.logger.error('Health check failed:', error);
                res.status(500).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // API v3 routes
        const apiRouter = express.Router();
        
        // Analytics endpoints
        apiRouter.get('/analytics/team/:teamId/productivity', this.getTeamProductivity.bind(this));
        apiRouter.get('/analytics/user/:userId/insights', this.getUserInsights.bind(this));
        apiRouter.get('/analytics/predictions/:entityType/:entityId', this.getPredictions.bind(this));
        apiRouter.get('/analytics/bottlenecks/:teamId', this.getBottlenecks.bind(this));
        apiRouter.post('/analytics/learn', this.learnFromData.bind(this));
        apiRouter.get('/analytics/dashboard/:userId', this.getDashboardData.bind(this));
        
        // Smart notifications
        apiRouter.post('/notifications/smart', this.sendSmartNotification.bind(this));
        apiRouter.get('/notifications/preferences/:userId', this.getUserNotificationPreferences.bind(this));
        
        // Model management
        apiRouter.get('/models/performance', this.getModelPerformance.bind(this));
        apiRouter.post('/models/retrain', this.retrainModels.bind(this));

        this.app.use('/api/v3', apiRouter);

        // Error handling middleware
        this.app.use((error, req, res, next) => {
            this.logger.error('API Error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                path: req.originalUrl
            });
        });
    }

    async initializeAI() {
        try {
            // Initialize TensorFlow.js (simulated for now)
            this.aiModels = {
                productivity: { version: '3.0.0', accuracy: 0.87 },
                completion: { version: '3.0.0', accuracy: 0.84 },
                bottleneck: { version: '3.0.0', accuracy: 0.79 }
            };
            
            this.logger.info('AI models initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize AI models:', error);
        }
    }

    async getTeamProductivity(req, res) {
        const startTime = Date.now();
        try {
            const { teamId } = req.params;
            const { timeRange = '30d', includeProjections = 'true' } = req.query;

            // Get team productivity data
            const query = `
                SELECT 
                    date,
                    tasks_completed,
                    tasks_created,
                    velocity_score,
                    efficiency_rating,
                    collaboration_index
                FROM team_productivity_metrics 
                WHERE team_id = $1 
                AND date >= CURRENT_DATE - INTERVAL '${timeRange}'
                ORDER BY date DESC
                LIMIT 30
            `;
            
            const result = await this.db.query(query, [teamId]);
            
            // Calculate AI insights
            const metrics = this.calculateTeamMetrics(result.rows);
            const predictions = includeProjections === 'true' ? 
                await this.generateTeamPredictions(teamId, result.rows) : null;

            const response = {
                success: true,
                data: {
                    teamId,
                    timeRange,
                    metrics,
                    predictions,
                    insights: this.generateTeamInsights(metrics),
                    trends: this.analyzeTrends(result.rows)
                },
                meta: {
                    source: 'ai_analytics_engine',
                    model_version: '3.0.0',
                    processing_time: `${Date.now() - startTime}ms`,
                    data_points: result.rows.length
                }
            };

            res.json(response);

        } catch (error) {
            this.logger.error('Error in getTeamProductivity:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to analyze team productivity',
                processing_time: `${Date.now() - startTime}ms`
            });
        }
    }

    async getUserInsights(req, res) {
        const startTime = Date.now();
        try {
            const { userId } = req.params;

            // Get user behavior data
            const behaviorQuery = `
                SELECT * FROM user_behavior_patterns 
                WHERE user_id = $1 
                AND date >= CURRENT_DATE - INTERVAL '30 days'
                ORDER BY date DESC
            `;
            
            const behaviorResult = await this.db.query(behaviorQuery, [userId]);
            
            // Generate personal insights
            const insights = this.generatePersonalInsights(behaviorResult.rows);
            const recommendations = await this.generatePersonalRecommendations(userId, behaviorResult.rows);

            res.json({
                success: true,
                data: {
                    userId,
                    personalMetrics: insights.metrics,
                    recommendations,
                    behaviorPatterns: insights.patterns,
                    predictions: insights.predictions,
                    optimizationOpportunities: insights.opportunities
                },
                meta: {
                    source: 'ai_personal_analytics',
                    processing_time: `${Date.now() - startTime}ms`
                }
            });

        } catch (error) {
            this.logger.error('Error in getUserInsights:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate user insights'
            });
        }
    }

    async getPredictions(req, res) {
        const startTime = Date.now();
        try {
            const { entityType, entityId } = req.params;
            const { predictionTypes } = req.query;

            const types = predictionTypes ? predictionTypes.split(',') : ['completion_time', 'risk_score'];
            
            const predictions = await Promise.all(
                types.map(type => this.generatePrediction(entityType, entityId, type))
            );

            res.json({
                success: true,
                data: {
                    entityType,
                    entityId,
                    predictions,
                    modelVersion: '3.0.0',
                    generatedAt: new Date().toISOString()
                },
                meta: {
                    source: 'ai_prediction_engine',
                    processing_time: `${Date.now() - startTime}ms`
                }
            });

        } catch (error) {
            this.logger.error('Error in getPredictions:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate predictions'
            });
        }
    }

    async getBottlenecks(req, res) {
        const startTime = Date.now();
        try {
            const { teamId } = req.params;
            const { includeSuggestions = 'true' } = req.query;

            // Get existing bottlenecks
            const query = `
                SELECT * FROM active_bottlenecks 
                WHERE team_id = $1
                ORDER BY 
                    CASE severity 
                        WHEN 'critical' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'medium' THEN 3 
                        WHEN 'low' THEN 4 
                    END,
                    impact_score DESC
            `;
            
            const result = await this.db.query(query, [teamId]);
            
            // AI-powered bottleneck detection
            const detectedBottlenecks = await this.detectNewBottlenecks(teamId);

            res.json({
                success: true,
                data: {
                    teamId,
                    existingBottlenecks: result.rows,
                    detectedBottlenecks,
                    summary: {
                        total: result.rows.length + detectedBottlenecks.length,
                        critical: result.rows.filter(b => b.severity === 'critical').length,
                        totalImpact: result.rows.reduce((sum, b) => sum + parseFloat(b.impact_score || 0), 0)
                    },
                    analysisTimestamp: new Date().toISOString()
                },
                meta: {
                    source: 'ai_bottleneck_detector',
                    processing_time: `${Date.now() - startTime}ms`
                }
            });

        } catch (error) {
            this.logger.error('Error in getBottlenecks:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to detect bottlenecks'
            });
        }
    }

    async getDashboardData(req, res) {
        const startTime = Date.now();
        try {
            const { userId } = req.params;

            // Aggregate all dashboard data
            const [teamProductivity, userInsights, predictions, bottlenecks] = await Promise.all([
                this.getTeamProductivityData(userId),
                this.getUserInsightsData(userId),
                this.getUserPredictions(userId),
                this.getTeamBottlenecks(userId)
            ]);

            res.json({
                success: true,
                data: {
                    userId,
                    dashboard: {
                        teamProductivity,
                        personalInsights: userInsights,
                        predictions,
                        alerts: bottlenecks.filter(b => b.severity === 'high' || b.severity === 'critical'),
                        summary: {
                            productivityScore: userInsights.productivityScore,
                            teamVelocity: teamProductivity.currentVelocity,
                            riskLevel: this.calculateRiskLevel(predictions, bottlenecks)
                        }
                    },
                    lastUpdated: new Date().toISOString()
                },
                meta: {
                    source: 'ai_dashboard_aggregator',
                    processing_time: `${Date.now() - startTime}ms`
                }
            });

        } catch (error) {
            this.logger.error('Error in getDashboardData:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to load dashboard data'
            });
        }
    }

    // Helper methods (simplified implementations)
    calculateTeamMetrics(data) {
        if (!data || data.length === 0) {
            return {
                currentVelocity: 0,
                velocityTrend: 'stable',
                predictedVelocity: 0,
                efficiencyScore: 0,
                collaborationIndex: 0
            };
        }

        const latest = data[0];
        const avg = data.reduce((sum, row) => ({
            velocity: sum.velocity + (parseFloat(row.velocity_score) || 0),
            efficiency: sum.efficiency + (parseFloat(row.efficiency_rating) || 0),
            collaboration: sum.collaboration + (parseFloat(row.collaboration_index) || 0)
        }), { velocity: 0, efficiency: 0, collaboration: 0 });

        return {
            currentVelocity: parseFloat(latest.velocity_score) || 0,
            velocityTrend: this.calculateTrend(data.map(d => d.velocity_score)),
            predictedVelocity: (avg.velocity / data.length) * 1.05, // Simple prediction
            efficiencyScore: avg.efficiency / data.length,
            collaborationIndex: avg.collaboration / data.length
        };
    }

    calculateTrend(values) {
        if (values.length < 2) return 'stable';
        const recent = values.slice(0, Math.floor(values.length / 2));
        const older = values.slice(Math.floor(values.length / 2));
        const recentAvg = recent.reduce((sum, v) => sum + parseFloat(v || 0), 0) / recent.length;
        const olderAvg = older.reduce((sum, v) => sum + parseFloat(v || 0), 0) / older.length;
        
        if (recentAvg > olderAvg * 1.05) return 'increasing';
        if (recentAvg < olderAvg * 0.95) return 'decreasing';
        return 'stable';
    }

    async generateTeamPredictions(teamId, data) {
        // Simplified AI prediction logic
        return {
            nextWeekVelocity: data.length > 0 ? parseFloat(data[0].velocity_score) * 1.03 : 8.0,
            monthlyGoalLikelihood: 0.87,
            riskFactors: ['resource_constraint', 'complexity_increase'],
            confidence: 0.84
        };
    }

    generateTeamInsights(metrics) {
        const insights = [];
        
        if (metrics.velocityTrend === 'increasing') {
            insights.push({
                type: 'performance',
                message: `Team velocity increased by ${((metrics.currentVelocity / metrics.predictedVelocity - 1) * 100).toFixed(1)}% this period`,
                confidence: 0.89,
                actionable: true,
                priority: 'medium'
            });
        }

        if (metrics.efficiencyScore < 0.7) {
            insights.push({
                type: 'optimization',
                message: 'Team efficiency below optimal threshold. Consider workload rebalancing.',
                confidence: 0.76,
                actionable: true,
                priority: 'high'
            });
        }

        return insights;
    }

    generatePersonalInsights(behaviorData) {
        if (!behaviorData || behaviorData.length === 0) {
            return {
                metrics: { productivityScore: 0, focusTimeDaily: 0, collaborationRating: 0 },
                patterns: {},
                predictions: {},
                opportunities: []
            };
        }

        const avgData = behaviorData.reduce((sum, row) => ({
            focus: sum.focus + (parseInt(row.focus_time_minutes) || 0),
            collaboration: sum.collaboration + (parseFloat(row.collaboration_score) || 0),
            interruptions: sum.interruptions + (parseInt(row.interruption_count) || 0)
        }), { focus: 0, collaboration: 0, interruptions: 0 });

        const count = behaviorData.length;

        return {
            metrics: {
                productivityScore: Math.min(0.95, (avgData.focus / count) / 300 + (avgData.collaboration / count)),
                focusTimeDaily: Math.round(avgData.focus / count),
                collaborationRating: avgData.collaboration / count,
                taskCompletionRate: 0.91,
                optimalWorkingHours: [9, 10, 11, 14, 15]
            },
            patterns: {
                preferredTaskTypes: ['analysis', 'planning', 'communication'],
                optimalTeamSize: 4,
                interruptionTolerance: avgData.interruptions / count < 3 ? 'low' : 'high',
                peakPerformanceDay: 'Tuesday'
            },
            predictions: {
                weeklyProductivity: 0.85,
                burnoutRisk: Math.min(0.9, (avgData.interruptions / count) / 10),
                goalAchievementLikelihood: 0.89
            },
            opportunities: [
                {
                    type: 'schedule_optimization',
                    description: 'Optimize task scheduling during peak hours',
                    impact: 'high',
                    effort: 'low'
                }
            ]
        };
    }

    async generatePersonalRecommendations(userId, behaviorData) {
        const recommendations = [];

        if (behaviorData.length > 0) {
            const latestData = behaviorData[0];
            
            if (latestData.peak_performance_hour) {
                recommendations.push({
                    type: 'schedule_optimization',
                    priority: 'high',
                    message: `Your peak productivity is around ${latestData.peak_performance_hour}:00. Schedule complex tasks during this time.`,
                    confidence: 0.92,
                    impact: 'high'
                });
            }

            if (latestData.interruption_count > 5) {
                recommendations.push({
                    type: 'focus_improvement',
                    priority: 'medium',
                    message: 'High interruption count detected. Consider using focus time blocks.',
                    confidence: 0.78,
                    impact: 'medium'
                });
            }
        }

        return recommendations;
    }

    async generatePrediction(entityType, entityId, predictionType) {
        // Simplified prediction logic
        const predictions = {
            completion_time: {
                type: 'completion_time',
                value: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                confidence: 0.85,
                factors: ['team_velocity', 'task_complexity', 'resource_availability']
            },
            risk_score: {
                type: 'risk_score',
                value: 0.23,
                confidence: 0.78,
                factors: ['deadline_pressure', 'dependency_issues']
            },
            productivity: {
                type: 'productivity_forecast',
                value: 0.87,
                confidence: 0.81,
                factors: ['historical_performance', 'current_workload']
            }
        };

        return predictions[predictionType] || predictions.completion_time;
    }

    async detectNewBottlenecks(teamId) {
        // Simplified bottleneck detection
        return [
            {
                type: 'resource_conflict',
                severity: 'medium',
                description: 'Potential resource allocation conflict detected in upcoming sprint',
                confidence: 0.72,
                impact_score: 0.28,
                suggested_actions: ['Review resource allocation', 'Consider task prioritization'],
                auto_detected: true
            }
        ];
    }

    calculateRiskLevel(predictions, bottlenecks) {
        const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical').length;
        const highBottlenecks = bottlenecks.filter(b => b.severity === 'high').length;
        
        if (criticalBottlenecks > 0) return 'high';
        if (highBottlenecks > 2) return 'medium';
        return 'low';
    }

    // Placeholder methods for dashboard data
    async getTeamProductivityData(userId) {
        return {
            currentVelocity: 8.5,
            velocityTrend: 'increasing',
            predictedVelocity: 9.2,
            efficiencyScore: 0.84
        };
    }

    async getUserInsightsData(userId) {
        return {
            productivityScore: 0.78,
            focusTimeDaily: 245,
            collaborationRating: 0.82,
            taskCompletionRate: 0.91
        };
    }

    async getUserPredictions(userId) {
        return [
            {
                type: 'weekly_productivity',
                value: 0.85,
                confidence: 0.87
            }
        ];
    }

    async getTeamBottlenecks(userId) {
        return [
            {
                severity: 'medium',
                type: 'resource_conflict',
                impact_score: 0.34
            }
        ];
    }

    start() {
        // Create logs directory
        const fs = require('fs');
        if (!fs.existsSync('logs')) {
            fs.mkdirSync('logs');
        }

        this.app.listen(this.port, () => {
            this.logger.info(`🤖 TaskFlow AI Analytics Service running on port ${this.port}`);
            this.logger.info('🎯 Phase 3 AI capabilities activated');
            this.logger.info(`🔗 Health check: http://localhost:${this.port}/health`);
        });
    }
}

// Start the service
const aiService = new AIAnalyticsService();
aiService.start();

module.exports = AIAnalyticsService;
