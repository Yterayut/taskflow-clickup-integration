/**
 * TaskFlow Pro SPA - UI State Slice
 * v2.2.0 - User interface state management
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UIState, Notification } from '@types/index';

// Initial state
const initialState: UIState = {
  theme: 'light',
  sidebarCollapsed: false,
  loading: {},
  modals: {},
  notifications: [],
};

// UI slice
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Theme management
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      localStorage.setItem('taskflow_theme', action.payload);
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('taskflow_theme', state.theme);
    },
    initializeTheme: (state) => {
      const savedTheme = localStorage.getItem('taskflow_theme') as 'light' | 'dark';
      if (savedTheme) {
        state.theme = savedTheme;
      } else {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        state.theme = prefersDark ? 'dark' : 'light';
      }
    },

    // Sidebar management
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
      localStorage.setItem('taskflow_sidebar_collapsed', action.payload.toString());
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      localStorage.setItem('taskflow_sidebar_collapsed', state.sidebarCollapsed.toString());
    },
    initializeSidebar: (state) => {
      const savedCollapsed = localStorage.getItem('taskflow_sidebar_collapsed');
      if (savedCollapsed !== null) {
        state.sidebarCollapsed = savedCollapsed === 'true';
      }
    },

    // Loading states management
    setLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      const { key, loading } = action.payload;
      if (loading) {
        state.loading[key] = true;
      } else {
        delete state.loading[key];
      }
    },
    setMultipleLoading: (state, action: PayloadAction<Record<string, boolean>>) => {
      Object.entries(action.payload).forEach(([key, loading]) => {
        if (loading) {
          state.loading[key] = true;
        } else {
          delete state.loading[key];
        }
      });
    },
    clearAllLoading: (state) => {
      state.loading = {};
    },

    // Modal management
    setModal: (state, action: PayloadAction<{ key: string; open: boolean }>) => {
      const { key, open } = action.payload;
      if (open) {
        state.modals[key] = true;
      } else {
        delete state.modals[key];
      }
    },
    openModal: (state, action: PayloadAction<string>) => {
      state.modals[action.payload] = true;
    },
    closeModal: (state, action: PayloadAction<string>) => {
      delete state.modals[action.payload];
    },
    closeAllModals: (state) => {
      state.modals = {};
    },

    // Notification management
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
      
      // Keep only last 50 notifications
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50);
      }
    },
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    markAllNotificationsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.read = true;
      });
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    setNotifications: (state, action: PayloadAction<Notification[]>) => {
      state.notifications = action.payload;
    },

    // Global UI actions
    initializeUI: (state) => {
      // Initialize theme
      const savedTheme = localStorage.getItem('taskflow_theme') as 'light' | 'dark';
      if (savedTheme) {
        state.theme = savedTheme;
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        state.theme = prefersDark ? 'dark' : 'light';
      }

      // Initialize sidebar
      const savedCollapsed = localStorage.getItem('taskflow_sidebar_collapsed');
      if (savedCollapsed !== null) {
        state.sidebarCollapsed = savedCollapsed === 'true';
      }
    },
    resetUI: (state) => {
      state.loading = {};
      state.modals = {};
      state.notifications = [];
    },
  },
});

// Actions
export const {
  setTheme,
  toggleTheme,
  initializeTheme,
  setSidebarCollapsed,
  toggleSidebar,
  initializeSidebar,
  setLoading,
  setMultipleLoading,
  clearAllLoading,
  setModal,
  openModal,
  closeModal,
  closeAllModals,
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  clearNotifications,
  setNotifications,
  initializeUI,
  resetUI,
} = uiSlice.actions;

// Selectors
export const selectTheme = (state: { ui: UIState }) => state.ui.theme;
export const selectIsDarkMode = (state: { ui: UIState }) => state.ui.theme === 'dark';
export const selectSidebarCollapsed = (state: { ui: UIState }) => state.ui.sidebarCollapsed;
export const selectLoading = (state: { ui: UIState }, key: string) => state.ui.loading[key] || false;
export const selectAnyLoading = (state: { ui: UIState }) => Object.keys(state.ui.loading).length > 0;
export const selectModal = (state: { ui: UIState }, key: string) => state.ui.modals[key] || false;
export const selectAnyModalOpen = (state: { ui: UIState }) => Object.keys(state.ui.modals).length > 0;
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications;
export const selectUnreadNotifications = (state: { ui: UIState }) => 
  state.ui.notifications.filter(n => !n.read);
export const selectUnreadNotificationCount = (state: { ui: UIState }) => 
  state.ui.notifications.filter(n => !n.read).length;

export default uiSlice.reducer;