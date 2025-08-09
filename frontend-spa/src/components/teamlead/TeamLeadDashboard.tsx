import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Card, 
  Row, 
  Col, 
  Tabs, 
  Button, 
  Space, 
  Select, 
  DatePicker,
  Statistic,
  Tag,
  Avatar,
  List,
  Progress
} from 'antd';
import { 
  TeamOutlined, 
  UserOutlined, 
  UnorderedListOutlined as TasksOutlined, 
  BarChartOutlined,
  CalendarOutlined,
  ReloadOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { RootState } from '../../store';
import { fetchTeamData } from '../../store/slices/teamsSlice';
import { fetchTeamTasks } from '../../store/slices/tasksSlice';
import { fetchTeamUsers } from '../../store/slices/usersSlice';
import TeamDashboard from './TeamDashboard';
import TeamMembers from './TeamMembers';
import TeamTasks from './TeamTasks';
import TeamAnalytics from './TeamAnalytics';
import TeamAttendance from './TeamAttendance';

const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

const TeamLeadDashboard: React.FC = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dateRange, setDateRange] = useState<any>(null);
  
  const { user } = useSelector((state: RootState) => state.auth);
  const { teams, loading: teamsLoading } = useSelector((state: RootState) => state.teams);
  const { tasks, loading: tasksLoading } = useSelector((state: RootState) => state.tasks);
  const { users, loading: usersLoading } = useSelector((state: RootState) => state.users);

  // Get the team lead's team
  const userTeam = teams.find(team => team.leadId === user?.id);
  const teamMembers = users.filter(u => u.teamId === userTeam?.id);
  const teamTasks = tasks.filter(t => t.teamId === userTeam?.id);

  useEffect(() => {
    if (userTeam) {
      dispatch(fetchTeamData(userTeam.id));
      dispatch(fetchTeamTasks(userTeam.id));
      dispatch(fetchTeamUsers(userTeam.id));
    }
  }, [dispatch, userTeam]);

  const handleRefresh = () => {
    if (userTeam) {
      dispatch(fetchTeamData(userTeam.id));
      dispatch(fetchTeamTasks(userTeam.id));
      dispatch(fetchTeamUsers(userTeam.id));
    }
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <TeamDashboard teamId={userTeam?.id} />;
      case 'members':
        return <TeamMembers teamId={userTeam?.id} />;
      case 'tasks':
        return <TeamTasks teamId={userTeam?.id} />;
      case 'analytics':
        return <TeamAnalytics teamId={userTeam?.id} />;
      case 'attendance':
        return <TeamAttendance teamId={userTeam?.id} />;
      default:
        return <TeamDashboard teamId={userTeam?.id} />;
    }
  };

  // Calculate team stats
  const totalMembers = teamMembers.length;
  const totalTasks = teamTasks.length;
  const completedTasks = teamTasks.filter(t => t.status === 'completed').length;
  const overdueTasks = teamTasks.filter(t => t.status === 'overdue').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const tabItems = [
    {
      key: 'dashboard',
      label: 'Team Dashboard',
      icon: <TeamOutlined />,
    },
    {
      key: 'members',
      label: 'Team Members',
      icon: <UserOutlined />,
    },
    {
      key: 'tasks',
      label: 'Team Tasks',
      icon: <UnorderedListOutlined as TasksOutlined />,
    },
    {
      key: 'analytics',
      label: 'Team Analytics',
      icon: <BarChartOutlined />,
    },
    {
      key: 'attendance',
      label: 'Team Attendance',
      icon: <CalendarOutlined />,
    },
  ];

  if (!userTeam) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <TeamOutlined style={{ fontSize: '48px', color: '#ccc' }} />
          <h3>No Team Assigned</h3>
          <p>You are not currently assigned as a team lead to any team.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="team-lead-dashboard">
      <div style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <TeamOutlined />
              {userTeam.name} - Team Lead Dashboard
            </h2>
          </Col>
          <Col>
            <Space>
              <RangePicker onChange={setDateRange} />
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleRefresh}
                loading={teamsLoading || tasksLoading || usersLoading}
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Quick Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8} md={6}>
          <Card>
            <Statistic
              title="Team Members"
              value={totalMembers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card>
            <Statistic
              title="Total Tasks"
              value={totalTasks}
              prefix={<UnorderedListOutlined as TasksOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card>
            <Statistic
              title="Completed"
              value={completedTasks}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>Completion Rate</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                  {completionRate}%
                </div>
              </div>
              <Progress
                type="circle"
                percent={completionRate}
                width={40}
                strokeColor={completionRate >= 80 ? '#52c41a' : completionRate >= 60 ? '#faad14' : '#f5222d'}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Team Performance Quick View */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <h4>Team Performance</h4>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Tag color="green">High: {teamMembers.filter(m => m.performance === 'high').length}</Tag>
              <Tag color="orange">Medium: {teamMembers.filter(m => m.performance === 'medium').length}</Tag>
              <Tag color="red">Low: {teamMembers.filter(m => m.performance === 'low').length}</Tag>
              {overdueTasks > 0 && <Tag color="red">Overdue: {overdueTasks}</Tag>}
            </div>
          </Col>
          <Col xs={24} md={12}>
            <h4>Top Performers</h4>
            <List
              size="small"
              dataSource={teamMembers.slice(0, 3)}
              renderItem={(member, index) => (
                <List.Item style={{ padding: '4px 0' }}>
                  <List.Item.Meta
                    avatar={<Avatar size="small" icon={<UserOutlined />} />}
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>{member.name}</span>
                        {index === 0 && <TrophyOutlined style={{ color: '#faad14' }} />}
                      </div>
                    }
                    description={
                      <span style={{ fontSize: '12px' }}>
                        {tasks.filter(t => t.assigneeId === member.id && t.status === 'completed').length} tasks completed
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Col>
        </Row>
      </Card>

      {/* Main Content Tabs */}
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

export default TeamLeadDashboard;