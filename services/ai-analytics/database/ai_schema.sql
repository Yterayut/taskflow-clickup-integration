-- TaskFlow Pro Phase 3 - AI Analytics Database Schema
-- Deploy Date: $(date)

-- Team Productivity Metrics
CREATE TABLE IF NOT EXISTS team_productivity_metrics (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    tasks_completed INTEGER DEFAULT 0,
    tasks_created INTEGER DEFAULT 0,
    average_completion_time INTERVAL,
    velocity_score DECIMAL(5,2),
    efficiency_rating DECIMAL(3,2),
    collaboration_index DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, date)
);

-- User Behavior Patterns
CREATE TABLE IF NOT EXISTS user_behavior_patterns (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    productive_hours JSONB,
    task_preferences JSONB,
    collaboration_score DECIMAL(5,2),
    focus_time_minutes INTEGER,
    interruption_count INTEGER,
    peak_performance_hour INTEGER,
    workload_balance DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- AI Predictions and Insights
CREATE TABLE IF NOT EXISTS ai_predictions (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    prediction_type VARCHAR(50) NOT NULL,
    predicted_value JSONB NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL,
    model_version VARCHAR(20) DEFAULT '3.0.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    actual_value JSONB,
    accuracy_score DECIMAL(3,2),
    feedback_provided BOOLEAN DEFAULT FALSE
);

-- Bottleneck Analysis
CREATE TABLE IF NOT EXISTS bottleneck_analysis (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(255) NOT NULL,
    bottleneck_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    affected_tasks JSONB,
    suggested_actions JSONB,
    impact_score DECIMAL(5,2),
    auto_detected BOOLEAN DEFAULT TRUE,
    identified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_notes TEXT
);

-- AI Model Performance Tracking
CREATE TABLE IF NOT EXISTS ai_model_performance (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    accuracy_score DECIMAL(5,4),
    precision_score DECIMAL(5,4),
    recall_score DECIMAL(5,4),
    f1_score DECIMAL(5,4),
    training_date TIMESTAMP,
    evaluation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_size INTEGER,
    training_time_seconds INTEGER,
    performance_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Smart Notifications Log
CREATE TABLE IF NOT EXISTS smart_notifications_log (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    notification_type VARCHAR(100) NOT NULL,
    content JSONB NOT NULL,
    priority_score DECIMAL(3,2),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    user_action VARCHAR(50),
    ai_decision_factors JSONB,
    channel VARCHAR(50) DEFAULT 'websocket'
);

-- Performance optimization indexes
CREATE INDEX IF NOT EXISTS idx_team_productivity_team_date ON team_productivity_metrics(team_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_user_behavior_user_date ON user_behavior_patterns(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_entity ON ai_predictions(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_type ON ai_predictions(prediction_type, expires_at);
CREATE INDEX IF NOT EXISTS idx_bottleneck_team_severity ON bottleneck_analysis(team_id, severity, identified_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_sent ON smart_notifications_log(user_id, sent_at DESC);

-- Useful views for quick analytics
CREATE OR REPLACE VIEW team_productivity_summary AS
SELECT 
    team_id,
    AVG(velocity_score) as avg_velocity,
    AVG(efficiency_rating) as avg_efficiency,
    AVG(collaboration_index) as avg_collaboration,
    COUNT(*) as data_points,
    MAX(date) as last_updated,
    MIN(date) as first_recorded
FROM team_productivity_metrics 
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY team_id;

CREATE OR REPLACE VIEW user_productivity_trends AS
SELECT 
    user_id,
    AVG(collaboration_score) as avg_collaboration,
    AVG(focus_time_minutes) as avg_focus_time,
    AVG(interruption_count) as avg_interruptions,
    AVG(workload_balance) as avg_workload_balance,
    MODE() WITHIN GROUP (ORDER BY peak_performance_hour) as optimal_hour,
    COUNT(*) as data_points
FROM user_behavior_patterns 
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id;

CREATE OR REPLACE VIEW active_bottlenecks AS
SELECT 
    team_id,
    bottleneck_type,
    severity,
    description,
    impact_score,
    identified_at,
    suggested_actions
FROM bottleneck_analysis 
WHERE resolved_at IS NULL 
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
    END,
    impact_score DESC;

-- Insert sample data for testing
INSERT INTO team_productivity_metrics (team_id, date, tasks_completed, tasks_created, velocity_score, efficiency_rating, collaboration_index)
VALUES 
    ('team_001', CURRENT_DATE - INTERVAL '1 day', 12, 15, 8.5, 0.84, 0.76),
    ('team_001', CURRENT_DATE - INTERVAL '2 days', 10, 12, 7.8, 0.81, 0.73),
    ('team_001', CURRENT_DATE - INTERVAL '3 days', 14, 16, 9.2, 0.88, 0.79)
ON CONFLICT (team_id, date) DO NOTHING;

INSERT INTO user_behavior_patterns (user_id, date, focus_time_minutes, peak_performance_hour, collaboration_score, interruption_count, workload_balance)
VALUES 
    ('user_001', CURRENT_DATE - INTERVAL '1 day', 245, 10, 0.82, 3, 0.75),
    ('user_001', CURRENT_DATE - INTERVAL '2 days', 220, 9, 0.78, 5, 0.71),
    ('user_002', CURRENT_DATE - INTERVAL '1 day', 280, 14, 0.91, 2, 0.89)
ON CONFLICT (user_id, date) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO taskflow_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskflow_user;

COMMENT ON TABLE team_productivity_metrics IS 'Stores daily productivity metrics for teams';
COMMENT ON TABLE user_behavior_patterns IS 'Tracks individual user behavior patterns for AI learning';
COMMENT ON TABLE ai_predictions IS 'Stores AI-generated predictions with confidence scores';
COMMENT ON TABLE bottleneck_analysis IS 'Identifies and tracks workflow bottlenecks';
COMMENT ON TABLE ai_model_performance IS 'Monitors AI model accuracy and performance over time';
COMMENT ON TABLE smart_notifications_log IS 'Logs all AI-filtered smart notifications';
