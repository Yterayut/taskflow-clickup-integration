/**
 * TaskFlow Pro SPA - Type Definitions
 * v2.2.0 - Comprehensive type system
 */

// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  phone?: string;
  location?: string;
  joinDate?: string;
  status: UserStatus;
  avatar?: string;
  capabilities: string[];
}

export type UserRole = 'master' | 'manager' | 'team_lead' | 'employee';

export type UserStatus = 'active' | 'inactive' | 'locked' | 'pending';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponse {
  success: boolean;
  user: User;
  token: string;
  message?: string;
}

// Task Types
export interface Task {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: User;
  assigneeId: string;
  startDate?: string;
  dueDate?: string;
  completedDate?: string;
  tags: string[];
  project?: Project;
  projectId?: string;
  timeTracked?: number;
  estimatedTime?: number;
  attachments: Attachment[];
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  progress: number;
}

export type TaskStatus = 
  | 'todo' 
  | 'in_progress' 
  | 'review' 
  | 'done' 
  | 'cancelled' 
  | 'blocked';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskFilter {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assignee?: string[];
  project?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  tags?: string[];
  search?: string;
}

export interface TaskAnalytics {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
  averageCompletionTime: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
}

// Team Types
export interface Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  lead: User;
  leadId: string;
  department: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  performance: TeamPerformance;
}

export interface TeamMember {
  user: User;
  userId: string;
  role: 'lead' | 'member';
  joinDate: string;
  status: 'active' | 'inactive';
  permissions: string[];
}

export interface TeamPerformance {
  score: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  tasksCompleted: number;
  completionRate: number;
  averageTaskTime: number;
  efficiency: number;
  rank: number;
  totalTeams: number;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  budget?: number;
  spentBudget?: number;
  team: Team;
  teamId: string;
  tasks: Task[];
  progress: number;
  owner: User;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';

// Dashboard Types
export interface DashboardData {
  user: User;
  overview: DashboardOverview;
  tasks: Task[];
  recentActivity: Activity[];
  analytics: TaskAnalytics;
  notifications: Notification[];
}

export interface DashboardOverview {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  productivity: number;
  teamRank?: number;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  user: User;
  userId: string;
  metadata?: Record<string, any>;
}

export type ActivityType = 
  | 'task_created'
  | 'task_completed'
  | 'task_updated'
  | 'task_assigned'
  | 'project_created'
  | 'team_updated'
  | 'user_joined'
  | 'comment_added';

// Notification Types
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, any>;
}

export type NotificationType = 
  | 'task_assigned'
  | 'task_due'
  | 'task_completed'
  | 'team_update'
  | 'system_alert'
  | 'security_alert'
  | 'performance_report';

// Real-time Types
export interface RealtimeMessage {
  type: RealtimeMessageType;
  data: any;
  timestamp: string;
  from?: string;
}

export type RealtimeMessageType = 
  | 'welcome'
  | 'authenticated'
  | 'dashboard_update'
  | 'task_update'
  | 'notification'
  | 'user_activity'
  | 'system_alert'
  | 'ping'
  | 'pong';

export interface RealtimeConnection {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastConnected: string | null;
  retryCount: number;
}

// API Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'select' | 'textarea' | 'date' | 'number';
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[];
  validation?: any;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

// UI State Types
export interface UIState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  loading: Record<string, boolean>;
  modals: Record<string, boolean>;
  notifications: Notification[];
}

// Common Types
export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Comment {
  id: string;
  content: string;
  author: User;
  authorId: string;
  createdAt: string;
  updatedAt?: string;
  mentions: string[];
  attachments: Attachment[];
}

// Export/Import Types
export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  dateRange?: {
    start: string;
    end: string;
  };
  includeFields: string[];
  filters?: any;
}

export interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
}