/**
 * Performance Monitor
 * Advanced performance analysis and optimization suggestions
 */

class PerformanceMonitor {
    constructor(metricsCollector) {
        this.metricsCollector = metricsCollector;
        this.performanceHistory = [];
        this.isMonitoring = false;
        
        this.thresholds = {
            responseTime: {
                excellent: 100,
                good: 300,
                fair: 1000,
                poor: 3000
            },
            cpuUsage: {
                excellent: 30,
                good: 50,
                fair: 70,
                poor: 90
            },
            memoryUsage: {
                excellent: 40,
                good: 60,
                fair: 80,
                poor: 95
            }
        };
    }

    start() {
        if (this.isMonitoring) return;
        
        console.log('🚀 Starting Performance Monitor...');
        this.isMonitoring = true;
        
        // Analyze performance every minute
        this.analysisInterval = setInterval(() => {
            this.analyzePerformance();
        }, 60000);
    }

    stop() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        this.isMonitoring = false;
        console.log('🛑 Performance Monitor stopped');
    }

    analyzePerformance() {
        try {
            const averageMetrics = this.metricsCollector.getAverageMetrics();
            if (!averageMetrics) return;
            
            const analysis = {
                timestamp: Date.now(),
                metrics: averageMetrics,
                grades: this.calculateGrades(averageMetrics),
                suggestions: this.generateSuggestions(averageMetrics),
                overall: this.calculateOverallPerformance(averageMetrics)
            };
            
            this.performanceHistory.push(analysis);
            
            // Keep only last 24 hours
            const cutoff = Date.now() - (24 * 60 * 60 * 1000);
            this.performanceHistory = this.performanceHistory.filter(a => a.timestamp > cutoff);
            
            // Log performance summary
            console.log(`🎯 Performance Analysis - Overall: ${analysis.overall.grade} (${analysis.overall.score}/100)`);
            
            // Alert on poor performance
            if (analysis.overall.score < 60) {
                console.warn('⚠️ Performance degradation detected!');
                analysis.suggestions.forEach(suggestion => {
                    console.warn('   📝', suggestion);
                });
            }
            
        } catch (error) {
            console.error('❌ Performance analysis failed:', error.message);
        }
    }

    calculateGrades(metrics) {
        return {
            responseTime: this.getGrade(metrics.responseTime, this.thresholds.responseTime, true),
            cpuUsage: this.getGrade(metrics.cpuUsage, this.thresholds.cpuUsage, false),
            memoryUsage: this.getGrade(metrics.memoryUsage, this.thresholds.memoryUsage, false),
            successRate: metrics.successRate >= 95 ? 'excellent' : 
                        metrics.successRate >= 90 ? 'good' :
                        metrics.successRate >= 80 ? 'fair' : 'poor'
        };
    }

    getGrade(value, thresholds, lowerIsBetter) {
        if (lowerIsBetter) {
            if (value <= thresholds.excellent) return 'excellent';
            if (value <= thresholds.good) return 'good';
            if (value <= thresholds.fair) return 'fair';
            return 'poor';
        } else {
            if (value >= thresholds.poor) return 'poor';
            if (value >= thresholds.fair) return 'fair';
            if (value >= thresholds.good) return 'good';
            return 'excellent';
        }
    }

    generateSuggestions(metrics) {
        const suggestions = [];
        
        if (metrics.responseTime > this.thresholds.responseTime.fair) {
            suggestions.push('Consider implementing request caching');
            suggestions.push('Optimize database queries');
            suggestions.push('Review API endpoint performance');
        }
        
        if (metrics.cpuUsage > this.thresholds.cpuUsage.fair) {
            suggestions.push('Monitor CPU-intensive operations');
            suggestions.push('Consider horizontal scaling');
            suggestions.push('Optimize algorithms and reduce computational complexity');
        }
        
        if (metrics.memoryUsage > this.thresholds.memoryUsage.fair) {
            suggestions.push('Review memory usage patterns');
            suggestions.push('Implement garbage collection optimization');
            suggestions.push('Consider memory leak detection');
        }
        
        if (metrics.successRate < 90) {
            suggestions.push('Investigate API failures');
            suggestions.push('Improve error handling');
            suggestions.push('Review network connectivity');
        }
        
        return suggestions;
    }

    calculateOverallPerformance(metrics) {
        const grades = this.calculateGrades(metrics);
        
        const scoreMap = {
            excellent: 100,
            good: 80,
            fair: 60,
            poor: 30
        };
        
        const scores = [
            scoreMap[grades.responseTime] || 0,
            scoreMap[grades.cpuUsage] || 0,
            scoreMap[grades.memoryUsage] || 0,
            scoreMap[grades.successRate] || 0
        ];
        
        const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
        
        const grade = averageScore >= 90 ? 'A+' :
                     averageScore >= 80 ? 'A' :
                     averageScore >= 70 ? 'B' :
                     averageScore >= 60 ? 'C' : 'D';
        
        return {
            score: averageScore,
            grade,
            components: grades
        };
    }

    getPerformanceReport() {
        const latest = this.performanceHistory[this.performanceHistory.length - 1];
        if (!latest) return null;
        
        return {
            current: latest,
            trend: this.calculateTrend(),
            recommendations: this.getTopRecommendations()
        };
    }

    calculateTrend() {
        if (this.performanceHistory.length < 2) return 'stable';
        
        const recent = this.performanceHistory.slice(-5); // Last 5 analyses
        const scores = recent.map(r => r.overall.score);
        
        const firstScore = scores[0];
        const lastScore = scores[scores.length - 1];
        
        const change = lastScore - firstScore;
        
        if (change > 10) return 'improving';
        if (change < -10) return 'degrading';
        return 'stable';
    }

    getTopRecommendations() {
        if (this.performanceHistory.length === 0) return [];
        
        const recent = this.performanceHistory.slice(-3);
        const allSuggestions = recent.flatMap(r => r.suggestions);
        
        // Count frequency of suggestions
        const suggestionCounts = {};
        allSuggestions.forEach(suggestion => {
            suggestionCounts[suggestion] = (suggestionCounts[suggestion] || 0) + 1;
        });
        
        // Return top 3 most frequent suggestions
        return Object.entries(suggestionCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([suggestion]) => suggestion);
    }
}

module.exports = { PerformanceMonitor };