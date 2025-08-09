/**
 * TaskFlow Pro SPA - Teams Slice
 * v2.2.0 - Team management and performance state
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Team, TeamMember, TeamPerformance } from '@types/index';
import { apiService } from '@services/api';

interface TeamsState {
  teams: Team[];
  currentTeam: Team | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  performanceData: Record<string, TeamPerformance>;
  selectedTeam: string | null;
}

// Initial state
const initialState: TeamsState = {
  teams: [],
  currentTeam: null,
  isLoading: false,
  isUpdating: false,
  error: null,
  performanceData: {},
  selectedTeam: null,
};

// Async thunks
export const fetchTeams = createAsyncThunk(
  'teams/fetchTeams',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.getTeams();
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch teams');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchTeam = createAsyncThunk(
  'teams/fetchTeam',
  async (teamId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getTeam(teamId);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch team');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const updateTeam = createAsyncThunk(
  'teams/updateTeam',
  async ({ teamId, updates }: { teamId: string; updates: Partial<Team> }, { rejectWithValue }) => {
    try {
      const response = await apiService.updateTeam(teamId, updates);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to update team');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchTeamPerformance = createAsyncThunk(
  'teams/fetchTeamPerformance',
  async (teamId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getTeamPerformance(teamId);
      
      if (response.success) {
        return { teamId, performance: response.data };
      } else {
        return rejectWithValue(response.error || 'Failed to fetch team performance');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const fetchTeamData = createAsyncThunk(
  'teams/fetchTeamData',
  async (teamId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getTeam(teamId);
      
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch team data');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

// Teams slice
const teamsSlice = createSlice({
  name: 'teams',
  initialState,
  reducers: {
    // Team selection
    setSelectedTeam: (state, action: PayloadAction<string | null>) => {
      state.selectedTeam = action.payload;
    },
    setCurrentTeam: (state, action: PayloadAction<Team | null>) => {
      state.currentTeam = action.payload;
    },
    
    // Real-time updates
    updateTeamRealtime: (state, action: PayloadAction<Team>) => {
      const index = state.teams.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.teams[index] = action.payload;
      }
      
      // Update current team if it's the same one
      if (state.currentTeam?.id === action.payload.id) {
        state.currentTeam = action.payload;
      }
    },
    
    // Member management
    addTeamMember: (state, action: PayloadAction<{ teamId: string; member: TeamMember }>) => {
      const { teamId, member } = action.payload;
      const team = state.teams.find(t => t.id === teamId);
      if (team) {
        team.members.push(member);
        team.updatedAt = new Date().toISOString();
      }
      
      if (state.currentTeam?.id === teamId) {
        state.currentTeam.members.push(member);
        state.currentTeam.updatedAt = new Date().toISOString();
      }
    },
    
    removeTeamMember: (state, action: PayloadAction<{ teamId: string; userId: string }>) => {
      const { teamId, userId } = action.payload;
      const team = state.teams.find(t => t.id === teamId);
      if (team) {
        team.members = team.members.filter(m => m.userId !== userId);
        team.updatedAt = new Date().toISOString();
      }
      
      if (state.currentTeam?.id === teamId) {
        state.currentTeam.members = state.currentTeam.members.filter(m => m.userId !== userId);
        state.currentTeam.updatedAt = new Date().toISOString();
      }
    },
    
    updateTeamMember: (state, action: PayloadAction<{ teamId: string; userId: string; updates: Partial<TeamMember> }>) => {
      const { teamId, userId, updates } = action.payload;
      const team = state.teams.find(t => t.id === teamId);
      if (team) {
        const memberIndex = team.members.findIndex(m => m.userId === userId);
        if (memberIndex !== -1) {
          team.members[memberIndex] = { ...team.members[memberIndex], ...updates };
          team.updatedAt = new Date().toISOString();
        }
      }
      
      if (state.currentTeam?.id === teamId) {
        const memberIndex = state.currentTeam.members.findIndex(m => m.userId === userId);
        if (memberIndex !== -1) {
          state.currentTeam.members[memberIndex] = { ...state.currentTeam.members[memberIndex], ...updates };
          state.currentTeam.updatedAt = new Date().toISOString();
        }
      }
    },
    
    // Performance updates
    updateTeamPerformance: (state, action: PayloadAction<{ teamId: string; performance: Partial<TeamPerformance> }>) => {
      const { teamId, performance } = action.payload;
      
      if (state.performanceData[teamId]) {
        state.performanceData[teamId] = { ...state.performanceData[teamId], ...performance };
      }
      
      const team = state.teams.find(t => t.id === teamId);
      if (team) {
        team.performance = { ...team.performance, ...performance };
      }
      
      if (state.currentTeam?.id === teamId) {
        state.currentTeam.performance = { ...state.currentTeam.performance, ...performance };
      }
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
    
    // Reset
    resetTeams: (state) => {
      state.teams = [];
      state.currentTeam = null;
      state.performanceData = {};
      state.selectedTeam = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch teams
    builder
      .addCase(fetchTeams.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTeams.fulfilled, (state, action) => {
        state.isLoading = false;
        state.teams = action.payload;
        state.error = null;
      })
      .addCase(fetchTeams.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch team
    builder
      .addCase(fetchTeam.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTeam.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentTeam = action.payload;
        state.error = null;
      })
      .addCase(fetchTeam.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Update team
    builder
      .addCase(updateTeam.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateTeam.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.teams.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.teams[index] = action.payload;
        }
        if (state.currentTeam?.id === action.payload.id) {
          state.currentTeam = action.payload;
        }
        state.error = null;
      })
      .addCase(updateTeam.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      });

    // Fetch team performance
    builder
      .addCase(fetchTeamPerformance.pending, (state) => {
        // Don't set loading to avoid UI flicker
      })
      .addCase(fetchTeamPerformance.fulfilled, (state, action) => {
        const { teamId, performance } = action.payload;
        state.performanceData[teamId] = performance;
        
        const team = state.teams.find(t => t.id === teamId);
        if (team) {
          team.performance = performance;
        }
        
        if (state.currentTeam?.id === teamId) {
          state.currentTeam.performance = performance;
        }
      })
      .addCase(fetchTeamPerformance.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Fetch team data
    builder
      .addCase(fetchTeamData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTeamData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentTeam = action.payload;
        
        // Update the team in the teams array if it exists
        const index = state.teams.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.teams[index] = action.payload;
        }
        
        state.error = null;
      })
      .addCase(fetchTeamData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

// Actions
export const {
  setSelectedTeam,
  setCurrentTeam,
  updateTeamRealtime,
  addTeamMember,
  removeTeamMember,
  updateTeamMember,
  updateTeamPerformance,
  clearError,
  resetTeams,
} = teamsSlice.actions;

// Selectors
export const selectTeams = (state: { teams: TeamsState }) => state.teams.teams;
export const selectCurrentTeam = (state: { teams: TeamsState }) => state.teams.currentTeam;
export const selectSelectedTeam = (state: { teams: TeamsState }) => state.teams.selectedTeam;
export const selectTeamsLoading = (state: { teams: TeamsState }) => state.teams.isLoading;
export const selectTeamsUpdating = (state: { teams: TeamsState }) => state.teams.isUpdating;
export const selectTeamsError = (state: { teams: TeamsState }) => state.teams.error;
export const selectTeamPerformanceData = (state: { teams: TeamsState }) => state.teams.performanceData;

// Computed selectors
export const selectTeamById = (state: { teams: TeamsState }, teamId: string) => 
  state.teams.teams.find(team => team.id === teamId);

export const selectTeamsByUser = (state: { teams: TeamsState }, userId: string) => 
  state.teams.teams.filter(team => 
    team.members.some(member => member.userId === userId)
  );

export const selectTeamPerformance = (state: { teams: TeamsState }, teamId: string) => 
  state.teams.performanceData[teamId];

export const selectTeamRanking = (state: { teams: TeamsState }) => {
  return [...state.teams.teams]
    .sort((a, b) => b.performance.score - a.performance.score)
    .map((team, index) => ({
      ...team,
      rank: index + 1,
    }));
};

export const selectActiveTeams = (state: { teams: TeamsState }) => 
  state.teams.teams.filter(team => team.status === 'active');

export const selectTeamLeadTeams = (state: { teams: TeamsState }, userId: string) => 
  state.teams.teams.filter(team => team.leadId === userId);

export default teamsSlice.reducer;