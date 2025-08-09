/**
 * TaskFlow Pro SPA - Realtime Slice
 * v2.2.0 - WebSocket connection and real-time state management
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RealtimeConnection, RealtimeMessage } from '@types/index';
import { websocketService } from '@services/websocket';

interface RealtimeState {
  connection: RealtimeConnection;
  messages: RealtimeMessage[];
  connectedUsers: number;
  rooms: string[];
  lastActivity: string | null;
}

// Initial state
const initialState: RealtimeState = {
  connection: {
    connected: false,
    connecting: false,
    error: null,
    lastConnected: null,
    retryCount: 0,
  },
  messages: [],
  connectedUsers: 0,
  rooms: [],
  lastActivity: null,
};

// Async thunks
export const connectWebSocket = createAsyncThunk(
  'realtime/connectWebSocket',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const user = state.auth.user;
      
      if (!user) {
        return rejectWithValue('No user authenticated');
      }
      
      const connected = await websocketService.connect(user);
      
      if (connected) {
        return { connected: true, user };
      } else {
        return rejectWithValue('Failed to connect to WebSocket');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'WebSocket connection failed');
    }
  }
);

export const disconnectWebSocket = createAsyncThunk(
  'realtime/disconnectWebSocket',
  async (_, { rejectWithValue }) => {
    try {
      websocketService.disconnect();
      return { connected: false };
    } catch (error: any) {
      return rejectWithValue(error.message || 'WebSocket disconnection failed');
    }
  }
);

// Realtime slice
const realtimeSlice = createSlice({
  name: 'realtime',
  initialState,
  reducers: {
    // Connection management
    setConnecting: (state, action: PayloadAction<boolean>) => {
      state.connection.connecting = action.payload;
      if (action.payload) {
        state.connection.error = null;
      }
    },
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connection.connected = action.payload;
      state.connection.connecting = false;
      
      if (action.payload) {
        state.connection.lastConnected = new Date().toISOString();
        state.connection.retryCount = 0;
        state.connection.error = null;
      }
    },
    setConnectionError: (state, action: PayloadAction<string>) => {
      state.connection.error = action.payload;
      state.connection.connected = false;
      state.connection.connecting = false;
    },
    incrementRetryCount: (state) => {
      state.connection.retryCount += 1;
    },
    resetRetryCount: (state) => {
      state.connection.retryCount = 0;
    },

    // Message management
    addMessage: (state, action: PayloadAction<RealtimeMessage>) => {
      state.messages.unshift(action.payload);
      state.lastActivity = new Date().toISOString();
      
      // Keep only last 100 messages
      if (state.messages.length > 100) {
        state.messages = state.messages.slice(0, 100);
      }
    },
    clearMessages: (state) => {
      state.messages = [];
    },
    setConnectedUsers: (state, action: PayloadAction<number>) => {
      state.connectedUsers = action.payload;
    },

    // Room management
    joinRoom: (state, action: PayloadAction<string>) => {
      if (!state.rooms.includes(action.payload)) {
        state.rooms.push(action.payload);
      }
    },
    leaveRoom: (state, action: PayloadAction<string>) => {
      state.rooms = state.rooms.filter(room => room !== action.payload);
    },
    setRooms: (state, action: PayloadAction<string[]>) => {
      state.rooms = action.payload;
    },
    clearRooms: (state) => {
      state.rooms = [];
    },

    // Connection lifecycle
    resetConnection: (state) => {
      state.connection = {
        connected: false,
        connecting: false,
        error: null,
        lastConnected: null,
        retryCount: 0,
      };
      state.rooms = [];
      state.connectedUsers = 0;
    },

    // Activity tracking
    updateLastActivity: (state) => {
      state.lastActivity = new Date().toISOString();
    },
  },
  extraReducers: (builder) => {
    // Connect WebSocket
    builder
      .addCase(connectWebSocket.pending, (state) => {
        state.connection.connecting = true;
        state.connection.error = null;
      })
      .addCase(connectWebSocket.fulfilled, (state, action) => {
        state.connection.connecting = false;
        state.connection.connected = action.payload.connected;
        state.connection.lastConnected = new Date().toISOString();
        state.connection.retryCount = 0;
        state.connection.error = null;
      })
      .addCase(connectWebSocket.rejected, (state, action) => {
        state.connection.connecting = false;
        state.connection.connected = false;
        state.connection.error = action.payload as string;
      });

    // Disconnect WebSocket
    builder
      .addCase(disconnectWebSocket.pending, (state) => {
        state.connection.connecting = true;
      })
      .addCase(disconnectWebSocket.fulfilled, (state, action) => {
        state.connection.connecting = false;
        state.connection.connected = action.payload.connected;
        state.rooms = [];
        state.connectedUsers = 0;
      })
      .addCase(disconnectWebSocket.rejected, (state, action) => {
        state.connection.connecting = false;
        state.connection.error = action.payload as string;
      });
  },
});

// Actions
export const {
  setConnecting,
  setConnected,
  setConnectionError,
  incrementRetryCount,
  resetRetryCount,
  addMessage,
  clearMessages,
  setConnectedUsers,
  joinRoom,
  leaveRoom,
  setRooms,
  clearRooms,
  resetConnection,
  updateLastActivity,
} = realtimeSlice.actions;

// Selectors
export const selectRealtimeConnection = (state: { realtime: RealtimeState }) => state.realtime.connection;
export const selectIsConnected = (state: { realtime: RealtimeState }) => state.realtime.connection.connected;
export const selectIsConnecting = (state: { realtime: RealtimeState }) => state.realtime.connection.connecting;
export const selectConnectionError = (state: { realtime: RealtimeState }) => state.realtime.connection.error;
export const selectRetryCount = (state: { realtime: RealtimeState }) => state.realtime.connection.retryCount;
export const selectRealtimeMessages = (state: { realtime: RealtimeState }) => state.realtime.messages;
export const selectConnectedUsers = (state: { realtime: RealtimeState }) => state.realtime.connectedUsers;
export const selectJoinedRooms = (state: { realtime: RealtimeState }) => state.realtime.rooms;
export const selectLastActivity = (state: { realtime: RealtimeState }) => state.realtime.lastActivity;

export default realtimeSlice.reducer;