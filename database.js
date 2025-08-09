const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'taskflow.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database with tables
function initializeDatabase() {
    // Create employees table
    db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        skills TEXT,
        role TEXT DEFAULT 'Employee',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating employees table:', err.message);
        } else {
            console.log('✅ Employees table ready');
        }
    });

    // Create task_scores table
    db.run(`CREATE TABLE IF NOT EXISTS task_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        task_name TEXT,
        employee_email TEXT NOT NULL,
        quality_score INTEGER CHECK(quality_score >= 1 AND quality_score <= 5),
        complexity_factor REAL DEFAULT 1.0,
        time_bonus INTEGER DEFAULT 0,
        teamwork_points INTEGER DEFAULT 0,
        penalty INTEGER DEFAULT 0,
        total_score REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_email) REFERENCES employees (email)
    )`, (err) => {
        if (err) {
            console.error('Error creating task_scores table:', err.message);
        } else {
            console.log('✅ Task scores table ready');
        }
    });

    // Create attendance table
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_email TEXT NOT NULL,
        employee_name TEXT,
        date DATE NOT NULL,
        check_in_time TIME,
        check_out_time TIME,
        leave_type TEXT,
        leave_reference TEXT,
        leave_reason TEXT,
        status TEXT NOT NULL DEFAULT 'present',
        approved_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_email) REFERENCES employees (email),
        UNIQUE(employee_email, date)
    )`, (err) => {
        if (err) {
            console.error('Error creating attendance table:', err.message);
        } else {
            console.log('✅ Attendance table ready');
        }
    });

    // Create leaderboard_settings table
    db.run(`CREATE TABLE IF NOT EXISTS leaderboard_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_name TEXT UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        setting_type TEXT DEFAULT 'number',
        description TEXT,
        updated_by TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating leaderboard_settings table:', err.message);
        } else {
            console.log('✅ Leaderboard settings table ready');
            insertDefaultSettings();
        }
    });
}

// Insert default leaderboard settings
function insertDefaultSettings() {
    const defaultSettings = [
        {
            name: 'base_task_score',
            value: '10',
            type: 'number', 
            description: 'Base points per completed task'
        },
        {
            name: 'complexity_easy',
            value: '1.0',
            type: 'number',
            description: 'Complexity multiplier for easy tasks'
        },
        {
            name: 'complexity_medium', 
            value: '1.5',
            type: 'number',
            description: 'Complexity multiplier for medium tasks'
        },
        {
            name: 'complexity_hard',
            value: '2.0', 
            type: 'number',
            description: 'Complexity multiplier for hard tasks'
        },
        {
            name: 'time_bonus_ontime',
            value: '3',
            type: 'number',
            description: 'Bonus points for on-time delivery'
        },
        {
            name: 'time_penalty_late',
            value: '-2',
            type: 'number', 
            description: 'Penalty points for late delivery'
        },
        {
            name: 'teamwork_bonus',
            value: '2',
            type: 'number',
            description: 'Bonus points per teamwork contribution'
        },
        {
            name: 'quality_penalty_reject',
            value: '-5',
            type: 'number',
            description: 'Penalty for rejected work'
        },
        {
            name: 'error_penalty_major',
            value: '-10',
            type: 'number',
            description: 'Penalty for major errors'
        }
    ];

    defaultSettings.forEach(setting => {
        db.run(
            `INSERT OR IGNORE INTO leaderboard_settings (setting_name, setting_value, setting_type, description, updated_by) 
             VALUES (?, ?, ?, ?, ?)`,
            [setting.name, setting.value, setting.type, setting.description, 'system'],
            (err) => {
                if (err) {
                    console.error(`Error inserting setting ${setting.name}:`, err.message);
                }
            }
        );
    });
    console.log('✅ Default leaderboard settings initialized');
}

// Helper functions for database operations
const dbHelpers = {
    // Get all employees
    getEmployees: (callback) => {
        db.all("SELECT * FROM employees ORDER BY name", callback);
    },

    // Add/Update employee
    upsertEmployee: (email, name, skills, role, callback) => {
        db.run(
            `INSERT OR REPLACE INTO employees (email, name, skills, role, updated_at) 
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [email, name, skills, role],
            callback
        );
    },

    // Get task scores for leaderboard
    getTaskScores: (callback) => {
        db.all(
            `SELECT employee_email, employee_name, 
                    COUNT(*) as completed_tasks,
                    AVG(quality_score) as avg_quality,
                    SUM(total_score) as total_points
             FROM task_scores 
             GROUP BY employee_email, employee_name
             ORDER BY total_points DESC`,
            callback
        );
    },

    // Add task score
    addTaskScore: (taskId, taskName, employeeEmail, qualityScore, complexityFactor, timeBonus, teamworkPoints, penalty, callback) => {
        // Calculate total score using the formula
        const totalScore = (10 * complexityFactor * (qualityScore / 5)) + timeBonus + teamworkPoints - penalty;
        
        db.run(
            `INSERT INTO task_scores 
             (task_id, task_name, employee_email, quality_score, complexity_factor, time_bonus, teamwork_points, penalty, total_score) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [taskId, taskName, employeeEmail, qualityScore, complexityFactor, timeBonus, teamworkPoints, penalty, totalScore],
            callback
        );
    },

    // Get attendance records
    getAttendance: (startDate, endDate, callback) => {
        let query = "SELECT * FROM attendance";
        let params = [];
        
        if (startDate && endDate) {
            query += " WHERE date BETWEEN ? AND ?";
            params = [startDate, endDate];
        }
        
        query += " ORDER BY date DESC, employee_name";
        
        db.all(query, params, callback);
    },

    // Add attendance record
    addAttendance: (employeeEmail, employeeName, date, checkIn, checkOut, leaveType, leaveRef, leaveReason, status, callback) => {
        db.run(
            `INSERT OR REPLACE INTO attendance 
             (employee_email, employee_name, date, check_in_time, check_out_time, leave_type, leave_reference, leave_reason, status, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [employeeEmail, employeeName, date, checkIn, checkOut, leaveType, leaveRef, leaveReason, status],
            callback
        );
    },

    // Get leaderboard settings
    getLeaderboardSettings: (callback) => {
        db.all("SELECT * FROM leaderboard_settings ORDER BY setting_name", callback);
    },

    // Update leaderboard setting
    updateLeaderboardSetting: (settingName, settingValue, updatedBy, callback) => {
        db.run(
            `UPDATE leaderboard_settings 
             SET setting_value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE setting_name = ?`,
            [settingValue, updatedBy, settingName],
            callback
        );
    }
};

module.exports = {
    db,
    dbHelpers
};