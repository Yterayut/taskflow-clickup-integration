/**
 * Alert Rules Engine
 * Defines conditions and triggers for system alerts
 */

class AlertRules {
    constructor(alertManager) {
        this.alertManager = alertManager;
        this.rules = this.defineRules();
    }

    defineRules() {
        return [
            {
                name: 'High Response Time',
                condition: (metrics) => metrics.api?.averageResponseTime > 1000,
                severity: 'medium',
                message: (metrics) => `API response time is ${metrics.api.averageResponseTime}ms (threshold: 1000ms)`,
                cooldown: 300000 // 5 minutes
            },
            {
                name: 'Critical Response Time',
                condition: (metrics) => metrics.api?.averageResponseTime > 3000,
                severity: 'critical',
                message: (metrics) => `CRITICAL: API response time is ${metrics.api.averageResponseTime}ms`,
                cooldown: 60000 // 1 minute
            },
            {
                name: 'High CPU Usage',
                condition: (metrics) => metrics.system?.cpuUsage > 80,
                severity: 'high',
                message: (metrics) => `High CPU usage: ${metrics.system.cpuUsage}%`,
                cooldown: 600000 // 10 minutes
            },
            {
                name: 'High Memory Usage',
                condition: (metrics) => metrics.system?.memoryUsage > 90,
                severity: 'high',
                message: (metrics) => `High memory usage: ${metrics.system.memoryUsage}%`,
                cooldown: 300000 // 5 minutes
            },
            {
                name: 'API Failure Rate',
                condition: (metrics) => metrics.api?.successRate < 90,
                severity: 'high',
                message: (metrics) => `Low API success rate: ${metrics.api.successRate}%`,
                cooldown: 300000 // 5 minutes
            },
            {
                name: 'Token Expiry Warning',
                condition: (metrics) => metrics.application?.tokenExpiryMinutes < 60 && metrics.application?.tokenExpiryMinutes > 30,
                severity: 'medium',
                message: (metrics) => `OAuth token expires in ${metrics.application.tokenExpiryMinutes} minutes`,
                cooldown: 900000 // 15 minutes
            },
            {
                name: 'Token Expiry Critical',
                condition: (metrics) => metrics.application?.tokenExpiryMinutes <= 30,
                severity: 'critical',
                message: (metrics) => `CRITICAL: OAuth token expires in ${metrics.application.tokenExpiryMinutes} minutes`,
                cooldown: 300000 // 5 minutes
            },
            {
                name: 'Service Unavailable',
                condition: (metrics) => !metrics.application?.isOperational,
                severity: 'critical',
                message: () => 'Service is not operational',
                cooldown: 60000 // 1 minute
            }
        ];
    }

    evaluateRules(metrics) {
        const triggeredAlerts = [];
        
        for (const rule of this.rules) {
            try {
                if (rule.condition(metrics)) {
                    // Check cooldown
                    if (this.isInCooldown(rule.name)) {
                        continue;
                    }
                    
                    const message = rule.message(metrics);
                    const alertId = this.alertManager.createAlert(
                        rule.name,
                        rule.severity,
                        message,
                        { rule: rule.name, metrics }
                    );
                    
                    triggeredAlerts.push({
                        rule: rule.name,
                        alertId,
                        severity: rule.severity,
                        message
                    });
                    
                    // Set cooldown
                    this.setCooldown(rule.name, rule.cooldown);
                }
            } catch (error) {
                console.error(`Error evaluating rule ${rule.name}:`, error.message);
            }
        }
        
        return triggeredAlerts;
    }

    isInCooldown(ruleName) {
        const cooldownKey = `cooldown_${ruleName}`;
        const lastTriggered = this.lastTriggered?.[cooldownKey];
        return lastTriggered && (Date.now() - lastTriggered) < this.cooldowns?.[cooldownKey];
    }

    setCooldown(ruleName, duration) {
        if (!this.lastTriggered) this.lastTriggered = {};
        if (!this.cooldowns) this.cooldowns = {};
        
        const cooldownKey = `cooldown_${ruleName}`;
        this.lastTriggered[cooldownKey] = Date.now();
        this.cooldowns[cooldownKey] = duration;
    }
}

module.exports = { AlertRules };