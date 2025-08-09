/**
 * TaskFlow Pro SPA - API Service
 * v2.2.0 - Centralized API communication
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  ApiResponse, 
  PaginatedResponse, 
  User, 
  Task, 
  Team, 
  Project,
  DashboardData,
  LoginCredentials,
  LoginResponse,
  TaskFilter,
  ExportOptions 
} from '@types/index';

class ApiService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v2';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = this.getStoredToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();
        
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('API Response Error:', error.response?.data || error.message);
        
        // Handle 401 unauthorized
        if (error.response?.status === 401) {
          this.handleUnauthorized();
        }
        
        // Handle network errors
        if (!error.response) {
          this.handleNetworkError();
        }
        
        return Promise.reject(error);
      }
    );
  }

  private getStoredToken(): string | null {
    return localStorage.getItem('taskflow_token') || 
           sessionStorage.getItem('taskflow_token');
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleUnauthorized() {
    // Clear stored tokens
    localStorage.removeItem('taskflow_token');
    sessionStorage.removeItem('taskflow_token');
    
    // Redirect to login (handled by routing)
    window.location.href = '/login';
  }

  private handleNetworkError() {
    // Show network error notification
    console.error('Network error - please check your connection');
  }

  // Generic API methods
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.request<T>(config);
      return response.data;
    } catch (error: any) {
      throw this.transformError(error);
    }
  }

  private transformError(error: any): Error {
    if (error.response?.data?.error) {
      return new Error(error.response.data.error);
    }
    if (error.message) {
      return new Error(error.message);
    }
    return new Error('An unexpected error occurred');
  }

  // Authentication API
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return this.request<LoginResponse>({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
    });
  }

  async logout(): Promise<ApiResponse> {
    return this.request<ApiResponse>({
      method: 'POST',
      url: '/auth/logout',
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<ApiResponse<User>>({
      method: 'GET',
      url: '/auth/me',
    });
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    return this.request<ApiResponse<{ token: string }>>({
      method: 'POST',
      url: '/auth/refresh',
    });
  }

  // Dashboard API
  async getDashboardData(userRole?: string): Promise<ApiResponse<DashboardData>> {
    return this.request<ApiResponse<DashboardData>>({
      method: 'GET',
      url: '/dashboard',
      params: { role: userRole },
    });
  }

  // Tasks API
  async getTasks(filter?: TaskFilter): Promise<PaginatedResponse<Task>> {
    return this.request<PaginatedResponse<Task>>({
      method: 'GET',
      url: '/tasks',
      params: filter,
    });
  }

  async getTask(taskId: string): Promise<ApiResponse<Task>> {
    return this.request<ApiResponse<Task>>({
      method: 'GET',
      url: `/tasks/${taskId}`,
    });
  }

  async createTask(task: Partial<Task>): Promise<ApiResponse<Task>> {
    return this.request<ApiResponse<Task>>({
      method: 'POST',
      url: '/tasks',
      data: task,
    });
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<ApiResponse<Task>> {
    return this.request<ApiResponse<Task>>({
      method: 'PUT',
      url: `/tasks/${taskId}`,
      data: updates,
    });
  }

  async deleteTask(taskId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>({
      method: 'DELETE',
      url: `/tasks/${taskId}`,
    });
  }

  async assignTask(taskId: string, assigneeId: string): Promise<ApiResponse<Task>> {
    return this.request<ApiResponse<Task>>({
      method: 'PUT',
      url: `/tasks/${taskId}/assign`,
      data: { assigneeId },
    });
  }

  // Teams API
  async getTeams(): Promise<ApiResponse<Team[]>> {
    return this.request<ApiResponse<Team[]>>({
      method: 'GET',
      url: '/teams',
    });
  }

  async getTeam(teamId: string): Promise<ApiResponse<Team>> {
    return this.request<ApiResponse<Team>>({
      method: 'GET',
      url: `/teams/${teamId}`,
    });
  }

  async updateTeam(teamId: string, updates: Partial<Team>): Promise<ApiResponse<Team>> {
    return this.request<ApiResponse<Team>>({
      method: 'PUT',
      url: `/teams/${teamId}`,
      data: updates,
    });
  }

  async getTeamPerformance(teamId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>({
      method: 'GET',
      url: `/teams/${teamId}/performance`,
    });
  }

  // Users API
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.request<ApiResponse<User[]>>({
      method: 'GET',
      url: '/users',
    });
  }

  async getUser(userId: string): Promise<ApiResponse<User>> {
    return this.request<ApiResponse<User>>({
      method: 'GET',
      url: `/users/${userId}`,
    });
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<ApiResponse<User>> {
    return this.request<ApiResponse<User>>({
      method: 'PUT',
      url: `/users/${userId}`,
      data: updates,
    });
  }

  async createUser(user: Partial<User>): Promise<ApiResponse<User>> {
    return this.request<ApiResponse<User>>({
      method: 'POST',
      url: '/users',
      data: user,
    });
  }

  async deleteUser(userId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>({
      method: 'DELETE',
      url: `/users/${userId}`,
    });
  }

  // Projects API
  async getProjects(): Promise<ApiResponse<Project[]>> {
    return this.request<ApiResponse<Project[]>>({
      method: 'GET',
      url: '/projects',
    });
  }

  async getProject(projectId: string): Promise<ApiResponse<Project>> {
    return this.request<ApiResponse<Project>>({
      method: 'GET',
      url: `/projects/${projectId}`,
    });
  }

  async createProject(project: Partial<Project>): Promise<ApiResponse<Project>> {
    return this.request<ApiResponse<Project>>({
      method: 'POST',
      url: '/projects',
      data: project,
    });
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<ApiResponse<Project>> {
    return this.request<ApiResponse<Project>>({
      method: 'PUT',
      url: `/projects/${projectId}`,
      data: updates,
    });
  }

  async deleteProject(projectId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>({
      method: 'DELETE',
      url: `/projects/${projectId}`,
    });
  }

  // Analytics API
  async getAnalytics(type: 'personal' | 'team' | 'full', params?: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>({
      method: 'GET',
      url: `/analytics/${type}`,
      params,
    });
  }

  async getPerformanceReport(userId?: string, teamId?: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>({
      method: 'GET',
      url: '/analytics/performance',
      params: { userId, teamId },
    });
  }

  // Export API
  async exportData(type: 'tasks' | 'teams' | 'users', options: ExportOptions): Promise<ApiResponse<{ downloadUrl: string }>> {
    return this.request<ApiResponse<{ downloadUrl: string }>>({
      method: 'POST',
      url: `/export/${type}`,
      data: options,
    });
  }

  // Real-time API
  async triggerRealtimeUpdate(data: any): Promise<ApiResponse> {
    return this.request<ApiResponse>({
      method: 'POST',
      url: '/realtime/dashboard-update',
      data,
    });
  }

  // System API
  async getSystemHealth(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>({
      method: 'GET',
      url: '/system/health',
    });
  }

  async getSystemStatus(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>({
      method: 'GET',
      url: '/system/status',
    });
  }

  // Email API
  async sendTestEmail(to: string): Promise<ApiResponse> {
    return this.request<ApiResponse>({
      method: 'POST',
      url: '/email/test',
      data: { to },
    });
  }

  async getEmailStatus(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>({
      method: 'GET',
      url: '/email/status',
    });
  }

  // Security API
  async getSecurityStatus(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>({
      method: 'GET',
      url: '/security/status',
    });
  }

  async unlockAccount(email: string): Promise<ApiResponse> {
    return this.request<ApiResponse>({
      method: 'POST',
      url: `/security/unlock/${email}`,
    });
  }

  // Utility methods
  setAuthToken(token: string) {
    localStorage.setItem('taskflow_token', token);
  }

  clearAuthToken() {
    localStorage.removeItem('taskflow_token');
    sessionStorage.removeItem('taskflow_token');
  }

  getApiInfo() {
    return {
      baseURL: this.baseURL,
      version: '2.2.0',
      timestamp: new Date().toISOString(),
    };
  }
}

// Create and export singleton instance
export const apiService = new ApiService();
export default apiService;