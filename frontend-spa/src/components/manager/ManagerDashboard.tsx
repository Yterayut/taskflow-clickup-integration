import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Button, 
  Select, 
  DatePicker, 
  Space,
  Tabs,
  Progress,
  Tag,
  Avatar,
  Tooltip
} from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  BarChartOutlined,
  DownloadOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { RootState } from '../../store';
import { fetchDashboardData } from '../../store/slices/dashboardSlice';
import { fetchAllTasks } from '../../store/slices/tasksSlice';
import { fetchTeams } from '../../store/slices/teamsSlice';
import { fetchUsers } from '../../store/slices/usersSlice';
import DashboardOverview from './DashboardOverview';
import AllTasksManager from './AllTasksManager';
import TeamOverview from './TeamOverview';
import AnalyticsPanel from './AnalyticsPanel';
import EmployeeManagement from './EmployeeManagement';
import TeamRanking from './TeamRanking';
import ReportsExport from './ReportsExport';
import AttendanceManager from './AttendanceManager';

const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

const ManagerDashboard: React.FC = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  
  const { dashboardData, loading: dashboardLoading } = useSelector((state: RootState) => state.dashboard);
  const { tasks, loading: tasksLoading } = useSelector((state: RootState) => state.tasks);
  const { teams, loading: teamsLoading } = useSelector((state: RootState) => state.teams);
  const { users, loading: usersLoading } = useSelector((state: RootState) => state.users);

  useEffect(() => {
    // Load all necessary data
    dispatch(fetchDashboardData());
    dispatch(fetchAllTasks());
    dispatch(fetchTeams());
    dispatch(fetchUsers());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchDashboardData());
    dispatch(fetchAllTasks());
    dispatch(fetchTeams());
    dispatch(fetchUsers());
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <DashboardOverview />;
      case 'all-tasks':
        return <AllTasksManager />;
      case 'team-overview':
        return <TeamOverview />;
      case 'analytics':
        return <AnalyticsPanel />;
      case 'employee-management':
        return <EmployeeManagement />;
      case 'ranking':
        return <TeamRanking />;
      case 'reports':
        return <ReportsExport />;
      case 'attendance':
        return <AttendanceManager />;
      default:
        return <DashboardOverview />;
    }
  };

  const tabItems = [
    {
      key: 'overview',
      label: 'Dashboard Overview',
      icon: <BarChartOutlined />,
    },
    {
      key: 'all-tasks',
      label: 'All Tasks',
      icon: <CheckCircleOutlined />,
    },
    {
      key: 'team-overview',
      label: 'Team Overview',
      icon: <TeamOutlined />,
    },
    {
      key: 'analytics',
      label: 'Analytics',
      icon: <BarChartOutlined />,
    },
    {
      key: 'employee-management',
      label: 'Employee Management',
      icon: <UserOutlined />,
    },
    {
      key: 'ranking',
      label: 'Team Ranking',
      icon: <BarChartOutlined />,
    },
    {
      key: 'reports',
      label: 'Reports',
      icon: <DownloadOutlined />,
    },
    {
      key: 'attendance',
      label: 'Attendance',
      icon: <ClockCircleOutlined />,
    },
  ];

  return (
    <div className="manager-dashboard">
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Manager Dashboard</h2>
        <Space>
          <Select
            value={selectedTeam}
            onChange={setSelectedTeam}
            style={{ width: 150 }}
            placeholder="Select Team"
          >
            <Option value="all">All Teams</Option>
            {teams.map(team => (
              <Option key={team.id} value={team.id}>{team.name}</Option>
            ))}
          </Select>
          <RangePicker onChange={setDateRange} />
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            loading={dashboardLoading || tasksLoading || teamsLoading || usersLoading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={tabItems}
      />

      <div style={{ marginTop: '24px' }}>
        {getTabContent()}
      </div>
    </div>
  );
};

export default ManagerDashboard;