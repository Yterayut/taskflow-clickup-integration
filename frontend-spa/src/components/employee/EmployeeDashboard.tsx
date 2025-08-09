import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Card, 
  Row, 
  Col, 
  Tabs, 
  Button, 
  Space, 
  DatePicker,
  Statistic,
  Tag,
  Progress,
  Avatar,
  List,
  Badge,
  Calendar,
  Alert
} from 'antd';
import { 
  UserOutlined, 
  UnorderedListOutlined as TasksOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  BookOutlined,
  CalendarOutlined,
  ReloadOutlined,
  TrophyOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { RootState } from '../../store';
import { fetchUserTasks } from '../../store/slices/tasksSlice';
import { fetchUserProfile } from '../../store/slices/usersSlice';
import MyDashboard from './MyDashboard';
import MyTasks from './MyTasks';
import MyProfile from './MyProfile';
import KnowledgeManagement from './KnowledgeManagement';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

const EmployeeDashboard: React.FC = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dateRange, setDateRange] = useState<any>(null);
  
  const { user } = useSelector((state: RootState) => state.auth);
  const { tasks, loading: tasksLoading } = useSelector((state: RootState) => state.tasks);
  const { users, loading: usersLoading } = useSelector((state: RootState) => state.users);

  // Get user's tasks
  const userTasks = tasks.filter(t => t.assigneeId === user?.id);
  const currentUser = users.find(u => u.id === user?.id);

  useEffect(() => {
    if (user) {
      dispatch(fetchUserTasks(user.id));
      dispatch(fetchUserProfile(user.id));
    }
  }, [dispatch, user]);

  const handleRefresh = () => {
    if (user) {
      dispatch(fetchUserTasks(user.id));
      dispatch(fetchUserProfile(user.id));
    }
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <MyDashboard userId={user?.id} />;
      case 'tasks':
        return <MyTasks userId={user?.id} />;
      case 'profile':
        return <MyProfile userId={user?.id} />;
      case 'knowledge':
        return <KnowledgeManagement userId={user?.id} />;
      default:
        return <MyDashboard userId={user?.id} />;
    }
  };

  // Calculate user stats
  const totalTasks = userTasks.length;
  const completedTasks = userTasks.filter(t => t.status === 'completed').length;
  const pendingTasks = userTasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = userTasks.filter(t => t.status === 'in_progress').length;
  const overdueTasks = userTasks.filter(t => t.status === 'overdue').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get today's tasks
  const todayTasks = userTasks.filter(t => 
    dayjs(t.dueDate).isSame(dayjs(), 'day') || 
    dayjs(t.updatedAt).isSame(dayjs(), 'day')
  );

  // Get this week's completed tasks
  const weeklyCompletedTasks = userTasks.filter(t => 
    t.status === 'completed' && 
    dayjs(t.updatedAt).isSame(dayjs(), 'week')
  ).length;

  const tabItems = [
    {
      key: 'dashboard',
      label: 'My Dashboard',
      icon: <UserOutlined />,
    },
    {
      key: 'tasks',
      label: 'My Tasks',
      icon: <UnorderedListOutlined as TasksOutlined />,
    },
    {
      key: 'profile',
      label: 'My Profile',
      icon: <UserOutlined />,
    },
    {
      key: 'knowledge',
      label: 'Knowledge Management',
      icon: <BookOutlined />,
    },
  ];

  return (
    <div className="employee-dashboard">
      <div style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Avatar size="large" icon={<UserOutlined />} />
              Welcome back, {user?.name}!
            </h2>
            <p style={{ margin: 0, color: '#666' }}>
              {user?.role} • {currentUser?.teamName || 'No team assigned'}
            </p>
          </Col>
          <Col>
            <Space>
              <RangePicker onChange={setDateRange} />
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleRefresh}
                loading={tasksLoading || usersLoading}
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Quick Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Tasks"
              value={totalTasks}
              prefix={<UnorderedListOutlined as TasksOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Completed"
              value={completedTasks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="In Progress"
              value={inProgressTasks}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
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

      {/* Alerts and Quick Actions */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} md={8}>
          <Card title="Quick Actions" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" block icon={<UnorderedListOutlined as TasksOutlined />}>
                View All Tasks
              </Button>
              <Button block icon={<UserOutlined />}>
                Update Profile
              </Button>
              <Button block icon={<BookOutlined />}>
                Knowledge Base
              </Button>
            </Space>
          </Card>
        </Col>
        
        <Col xs={24} md={8}>
          <Card title="Today's Focus" size="small">
            {todayTasks.length > 0 ? (
              <List
                size="small"
                dataSource={todayTasks.slice(0, 3)}
                renderItem={(task) => (
                  <List.Item style={{ padding: '4px 0' }}>
                    <List.Item.Meta
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px' }}>{task.title}</span>
                          <Tag color={task.status === 'completed' ? 'green' : task.status === 'overdue' ? 'red' : 'blue'}>
                            {task.status}
                          </Tag>
                        </div>
                      }
                      description={
                        <span style={{ fontSize: '12px' }}>
                          Due: {dayjs(task.dueDate).format('MMM DD')}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                <CheckCircleOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                <div>No tasks for today</div>
              </div>
            )}
          </Card>
        </Col>
        
        <Col xs={24} md={8}>
          <Card title="Weekly Progress" size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                {weeklyCompletedTasks}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>tasks completed this week</div>
              
              {overdueTasks > 0 && (
                <Alert 
                  message={`${overdueTasks} overdue tasks`}
                  type="warning"
                  showIcon
                  style={{ marginTop: '12px' }}
                  icon={<WarningOutlined />}
                />
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Performance Summary */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <h4>Performance Summary</h4>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge color="green" />
                <span>Completed: {completedTasks}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge color="blue" />
                <span>In Progress: {inProgressTasks}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge color="orange" />
                <span>Pending: {pendingTasks}</span>
              </div>
              {overdueTasks > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge color="red" />
                  <span>Overdue: {overdueTasks}</span>
                </div>
              )}
            </div>
          </Col>
          <Col xs={24} md={12}>
            <h4>Recent Achievements</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrophyOutlined style={{ color: '#faad14' }} />
              <span>
                {weeklyCompletedTasks > 0 
                  ? `${weeklyCompletedTasks} tasks completed this week` 
                  : 'No achievements this week'
                }
              </span>
            </div>
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

export default EmployeeDashboard;