/**
 * TaskFlow Pro SPA - Dashboard Slice
 * v2.2.0 - Dashboard data and analytics state management
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { DashboardData, DashboardOverview, Activity, TaskAnalytics } from '@types/index';
import { apiService } from '@services/api';

interface DashboardState {
  data: DashboardData | null;
  overview: DashboardOverview | null;
  recentActivity: Activity[];
  analytics: TaskAnalytics | null;
  isLoading: boolean;
  lastUpdated: string | null;
  error: string | null;
  autoRefresh: boolean;
  refreshInterval: number;
}

// Initial state
const initialState: DashboardState = {
  data: null,
  overview: null,
  recentActivity: [],
  analytics: null,
  isLoading: false,
  lastUpdated: null,
  error: null,
  autoRefresh: true,
  refreshInterval: 30000, // 30 seconds
};

// Async thunks
export const fetchDashboardData = createAsyncThunk(
  'dashboard/fetchDashboardData',
  async (userRole?: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getDashboardData(userRole);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch dashboard data');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchAnalytics = createAsyncThunk(
  'dashboard/fetchAnalytics',
  async (params: { type: 'personal' | 'team' | 'full'; [key: string]: any }, { rejectWithValue }) => {
    try {
      const response = await apiService.getAnalytics(params.type, params);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch analytics');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const refreshDashboard = createAsyncThunk(
  'dashboard/refreshDashboard',
  async (userRole?: string, { dispatch }) => {
    // Trigger both dashboard data and analytics refresh
    const dashboardPromise = dispatch(fetchDashboardData(userRole));
    const analyticsPromise = dispatch(fetchAnalytics({ type: 'full' }));
    
    await Promise.all([dashboardPromise, analyticsPromise]);
    return new Date().toISOString();
  }
);

// Dashboard slice
const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    // Manual data updates
    updateOverview: (state, action: PayloadAction<Partial<DashboardOverview>>) => {
      if (state.overview) {
        state.overview = { ...state.overview, ...action.payload };
      }
    },
    addRecentActivity: (state, action: PayloadAction<Activity>) => {
      state.recentActivity.unshift(action.payload);
      
      // Keep only last 20 activities
      if (state.recentActivity.length > 20) {
        state.recentActivity = state.recentActivity.slice(0, 20);
      }
      
      state.lastUpdated = new Date().toISOString();
    },
    updateActivity: (state, action: PayloadAction<Activity>) => {
      const index = state.recentActivity.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.recentActivity[index] = action.payload;
      }
    },
    removeActivity: (state, action: PayloadAction<string>) => {
      state.recentActivity = state.recentActivity.filter(a => a.id !== action.payload);
    },
    
    // Real-time updates
    updateTaskCount: (state, action: PayloadAction<{ type: 'total' | 'completed' | 'inProgress' | 'overdue'; count: number }>) => {
      if (state.overview) {
        const { type, count } = action.payload;
        switch (type) {
          case 'total':
            state.overview.totalTasks = count;
            break;
          case 'completed':
            state.overview.completedTasks = count;
            break;
          case 'inProgress':
            state.overview.inProgressTasks = count;
            break;
          case 'overdue':
            state.overview.overdueTasks = count;
            break;
        }
        
        // Recalculate completion rate
        if (state.overview.totalTasks > 0) {
          state.overview.completionRate = (state.overview.completedTasks / state.overview.totalTasks) * 100;
        }
        
        state.lastUpdated = new Date().toISOString();
      }
    },
    
    // Settings
    setAutoRefresh: (state, action: PayloadAction<boolean>) => {
      state.autoRefresh = action.payload;
    },
    setRefreshInterval: (state, action: PayloadAction<number>) => {
      state.refreshInterval = action.payload;
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
    
    // Reset
    resetDashboard: (state) => {
      state.data = null;
      state.overview = null;
      state.recentActivity = [];
      state.analytics = null;
      state.error = null;
      state.lastUpdated = null;
    },
    
    // Real-time data merge
    mergeDashboardUpdate: (state, action: PayloadAction<Partial<DashboardData>>) => {
      if (state.data) {
        state.data = { ...state.data, ...action.payload };
        
        if (action.payload.overview) {
          state.overview = action.payload.overview;
        }
        
        if (action.payload.recentActivity) {
          // Merge activities, avoiding duplicates
          const existingIds = new Set(state.recentActivity.map(a => a.id));
          const newActivities = action.payload.recentActivity.filter(a => !existingIds.has(a.id));
          state.recentActivity = [...newActivities, ...state.recentActivity].slice(0, 20);
        }
        
        if (action.payload.analytics) {
          state.analytics = action.payload.analytics;
        }
        
        state.lastUpdated = new Date().toISOString();
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch dashboard data
    builder
      .addCase(fetchDashboardData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload;
        state.overview = action.payload.overview;
        state.recentActivity = action.payload.recentActivity || [];
        state.analytics = action.payload.analytics;
        state.lastUpdated = new Date().toISOString();
        state.error = null;
      })
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch analytics
    builder
      .addCase(fetchAnalytics.pending, (state) => {
        // Don't set loading for analytics to avoid UI flicker
      })
      .addCase(fetchAnalytics.fulfilled, (state, action) => {
        state.analytics = action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchAnalytics.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Refresh dashboard
    builder
      .addCase(refreshDashboard.fulfilled, (state, action) => {
        state.lastUpdated = action.payload;
      });
  },
});

// Actions
export const {
  updateOverview,
  addRecentActivity,
  updateActivity,
  removeActivity,
  updateTaskCount,
  setAutoRefresh,
  setRefreshInterval,
  clearError,
  resetDashboard,
  mergeDashboardUpdate,
} = dashboardSlice.actions;

// Selectors
export const selectDashboardData = (state: { dashboard: DashboardState }) => state.dashboard.data;
export const selectDashboardOverview = (state: { dashboard: DashboardState }) => state.dashboard.overview;
export const selectRecentActivity = (state: { dashboard: DashboardState }) => state.dashboard.recentActivity;
export const selectDashboardAnalytics = (state: { dashboard: DashboardState }) => state.dashboard.analytics;
export const selectDashboardLoading = (state: { dashboard: DashboardState }) => state.dashboard.isLoading;
export const selectDashboardError = (state: { dashboard: DashboardState }) => state.dashboard.error;
export const selectLastUpdated = (state: { dashboard: DashboardState }) => state.dashboard.lastUpdated;
export const selectAutoRefresh = (state: { dashboard: DashboardState }) => state.dashboard.autoRefresh;
export const selectRefreshInterval = (state: { dashboard: DashboardState }) => state.dashboard.refreshInterval;

// Computed selectors
export const selectCompletionRate = (state: { dashboard: DashboardState }) => {
  const overview = state.dashboard.overview;
  if (!overview || overview.totalTasks === 0) return 0;
  return Math.round((overview.completedTasks / overview.totalTasks) * 100);
};

export const selectProductivityTrend = (state: { dashboard: DashboardState }) => {
  const overview = state.dashboard.overview;
  if (!overview) return 'stable';
  
  if (overview.productivity > 80) return 'up';
  if (overview.productivity < 60) return 'down';
  return 'stable';
};

export default dashboardSlice.reducer;