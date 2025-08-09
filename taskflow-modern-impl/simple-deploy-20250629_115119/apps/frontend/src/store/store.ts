import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { authSlice } from './slices/authSlice';
import { tasksSlice } from './slices/tasksSlice';
import { teamSlice } from './slices/teamSlice';
import { uiSlice } from './slices/uiSlice';
import { attendanceSlice } from './slices/attendanceSlice';
import { api } from '@services/api';

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    tasks: tasksSlice.reducer,
    team: teamSlice.reducer,
    ui: uiSlice.reducer,
    attendance: attendanceSlice.reducer,
    // RTK Query API slice
    api: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(api.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

// Setup RTK Query listeners for automatic refetching
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;