import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// Core user management tables
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatar: text('avatar'),
  phone: text('phone'),
  timezone: text('timezone').default('UTC'),
  locale: text('locale').default('en'),
  status: text('status').default('active'), // active, inactive, suspended
  isEmailVerified: integer('is_email_verified', { mode: 'boolean' }).default(false),
  emailVerificationToken: text('email_verification_token'),
  passwordResetToken: text('password_reset_token'),
  passwordResetExpires: integer('password_reset_expires', { mode: 'timestamp' }),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  settings: text('settings', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
});

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').unique().notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  level: integer('level').notNull(), // 1-4 hierarchy level
  isSystemRole: integer('is_system_role', { mode: 'boolean' }).default(false),
  permissions: text('permissions', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const userRoles = sqliteTable('user_roles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  assignedBy: text('assigned_by').references(() => users.id),
  assignedAt: integer('assigned_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
});

// Team and organizational structure
export const teams = sqliteTable('teams', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  slug: text('slug').unique(),
  leaderId: text('leader_id').references(() => users.id),
  parentTeamId: text('parent_team_id').references(() => teams.id),
  color: text('color').default('#3B82F6'),
  avatar: text('avatar'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  settings: text('settings', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
});

export const teamMembers = sqliteTable('team_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').default('member'), // leader, member
  joinedAt: integer('joined_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  leftAt: integer('left_at', { mode: 'timestamp' }),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

// Project and task management
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  slug: text('slug').unique(),
  teamId: text('team_id').references(() => teams.id),
  managerId: text('manager_id').references(() => users.id),
  status: text('status').default('planning'), // planning, active, on_hold, completed, cancelled
  priority: text('priority').default('normal'), // low, normal, high, urgent
  startDate: integer('start_date', { mode: 'timestamp' }),
  endDate: integer('end_date', { mode: 'timestamp' }),
  budget: real('budget'),
  progressPercentage: integer('progress_percentage').default(0),
  clickupSpaceId: text('clickup_space_id'),
  clickupFolderId: text('clickup_folder_id'),
  settings: text('settings', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
});

export const taskStatuses = sqliteTable('task_statuses', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  color: text('color').notNull(),
  type: text('type').notNull(), // todo, in_progress, review, done, cancelled
  order: integer('order').notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  projectId: text('project_id').references(() => projects.id),
  parentTaskId: text('parent_task_id').references(() => tasks.id),
  statusId: text('status_id').references(() => taskStatuses.id),
  priority: text('priority').default('normal'), // low, normal, high, urgent
  reporterId: text('reporter_id').references(() => users.id),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  startDate: integer('start_date', { mode: 'timestamp' }),
  completedDate: integer('completed_date', { mode: 'timestamp' }),
  estimatedHours: real('estimated_hours'),
  actualHours: real('actual_hours'),
  storyPoints: integer('story_points'),
  progressPercentage: integer('progress_percentage').default(0),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  customFields: text('custom_fields', { mode: 'json' }).$type<Record<string, any>>(),
  
  // ClickUp integration fields
  clickupTaskId: text('clickup_task_id'),
  clickupListId: text('clickup_list_id'),
  clickupFolderId: text('clickup_folder_id'),
  clickupSpaceId: text('clickup_space_id'),
  clickupUrl: text('clickup_url'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
  syncStatus: text('sync_status').default('pending'), // pending, synced, error
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
});

export const taskAssignees = sqliteTable('task_assignees', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assignedBy: text('assigned_by').references(() => users.id),
  assignedAt: integer('assigned_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
});

export const taskComments = sqliteTable('task_comments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  parentCommentId: text('parent_comment_id').references(() => taskComments.id),
  isEdited: integer('is_edited', { mode: 'boolean' }).default(false),
  editedAt: integer('edited_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const taskAttachments = sqliteTable('task_attachments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  url: text('url').notNull(),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Attendance and time tracking
export const attendanceRecords = sqliteTable('attendance_records', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD format
  clockIn: integer('clock_in', { mode: 'timestamp' }),
  clockOut: integer('clock_out', { mode: 'timestamp' }),
  breakStart: integer('break_start', { mode: 'timestamp' }),
  breakEnd: integer('break_end', { mode: 'timestamp' }),
  totalHours: real('total_hours'),
  breakDuration: real('break_duration'),
  status: text('status').notNull(), // present, absent, late, half_day, leave
  leaveReference: text('leave_reference'),
  notes: text('notes'),
  location: text('location'),
  ipAddress: text('ip_address'),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const leaveRequests = sqliteTable('leave_requests', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  referenceNumber: text('reference_number').unique().notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // vacation, sick, personal, emergency
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  totalDays: real('total_days').notNull(),
  reason: text('reason'),
  status: text('status').default('pending'), // pending, approved, rejected, cancelled
  reviewerId: text('reviewer_id').references(() => users.id),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  reviewNotes: text('review_notes'),
  documents: text('documents', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Session and authentication
export const userSessions = sqliteTable('user_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: text('session_token').unique().notNull(),
  refreshToken: text('refresh_token').unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const oauthTokens = sqliteTable('oauth_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // clickup, google, etc.
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenType: text('token_type').default('Bearer'),
  scope: text('scope'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  providerUserId: text('provider_user_id'),
  providerUsername: text('provider_username'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Notifications
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: text('data', { mode: 'json' }).$type<Record<string, any>>(),
  priority: text('priority').default('normal'), // low, normal, high, urgent
  channels: text('channels', { mode: 'json' }).$type<string[]>(), // email, push, in_app
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  readAt: integer('read_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Reports and analytics
export const savedReports = sqliteTable('saved_reports', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // attendance, task, performance, custom
  config: text('config', { mode: 'json' }).notNull().$type<Record<string, any>>(),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  scheduleConfig: text('schedule_config', { mode: 'json' }).$type<Record<string, any>>(),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
});

// Audit and logging
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(), // create, update, delete, login, logout
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  oldValues: text('old_values', { mode: 'json' }).$type<Record<string, any>>(),
  newValues: text('new_values', { mode: 'json' }).$type<Record<string, any>>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  sessionId: text('session_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertTaskSchema = createInsertSchema(tasks);
export const selectTaskSchema = createSelectSchema(tasks);
export const insertTeamSchema = createInsertSchema(teams);
export const selectTeamSchema = createSelectSchema(teams);
export const insertAttendanceSchema = createInsertSchema(attendanceRecords);
export const selectAttendanceSchema = createSelectSchema(attendanceRecords);

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;