/**
 * TaskFlow Pro SPA - Notifications Slice
 * v2.2.0 - Notification management state
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Notification, NotificationType } from '@types/index';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  filter: {
    type?: NotificationType[];
    priority?: ('low' | 'medium' | 'high' | 'critical')[];
    read?: boolean;
  };
  settings: {
    enableSound: boolean;
    enableDesktop: boolean;
    enableEmail: boolean;
    autoMarkRead: boolean;
    autoMarkReadDelay: number; // in seconds
  };
}

// Initial state
const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  filter: {},
  settings: {
    enableSound: true,
    enableDesktop: true,
    enableEmail: false,
    autoMarkRead: true,
    autoMarkReadDelay: 5,
  },
};

// Notifications slice
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Add notifications
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
      
      if (!action.payload.read) {
        state.unreadCount += 1;
      }
      
      // Keep only last 100 notifications
      if (state.notifications.length > 100) {
        const removed = state.notifications.splice(100);
        // Adjust unread count for removed notifications
        const removedUnread = removed.filter(n => !n.read).length;
        state.unreadCount = Math.max(0, state.unreadCount - removedUnread);
      }
    },
    
    addNotifications: (state, action: PayloadAction<Notification[]>) => {
      const newNotifications = action.payload;
      state.notifications = [...newNotifications, ...state.notifications].slice(0, 100);
      
      // Recalculate unread count
      state.unreadCount = state.notifications.filter(n => !n.read).length;
    },
    
    // Mark as read/unread
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    
    markAsUnread: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && notification.read) {
        notification.read = false;
        state.unreadCount += 1;
      }
    },
    
    markAllAsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.read = true;
      });
      state.unreadCount = 0;
    },
    
    markMultipleAsRead: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach(notificationId => {
        const notification = state.notifications.find(n => n.id === notificationId);
        if (notification && !notification.read) {
          notification.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      });
    },
    
    // Remove notifications
    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index !== -1) {
        const notification = state.notifications[index];
        if (!notification.read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.notifications.splice(index, 1);
      }
    },
    
    removeNotifications: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach(notificationId => {
        const index = state.notifications.findIndex(n => n.id === notificationId);
        if (index !== -1) {
          const notification = state.notifications[index];
          if (!notification.read) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
          state.notifications.splice(index, 1);
        }
      });
    },
    
    clearAllNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    
    clearReadNotifications: (state) => {
      state.notifications = state.notifications.filter(n => !n.read);
      // Unread count should remain the same
    },
    
    // Filter management
    setFilter: (state, action: PayloadAction<NotificationsState['filter']>) => {
      state.filter = action.payload;
    },
    
    updateFilter: (state, action: PayloadAction<Partial<NotificationsState['filter']>>) => {
      state.filter = { ...state.filter, ...action.payload };
    },
    
    clearFilter: (state) => {
      state.filter = {};
    },
    
    // Settings management
    updateSettings: (state, action: PayloadAction<Partial<NotificationsState['settings']>>) => {
      state.settings = { ...state.settings, ...action.payload };
      
      // Save to localStorage
      localStorage.setItem('taskflow_notification_settings', JSON.stringify(state.settings));
    },
    
    initializeSettings: (state) => {
      const savedSettings = localStorage.getItem('taskflow_notification_settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          state.settings = { ...state.settings, ...parsed };
        } catch (error) {
          console.error('Failed to parse saved notification settings:', error);
        }
      }
    },
    
    // Loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    // Update notification
    updateNotification: (state, action: PayloadAction<Notification>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload.id);
      if (index !== -1) {
        const oldNotification = state.notifications[index];
        const newNotification = action.payload;
        
        // Update unread count if read status changed
        if (oldNotification.read !== newNotification.read) {
          if (newNotification.read) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          } else {
            state.unreadCount += 1;
          }
        }
        
        state.notifications[index] = newNotification;
      }
    },
    
    // Real-time helpers
    incrementUnreadCount: (state) => {
      state.unreadCount += 1;
    },
    
    decrementUnreadCount: (state) => {
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    },
    
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = Math.max(0, action.payload);
    },
    
    // Reset
    resetNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
      state.filter = {};
    },
  },
});

// Actions
export const {
  addNotification,
  addNotifications,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  markMultipleAsRead,
  removeNotification,
  removeNotifications,
  clearAllNotifications,
  clearReadNotifications,
  setFilter,
  updateFilter,
  clearFilter,
  updateSettings,
  initializeSettings,
  setLoading,
  updateNotification,
  incrementUnreadCount,
  decrementUnreadCount,
  setUnreadCount,
  resetNotifications,
} = notificationsSlice.actions;

// Selectors
export const selectNotifications = (state: { notifications: NotificationsState }) => state.notifications.notifications;
export const selectUnreadCount = (state: { notifications: NotificationsState }) => state.notifications.unreadCount;
export const selectNotificationsLoading = (state: { notifications: NotificationsState }) => state.notifications.isLoading;
export const selectNotificationsFilter = (state: { notifications: NotificationsState }) => state.notifications.filter;
export const selectNotificationSettings = (state: { notifications: NotificationsState }) => state.notifications.settings;

// Computed selectors
export const selectFilteredNotifications = (state: { notifications: NotificationsState }) => {
  const { notifications, filter } = state.notifications;
  
  let filtered = [...notifications];
  
  // Apply filters
  if (filter.type?.length) {
    filtered = filtered.filter(notification => filter.type!.includes(notification.type));
  }
  
  if (filter.priority?.length) {
    filtered = filtered.filter(notification => filter.priority!.includes(notification.priority));
  }
  
  if (filter.read !== undefined) {
    filtered = filtered.filter(notification => notification.read === filter.read);
  }
  
  return filtered;
};

export const selectUnreadNotifications = (state: { notifications: NotificationsState }) => 
  state.notifications.notifications.filter(n => !n.read);

export const selectNotificationsByType = (state: { notifications: NotificationsState }, type: NotificationType) => 
  state.notifications.notifications.filter(n => n.type === type);

export const selectNotificationsByPriority = (state: { notifications: NotificationsState }, priority: 'low' | 'medium' | 'high' | 'critical') => 
  state.notifications.notifications.filter(n => n.priority === priority);

export const selectRecentNotifications = (state: { notifications: NotificationsState }, count: number = 10) => 
  state.notifications.notifications.slice(0, count);

export const selectCriticalNotifications = (state: { notifications: NotificationsState }) => 
  state.notifications.notifications.filter(n => n.priority === 'critical');

export const selectNotificationById = (state: { notifications: NotificationsState }, notificationId: string) => 
  state.notifications.notifications.find(n => n.id === notificationId);

export default notificationsSlice.reducer;