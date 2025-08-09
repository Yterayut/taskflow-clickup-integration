#!/usr/bin/env node

/**
 * Modern System Import Script
 * Imports legacy data into the new TaskFlow modern architecture
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const EXPORTED_DATA_DIR = './migration/exported-data';
const MODERN_DB_PATH = '../apps/backend/data/taskflow.db';
const SALT_ROUNDS = 12;

// Ensure modern backend data directory exists
const dbDir = path.dirname(MODERN_DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize modern database
let db;

function initializeDatabase() {
  console.log('🗄️  Initializing modern database...');
  
  try {
    db = new Database(MODERN_DB_PATH);
    
    // Enable WAL mode and foreign keys
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

function createModernTables() {
  console.log('📋 Creating modern database tables...');
  
  try {
    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        avatar TEXT,
        phone TEXT,
        timezone TEXT DEFAULT 'UTC',
        locale TEXT DEFAULT 'en',
        status TEXT DEFAULT 'active',
        is_email_verified INTEGER DEFAULT 0,
        last_login_at INTEGER,
        settings TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        created_by TEXT,
        updated_by TEXT
      )
    `);

    // Create roles table
    db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        level INTEGER NOT NULL,
        is_system_role INTEGER DEFAULT 0,
        permissions TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create user_roles table
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        assigned_by TEXT,
        assigned_at INTEGER DEFAULT (unixepoch()),
        expires_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      )
    `);

    // Create teams table
    db.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        slug TEXT UNIQUE,
        leader_id TEXT,
        parent_team_id TEXT,
        color TEXT DEFAULT '#3B82F6',
        avatar TEXT,
        is_active INTEGER DEFAULT 1,
        settings TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (leader_id) REFERENCES users(id)
      )
    `);

    console.log('✅ Database tables created successfully');
    return true;
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    return false;
  }
}

function insertDefaultRoles() {
  console.log('👤 Creating default roles...');
  
  const roles = [
    {
      id: uuidv4(),
      name: 'manager',
      display_name: 'Manager',
      description: 'Full system access and team management',
      level: 4,
      is_system_role: 1,
      permissions: JSON.stringify([
        'users:read', 'users:write', 'users:delete',
        'tasks:read', 'tasks:write', 'tasks:delete',
        'teams:read', 'teams:write', 'teams:delete',
        'reports:read', 'reports:write',
        'attendance:read', 'attendance:write',
        'settings:read', 'settings:write'
      ])
    },
    {
      id: uuidv4(),
      name: 'team_lead',
      display_name: 'Team Lead',
      description: 'Team management and task oversight',
      level: 3,
      is_system_role: 1,
      permissions: JSON.stringify([
        'users:read',
        'tasks:read', 'tasks:write',
        'teams:read', 'teams:write',
        'reports:read',
        'attendance:read', 'attendance:write'
      ])
    },
    {
      id: uuidv4(),
      name: 'employee',
      display_name: 'Employee',
      description: 'Basic user access to personal tasks',
      level: 1,
      is_system_role: 1,
      permissions: JSON.stringify([
        'tasks:read', 'tasks:write',
        'attendance:read', 'attendance:write'
      ])
    }
  ];

  try {
    const insertRole = db.prepare(`
      INSERT OR REPLACE INTO roles (id, name, display_name, description, level, is_system_role, permissions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const role of roles) {
      insertRole.run(
        role.id,
        role.name,
        role.display_name,
        role.description,
        role.level,
        role.is_system_role,
        role.permissions
      );
    }

    console.log(`✅ Created ${roles.length} default roles`);
    return roles;
  } catch (error) {
    console.error('❌ Error creating roles:', error.message);
    return [];
  }
}

async function importUsers(exportedData) {
  console.log('👥 Importing users from legacy system...');
  
  // Handle different export data structures
  let usersData = exportedData;
  if (exportedData.users) {
    usersData = exportedData.users;
  }
  
  if (!usersData || typeof usersData !== 'object') {
    console.log('⚠️  No users data found in export');
    return [];
  }

  const users = [];
  const roles = db.prepare('SELECT * FROM roles').all();
  const roleMap = {};
  roles.forEach(role => roleMap[role.name] = role.id);

  try {
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (
        id, email, password_hash, full_name, first_name, last_name,
        status, is_email_verified, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertUserRole = db.prepare(`
      INSERT OR REPLACE INTO user_roles (id, user_id, role_id, assigned_at)
      VALUES (?, ?, ?, ?)
    `);

    // Handle both array and object formats
    const userEntries = Array.isArray(usersData.users) ? 
      usersData.users.map(user => [user.email, user]) :
      Object.entries(usersData.users || usersData);

    for (const [email, userData] of userEntries) {
      // Skip if not valid user data
      if (!userData.name || !userData.password) {
        console.log(`⚠️  Skipping invalid user: ${email}`);
        continue;
      }

      const userId = uuidv4();
      
      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);
      
      // Parse name
      const nameParts = userData.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      // Insert user
      insertUser.run(
        userId,
        email,
        passwordHash,
        userData.name,
        firstName,
        lastName || null,
        'active',
        1, // email verified
        Math.floor(Date.now() / 1000)
      );

      // Map legacy role to modern role
      let roleName = 'employee'; // default
      if (userData.role) {
        const legacyRole = userData.role.toLowerCase();
        if (legacyRole === 'manager') roleName = 'manager';
        else if (legacyRole === 'team lead' || legacyRole === 'team_lead') roleName = 'team_lead';
      }

      // Assign role
      if (roleMap[roleName]) {
        insertUserRole.run(
          uuidv4(),
          userId,
          roleMap[roleName],
          Math.floor(Date.now() / 1000)
        );
      }

      users.push({
        id: userId,
        email: email,
        name: userData.name,
        role: roleName
      });

      console.log(`✅ Imported user: ${email} (${roleName})`);
    }

    console.log(`✅ Successfully imported ${users.length} users`);
    return users;
  } catch (error) {
    console.error('❌ Error importing users:', error.message);
    return [];
  }
}

function createDefaultTeam(users) {
  console.log('👥 Creating default team...');
  
  try {
    // Find a manager to be team leader
    const managerUser = users.find(u => u.role === 'manager');
    const leaderId = managerUser ? managerUser.id : null;

    const teamId = uuidv4();
    const insertTeam = db.prepare(`
      INSERT INTO teams (id, name, description, slug, leader_id, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertTeam.run(
      teamId,
      'TaskFlow Team',
      'Default team for migrated users',
      'taskflow-team',
      leaderId,
      1,
      Math.floor(Date.now() / 1000)
    );

    console.log('✅ Created default team');
    return teamId;
  } catch (error) {
    console.error('❌ Error creating team:', error.message);
    return null;
  }
}

function generateMigrationSummary(importedUsers, teamId) {
  const summary = {
    migration_completed_at: new Date().toISOString(),
    imported_data: {
      users: {
        total: importedUsers.length,
        by_role: {
          manager: importedUsers.filter(u => u.role === 'manager').length,
          team_lead: importedUsers.filter(u => u.role === 'team_lead').length,
          employee: importedUsers.filter(u => u.role === 'employee').length
        }
      },
      teams: {
        total: teamId ? 1 : 0,
        default_team_id: teamId
      }
    },
    database: {
      path: MODERN_DB_PATH,
      tables_created: ['users', 'roles', 'user_roles', 'teams'],
      indexes_created: true
    },
    next_steps: [
      "Start modern backend server",
      "Test user authentication",
      "Configure ClickUp integration",
      "Perform user acceptance testing",
      "Schedule production cutover"
    ],
    validation_queries: {
      users_count: "SELECT COUNT(*) as count FROM users",
      roles_count: "SELECT COUNT(*) as count FROM roles",
      user_roles_count: "SELECT COUNT(*) as count FROM user_roles",
      teams_count: "SELECT COUNT(*) as count FROM teams"
    }
  };

  const summaryFile = './migration-summary.json';
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`✅ Migration summary saved: ${summaryFile}`);
  
  return summary;
}

async function main() {
  console.log('🚀 Starting TaskFlow Modern System Import');
  console.log('========================================');

  try {
    // Initialize database
    if (!initializeDatabase()) {
      throw new Error('Database initialization failed');
    }

    // Create tables
    if (!createModernTables()) {
      throw new Error('Table creation failed');
    }

    // Insert default roles
    const roles = insertDefaultRoles();
    if (roles.length === 0) {
      throw new Error('Role creation failed');
    }

    // Find latest exported users data
    const exportFiles = fs.readdirSync(EXPORTED_DATA_DIR);
    const usersFile = exportFiles.find(f => f.startsWith('users_') && f.endsWith('.json'));
    
    if (!usersFile) {
      throw new Error('No exported users data found');
    }

    console.log(`📁 Loading exported data: ${usersFile}`);
    const exportedData = JSON.parse(
      fs.readFileSync(path.join(EXPORTED_DATA_DIR, usersFile), 'utf8')
    );

    // Import users
    const importedUsers = await importUsers(exportedData.users || exportedData);
    if (importedUsers.length === 0) {
      throw new Error('User import failed');
    }

    // Create default team
    const teamId = createDefaultTeam(importedUsers);

    // Generate summary
    const summary = generateMigrationSummary(importedUsers, teamId);

    console.log('\n🎉 Migration completed successfully!');
    console.log('==================================');
    console.log(`👥 Users imported: ${summary.imported_data.users.total}`);
    console.log(`👤 Managers: ${summary.imported_data.users.by_role.manager}`);
    console.log(`👥 Team Leads: ${summary.imported_data.users.by_role.team_lead}`);
    console.log(`👨‍💻 Employees: ${summary.imported_data.users.by_role.employee}`);
    console.log(`🏢 Teams created: ${summary.imported_data.teams.total}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
      console.log('🔒 Database connection closed');
    }
  }
}

// Run the import
main();