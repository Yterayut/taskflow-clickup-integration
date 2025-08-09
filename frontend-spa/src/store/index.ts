/**
 * TaskFlow Pro SPA - Redux Store Configuration
 * v2.2.0 - Centralized state management
 */

import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

// Slice imports
import authSlice from './slices/authSlice';
import uiSlice from './slices/uiSlice';
import dashboardSlice from './slices/dashboardSlice';
import tasksSlice from './slices/tasksSlice';
import teamsSlice from './slices/teamsSlice';
import usersSlice from './slices/usersSlice';
import notificationsSlice from './slices/notificationsSlice';
import realtimeSlice from './slices/realtimeSlice';

// Configure store
export const store = configureStore({
  reducer: {
    auth: authSlice,
    ui: uiSlice,
    dashboard: dashboardSlice,
    tasks: tasksSlice,
    teams: teamsSlice,
    users: usersSlice,
    notifications: notificationsSlice,
    realtime: realtimeSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        ignoredPaths: ['register', 'rehydrate'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// Infer types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Selectors
export const selectAuth = (state: RootState) => state.auth;
export const selectUI = (state: RootState) => state.ui;
export const selectDashboard = (state: RootState) => state.dashboard;
export const selectTasks = (state: RootState) => state.tasks;
export const selectTeams = (state: RootState) => state.teams;
export const selectUsers = (state: RootState) => state.users;
export const selectNotifications = (state: RootState) => state.notifications;
export const selectRealtime = (state: RootState) => state.realtime;

export default store;