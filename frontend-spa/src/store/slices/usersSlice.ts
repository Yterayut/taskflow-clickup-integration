/**
 * TaskFlow Pro SPA - Users Slice
 * v2.2.0 - User management state
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, UserRole, UserStatus } from '@types/index';
import { apiService } from '@services/api';

interface UsersState {
  users: User[];
  currentUser: User | null;
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  error: string | null;
  selectedUsers: string[];
  filter: {
    role?: UserRole[];
    status?: UserStatus[];
    department?: string[];
    search?: string;
  };
}

// Initial state
const initialState: UsersState = {
  users: [],
  currentUser: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  error: null,
  selectedUsers: [],
  filter: {},
};

// Async thunks
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.getUsers();
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch users');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchUser = createAsyncThunk(
  'users/fetchUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getUser(userId);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch user');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (userData: Partial<User>, { rejectWithValue }) => {
    try {
      const response = await apiService.createUser(userData);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to create user');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ userId, updates }: { userId: string; updates: Partial<User> }, { rejectWithValue }) => {
    try {
      const response = await apiService.updateUser(userId, updates);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to update user');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.deleteUser(userId);
      
      if (response.success) {
        return userId;
      } else {
        return rejectWithValue(response.error || 'Failed to delete user');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchUserProfile = createAsyncThunk(
  'users/fetchUserProfile',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getUser(userId);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch user profile');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchTeamUsers = createAsyncThunk(
  'users/fetchTeamUsers',
  async (teamId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getUsers();
      
      if (response.success) {
        // Filter users by team ID (assuming teamId is a property on user)
        const teamUsers = response.data.filter((user: User) => user.teamId === teamId);
        return teamUsers;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch team users');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

// Users slice
const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    // Filter management
    setFilter: (state, action: PayloadAction<UsersState['filter']>) => {
      state.filter = action.payload;
    },
    updateFilter: (state, action: PayloadAction<Partial<UsersState['filter']>>) => {
      state.filter = { ...state.filter, ...action.payload };
    },
    clearFilter: (state) => {
      state.filter = {};
    },
    
    // Selection
    selectUser: (state, action: PayloadAction<string>) => {
      if (!state.selectedUsers.includes(action.payload)) {
        state.selectedUsers.push(action.payload);
      }
    },
    deselectUser: (state, action: PayloadAction<string>) => {
      state.selectedUsers = state.selectedUsers.filter(id => id !== action.payload);
    },
    selectAllUsers: (state) => {
      state.selectedUsers = state.users.map(user => user.id);
    },
    deselectAllUsers: (state) => {
      state.selectedUsers = [];
    },
    toggleUserSelection: (state, action: PayloadAction<string>) => {
      const userId = action.payload;
      if (state.selectedUsers.includes(userId)) {
        state.selectedUsers = state.selectedUsers.filter(id => id !== userId);
      } else {
        state.selectedUsers.push(userId);
      }
    },
    
    // Real-time updates
    addUserRealtime: (state, action: PayloadAction<User>) => {
      const existingIndex = state.users.findIndex(u => u.id === action.payload.id);
      if (existingIndex === -1) {
        state.users.push(action.payload);
      }
    },
    updateUserRealtime: (state, action: PayloadAction<User>) => {
      const index = state.users.findIndex(u => u.id === action.payload.id);
      if (index !== -1) {
        state.users[index] = action.payload;
      }
      
      // Update current user if it's the same one
      if (state.currentUser?.id === action.payload.id) {
        state.currentUser = action.payload;
      }
    },
    removeUserRealtime: (state, action: PayloadAction<string>) => {
      state.users = state.users.filter(u => u.id !== action.payload);
      
      // Clear current user if it's the deleted one
      if (state.currentUser?.id === action.payload) {
        state.currentUser = null;
      }
      
      // Remove from selection
      state.selectedUsers = state.selectedUsers.filter(id => id !== action.payload);
    },
    
    // Bulk operations
    updateUsersStatus: (state, action: PayloadAction<{ userIds: string[]; status: UserStatus }>) => {
      const { userIds, status } = action.payload;
      state.users.forEach(user => {
        if (userIds.includes(user.id)) {
          user.status = status;
        }
      });
    },
    updateUsersRole: (state, action: PayloadAction<{ userIds: string[]; role: UserRole }>) => {
      const { userIds, role } = action.payload;
      state.users.forEach(user => {
        if (userIds.includes(user.id)) {
          user.role = role;
        }
      });
    },
    
    // Current user
    setCurrentUser: (state, action: PayloadAction<User | null>) => {
      state.currentUser = action.payload;
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
    
    // Reset
    resetUsers: (state) => {
      state.users = [];
      state.currentUser = null;
      state.selectedUsers = [];
      state.error = null;
      state.filter = {};
    },
  },
  extraReducers: (builder) => {
    // Fetch users
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = action.payload;
        state.error = null;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch user
    builder
      .addCase(fetchUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentUser = action.payload;
        state.error = null;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create user
    builder
      .addCase(createUser.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.isCreating = false;
        state.users.push(action.payload);
        state.error = null;
      })
      .addCase(createUser.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      });

    // Update user
    builder
      .addCase(updateUser.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.users.findIndex(u => u.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.currentUser?.id === action.payload.id) {
          state.currentUser = action.payload;
        }
        state.error = null;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      });

    // Delete user
    builder
      .addCase(deleteUser.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.isUpdating = false;
        state.users = state.users.filter(u => u.id !== action.payload);
        if (state.currentUser?.id === action.payload) {
          state.currentUser = null;
        }
        state.selectedUsers = state.selectedUsers.filter(id => id !== action.payload);
        state.error = null;
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      });

    // Fetch user profile
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentUser = action.payload;
        
        // Update the user in the users array if it exists
        const index = state.users.findIndex(u => u.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        
        state.error = null;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch team users
    builder
      .addCase(fetchTeamUsers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTeamUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = action.payload;
        state.error = null;
      })
      .addCase(fetchTeamUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

// Actions
export const {
  setFilter,
  updateFilter,
  clearFilter,
  selectUser,
  deselectUser,
  selectAllUsers,
  deselectAllUsers,
  toggleUserSelection,
  addUserRealtime,
  updateUserRealtime,
  removeUserRealtime,
  updateUsersStatus,
  updateUsersRole,
  setCurrentUser,
  clearError,
  resetUsers,
} = usersSlice.actions;

// Selectors
export const selectUsers = (state: { users: UsersState }) => state.users.users;
export const selectCurrentUser = (state: { users: UsersState }) => state.users.currentUser;
export const selectUsersFilter = (state: { users: UsersState }) => state.users.filter;
export const selectUsersLoading = (state: { users: UsersState }) => state.users.isLoading;
export const selectUsersCreating = (state: { users: UsersState }) => state.users.isCreating;
export const selectUsersUpdating = (state: { users: UsersState }) => state.users.isUpdating;
export const selectUsersError = (state: { users: UsersState }) => state.users.error;
export const selectSelectedUsers = (state: { users: UsersState }) => state.users.selectedUsers;

// Computed selectors
export const selectFilteredUsers = (state: { users: UsersState }) => {
  const { users, filter } = state.users;
  
  let filtered = [...users];
  
  // Apply filters
  if (filter.role?.length) {
    filtered = filtered.filter(user => filter.role!.includes(user.role));
  }
  
  if (filter.status?.length) {
    filtered = filtered.filter(user => filter.status!.includes(user.status));
  }
  
  if (filter.department?.length) {
    filtered = filtered.filter(user => 
      user.department && filter.department!.includes(user.department)
    );
  }
  
  if (filter.search) {
    const searchLower = filter.search.toLowerCase();
    filtered = filtered.filter(user => 
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower)
    );
  }
  
  return filtered;
};

export const selectUserById = (state: { users: UsersState }, userId: string) => 
  state.users.users.find(user => user.id === userId);

export const selectUsersByRole = (state: { users: UsersState }, role: UserRole) => 
  state.users.users.filter(user => user.role === role);

export const selectActiveUsers = (state: { users: UsersState }) => 
  state.users.users.filter(user => user.status === 'active');

export const selectUsersByDepartment = (state: { users: UsersState }, department: string) => 
  state.users.users.filter(user => user.department === department);

export const selectSelectedUsersData = (state: { users: UsersState }) => 
  state.users.users.filter(user => state.users.selectedUsers.includes(user.id));

export const selectManagers = (state: { users: UsersState }) => 
  state.users.users.filter(user => user.role === 'manager' || user.role === 'master');

export const selectTeamLeads = (state: { users: UsersState }) => 
  state.users.users.filter(user => user.role === 'team_lead');

export const selectEmployees = (state: { users: UsersState }) => 
  state.users.users.filter(user => user.role === 'employee');

export default usersSlice.reducer;