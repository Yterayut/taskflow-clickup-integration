/**
 * TaskFlow Pro SPA - Tasks Slice
 * v2.2.0 - Task management state
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Task, TaskFilter, TaskStatus, TaskPriority } from '@types/index';
import { apiService } from '@services/api';

interface TasksState {
  tasks: Task[];
  currentTask: Task | null;
  filter: TaskFilter;
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  selectedTasks: string[];
  sortBy: 'name' | 'priority' | 'dueDate' | 'status' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

// Initial state
const initialState: TasksState = {
  tasks: [],
  currentTask: null,
  filter: {},
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },
  selectedTasks: [],
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

// Async thunks
export const fetchTasks = createAsyncThunk(
  'tasks/fetchTasks',
  async (filter?: TaskFilter, { rejectWithValue }) => {
    try {
      const response = await apiService.getTasks(filter);
      
      if (response.success) {
        return {
          tasks: response.data,
          pagination: response.pagination,
        };
      } else {
        return rejectWithValue(response.error || 'Failed to fetch tasks');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchAllTasks = createAsyncThunk(
  'tasks/fetchAllTasks',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.getTasks();
      
      if (response.success) {
        return {
          tasks: response.data,
          pagination: response.pagination,
        };
      } else {
        return rejectWithValue(response.error || 'Failed to fetch all tasks');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchUserTasks = createAsyncThunk(
  'tasks/fetchUserTasks',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getTasks({ assignee: [userId] });
      
      if (response.success) {
        return {
          tasks: response.data,
          pagination: response.pagination,
        };
      } else {
        return rejectWithValue(response.error || 'Failed to fetch user tasks');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchTeamTasks = createAsyncThunk(
  'tasks/fetchTeamTasks',
  async (teamId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getTasks({ project: [teamId] });
      
      if (response.success) {
        return {
          tasks: response.data,
          pagination: response.pagination,
        };
      } else {
        return rejectWithValue(response.error || 'Failed to fetch team tasks');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchTask = createAsyncThunk(
  'tasks/fetchTask',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getTask(taskId);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch task');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const createTask = createAsyncThunk(
  'tasks/createTask',
  async (taskData: Partial<Task>, { rejectWithValue }) => {
    try {
      const response = await apiService.createTask(taskData);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to create task');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const updateTask = createAsyncThunk(
  'tasks/updateTask',
  async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }, { rejectWithValue }) => {
    try {
      const response = await apiService.updateTask(taskId, updates);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to update task');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const deleteTask = createAsyncThunk(
  'tasks/deleteTask',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.deleteTask(taskId);
      
      if (response.success) {
        return taskId;
      } else {
        return rejectWithValue(response.error || 'Failed to delete task');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const assignTask = createAsyncThunk(
  'tasks/assignTask',
  async ({ taskId, assigneeId }: { taskId: string; assigneeId: string }, { rejectWithValue }) => {
    try {
      const response = await apiService.assignTask(taskId, assigneeId);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to assign task');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

// Tasks slice
const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    // Filter management
    setFilter: (state, action: PayloadAction<TaskFilter>) => {
      state.filter = action.payload;
    },
    updateFilter: (state, action: PayloadAction<Partial<TaskFilter>>) => {
      state.filter = { ...state.filter, ...action.payload };
    },
    clearFilter: (state) => {
      state.filter = {};
    },
    
    // Sorting
    setSorting: (state, action: PayloadAction<{ sortBy: TasksState['sortBy']; sortOrder: TasksState['sortOrder'] }>) => {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
    },
    
    // Selection
    selectTask: (state, action: PayloadAction<string>) => {
      if (!state.selectedTasks.includes(action.payload)) {
        state.selectedTasks.push(action.payload);
      }
    },
    deselectTask: (state, action: PayloadAction<string>) => {
      state.selectedTasks = state.selectedTasks.filter(id => id !== action.payload);
    },
    selectAllTasks: (state) => {
      state.selectedTasks = state.tasks.map(task => task.id);
    },
    deselectAllTasks: (state) => {
      state.selectedTasks = [];
    },
    toggleTaskSelection: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      if (state.selectedTasks.includes(taskId)) {
        state.selectedTasks = state.selectedTasks.filter(id => id !== taskId);
      } else {
        state.selectedTasks.push(taskId);
      }
    },
    
    // Real-time updates
    addTaskRealtime: (state, action: PayloadAction<Task>) => {
      const existingIndex = state.tasks.findIndex(t => t.id === action.payload.id);
      if (existingIndex === -1) {
        state.tasks.unshift(action.payload);
      }
    },
    updateTaskRealtime: (state, action: PayloadAction<Task>) => {
      const index = state.tasks.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.tasks[index] = action.payload;
      }
      
      // Update current task if it's the same one
      if (state.currentTask?.id === action.payload.id) {
        state.currentTask = action.payload;
      }
    },
    removeTaskRealtime: (state, action: PayloadAction<string>) => {
      state.tasks = state.tasks.filter(t => t.id !== action.payload);
      
      // Clear current task if it's the deleted one
      if (state.currentTask?.id === action.payload) {
        state.currentTask = null;
      }
      
      // Remove from selection
      state.selectedTasks = state.selectedTasks.filter(id => id !== action.payload);
    },
    
    // Bulk operations
    updateTasksStatus: (state, action: PayloadAction<{ taskIds: string[]; status: TaskStatus }>) => {
      const { taskIds, status } = action.payload;
      state.tasks.forEach(task => {
        if (taskIds.includes(task.id)) {
          task.status = status;
          task.updatedAt = new Date().toISOString();
        }
      });
    },
    updateTasksPriority: (state, action: PayloadAction<{ taskIds: string[]; priority: TaskPriority }>) => {
      const { taskIds, priority } = action.payload;
      state.tasks.forEach(task => {
        if (taskIds.includes(task.id)) {
          task.priority = priority;
          task.updatedAt = new Date().toISOString();
        }
      });
    },
    
    // Current task
    setCurrentTask: (state, action: PayloadAction<Task | null>) => {
      state.currentTask = action.payload;
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
    
    // Reset
    resetTasks: (state) => {
      state.tasks = [];
      state.currentTask = null;
      state.selectedTasks = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch tasks
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks = action.payload.tasks;
        state.pagination = action.payload.pagination;
        state.error = null;
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch all tasks
    builder
      .addCase(fetchAllTasks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllTasks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks = action.payload.tasks;
        state.pagination = action.payload.pagination;
        state.error = null;
      })
      .addCase(fetchAllTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch user tasks
    builder
      .addCase(fetchUserTasks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserTasks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks = action.payload.tasks;
        state.pagination = action.payload.pagination;
        state.error = null;
      })
      .addCase(fetchUserTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch team tasks
    builder
      .addCase(fetchTeamTasks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTeamTasks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks = action.payload.tasks;
        state.pagination = action.payload.pagination;
        state.error = null;
      })
      .addCase(fetchTeamTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch task
    builder
      .addCase(fetchTask.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTask.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentTask = action.payload;
        state.error = null;
      })
      .addCase(fetchTask.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create task
    builder
      .addCase(createTask.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createTask.fulfilled, (state, action) => {
        state.isCreating = false;
        state.tasks.unshift(action.payload);
        state.error = null;
      })
      .addCase(createTask.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      });

    // Update task
    builder
      .addCase(updateTask.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.tasks.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
        if (state.currentTask?.id === action.payload.id) {
          state.currentTask = action.payload;
        }
        state.error = null;
      })
      .addCase(updateTask.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      });

    // Delete task
    builder
      .addCase(deleteTask.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.isUpdating = false;
        state.tasks = state.tasks.filter(t => t.id !== action.payload);
        if (state.currentTask?.id === action.payload) {
          state.currentTask = null;
        }
        state.selectedTasks = state.selectedTasks.filter(id => id !== action.payload);
        state.error = null;
      })
      .addCase(deleteTask.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      });

    // Assign task
    builder
      .addCase(assignTask.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(assignTask.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.tasks.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
        if (state.currentTask?.id === action.payload.id) {
          state.currentTask = action.payload;
        }
        state.error = null;
      })
      .addCase(assignTask.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      });
  },
});

// Actions
export const {
  setFilter,
  updateFilter,
  clearFilter,
  setSorting,
  selectTask,
  deselectTask,
  selectAllTasks,
  deselectAllTasks,
  toggleTaskSelection,
  addTaskRealtime,
  updateTaskRealtime,
  removeTaskRealtime,
  updateTasksStatus,
  updateTasksPriority,
  setCurrentTask,
  clearError,
  resetTasks,
} = tasksSlice.actions;

// Selectors
export const selectTasks = (state: { tasks: TasksState }) => state.tasks.tasks;
export const selectCurrentTask = (state: { tasks: TasksState }) => state.tasks.currentTask;
export const selectTasksFilter = (state: { tasks: TasksState }) => state.tasks.filter;
export const selectTasksLoading = (state: { tasks: TasksState }) => state.tasks.isLoading;
export const selectTasksCreating = (state: { tasks: TasksState }) => state.tasks.isCreating;
export const selectTasksUpdating = (state: { tasks: TasksState }) => state.tasks.isUpdating;
export const selectTasksError = (state: { tasks: TasksState }) => state.tasks.error;
export const selectTasksPagination = (state: { tasks: TasksState }) => state.tasks.pagination;
export const selectSelectedTasks = (state: { tasks: TasksState }) => state.tasks.selectedTasks;
export const selectTasksSorting = (state: { tasks: TasksState }) => ({
  sortBy: state.tasks.sortBy,
  sortOrder: state.tasks.sortOrder,
});

// Computed selectors
export const selectFilteredTasks = (state: { tasks: TasksState }) => {
  const { tasks, filter, sortBy, sortOrder } = state.tasks;
  
  let filtered = [...tasks];
  
  // Apply filters
  if (filter.status?.length) {
    filtered = filtered.filter(task => filter.status!.includes(task.status));
  }
  
  if (filter.priority?.length) {
    filtered = filtered.filter(task => filter.priority!.includes(task.priority));
  }
  
  if (filter.assignee?.length) {
    filtered = filtered.filter(task => filter.assignee!.includes(task.assigneeId));
  }
  
  if (filter.search) {
    const searchLower = filter.search.toLowerCase();
    filtered = filtered.filter(task => 
      task.name.toLowerCase().includes(searchLower) ||
      task.description?.toLowerCase().includes(searchLower)
    );
  }
  
  // Apply sorting
  filtered.sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'priority':
        const priorityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
        aValue = priorityOrder[a.priority];
        bValue = priorityOrder[b.priority];
        break;
      case 'dueDate':
        aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'createdAt':
      default:
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });
  
  return filtered;
};

export const selectTaskById = (state: { tasks: TasksState }, taskId: string) => 
  state.tasks.tasks.find(task => task.id === taskId);

export const selectSelectedTasksData = (state: { tasks: TasksState }) => 
  state.tasks.tasks.filter(task => state.tasks.selectedTasks.includes(task.id));

export default tasksSlice.reducer;