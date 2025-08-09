// Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  MANAGER = 'manager',
  TEAM_LEAD = 'team_lead',
  EMPLOYEE = 'employee'
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Task Types
export interface Task {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assignee?: User;
  reporterId: string;
  reporter?: User;
  teamId?: string;
  team?: Team;
  dueDate?: Date;
  startDate?: Date;
  completedDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
  subtasks: Task[];
  parentTaskId?: string;
  parentTask?: Task;
  clickupTaskId?: string;
  clickupListId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  DONE = 'done',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface TaskAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface TaskComment {
  id: string;
  content: string;
  authorId: string;
  author?: User;
  taskId: string;
  parentCommentId?: string;
  replies?: TaskComment[];
  createdAt: Date;
  updatedAt: Date;
}

// Team Types
export interface Team {
  id: string;
  name: string;
  description?: string;
  leadId: string;
  lead?: User;
  members: TeamMember[];
  projects: Project[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  userId: string;
  user?: User;
  teamId: string;
  team?: Team;
  role: TeamMemberRole;
  joinedAt: Date;
}

export enum TeamMemberRole {
  LEAD = 'lead',
  MEMBER = 'member'
}

// Project Types
export interface Project {
  id: string;
  name: string;
  description?: string;
  teamId: string;
  team?: Team;
  managerId: string;
  manager?: User;
  status: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  tasks: Task[];
  clickupSpaceId?: string;
  clickupFolderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// Attendance Types
export interface Attendance {
  id: string;
  userId: string;
  user?: User;
  date: Date;
  clockIn?: Date;
  clockOut?: Date;
  breakStart?: Date;
  breakEnd?: Date;
  totalHours?: number;
  status: AttendanceStatus;
  leaveReference?: string;
  notes?: string;
  location?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EARLY_LEAVE = 'early_leave',
  ON_LEAVE = 'on_leave',
  SICK_LEAVE = 'sick_leave',
  VACATION = 'vacation'
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// Filter Types
export interface TaskFilters extends PaginationParams {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assigneeId?: string[];
  teamId?: string[];
  dueDateFrom?: Date;
  dueDateTo?: Date;
  tags?: string[];
}

export interface UserFilters extends PaginationParams {
  role?: UserRole[];
  isActive?: boolean;
  teamId?: string[];
}

// Dashboard Types
export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  totalUsers: number;
  activeUsers: number;
  totalTeams: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  userId: string;
  user?: User;
  entityType: 'task' | 'project' | 'team' | 'user';
  entityId: string;
  entityName: string;
  action: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export enum ActivityType {
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_COMPLETED = 'task_completed',
  TASK_ASSIGNED = 'task_assigned',
  PROJECT_CREATED = 'project_created',
  PROJECT_UPDATED = 'project_updated',
  TEAM_CREATED = 'team_created',
  USER_JOINED = 'user_joined',
  ATTENDANCE_RECORDED = 'attendance_recorded'
}

// ClickUp Integration Types
export interface ClickUpConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl: string;
  authUrl: string;
}

export interface ClickUpToken {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  refreshToken?: string;
  scope?: string;
}

export interface ClickUpUser {
  id: string;
  username: string;
  email: string;
  color: string;
  profilePicture: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status: {
    status: string;
    color: string;
    type: string;
  };
  priority?: {
    priority: string;
    color: string;
  };
  assignees: ClickUpUser[];
  watchers: ClickUpUser[];
  creator: ClickUpUser;
  description?: string;
  dueDate?: string;
  startDate?: string;
  timeEstimate?: number;
  timeSpent?: number;
  customFields: any[];
  tags: string[];
  parent?: string;
  project: {
    id: string;
    name: string;
  };
  folder: {
    id: string;
    name: string;
  };
  space: {
    id: string;
    name: string;
  };
  list: {
    id: string;
    name: string;
  };
  url: string;
  dateCreated: string;
  dateUpdated: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: any;
  timestamp: Date;
  userId?: string;
}

export enum WebSocketMessageType {
  TASK_UPDATED = 'task_updated',
  TASK_ASSIGNED = 'task_assigned',
  USER_ONLINE = 'user_online',
  USER_OFFLINE = 'user_offline',
  NOTIFICATION = 'notification',
  ATTENDANCE_UPDATE = 'attendance_update'
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: Date;
}

export enum NotificationType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_DUE_SOON = 'task_due_soon',
  TASK_OVERDUE = 'task_overdue',
  MENTION = 'mention',
  SYSTEM = 'system',
  ATTENDANCE_REMINDER = 'attendance_reminder'
}