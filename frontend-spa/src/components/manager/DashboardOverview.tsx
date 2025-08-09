import React from 'react';
import { useSelector } from 'react-redux';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Progress, 
  List, 
  Avatar, 
  Tag,
  Timeline,
  Spin
} from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { RootState } from '../../store';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const DashboardOverview: React.FC = () => {
  const { dashboardData, loading } = useSelector((state: RootState) => state.dashboard);
  const { tasks } = useSelector((state: RootState) => state.tasks);
  const { teams } = useSelector((state: RootState) => state.teams);
  const { users } = useSelector((state: RootState) => state.users);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Calculate statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const pendingTasks = tasks.filter(task => task.status === 'pending').length;
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress').length;
  const overdueTasks = tasks.filter(task => task.status === 'overdue').length;

  const totalUsers = users.length;
  const activeUsers = users.filter(user => user.status === 'active').length;
  const totalTeams = teams.length;

  // Task completion rate
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Performance data for charts
  const taskStatusData = [
    { name: 'Completed', value: completedTasks, color: '#52c41a' },
    { name: 'In Progress', value: inProgressTasks, color: '#1890ff' },
    { name: 'Pending', value: pendingTasks, color: '#faad14' },
    { name: 'Overdue', value: overdueTasks, color: '#f5222d' },
  ];

  const teamPerformanceData = teams.map(team => ({
    team: team.name,
    tasks: tasks.filter(task => task.teamId === team.id).length,
    completed: tasks.filter(task => task.teamId === team.id && task.status === 'completed').length,
  }));

  // Recent activities
  const recentActivities = [
    { type: 'task', content: 'Task "Website Redesign" completed by John Doe', time: '2 hours ago' },
    { type: 'user', content: 'New user Jane Smith added to Marketing team', time: '4 hours ago' },
    { type: 'team', content: 'Development team achieved 95% task completion rate', time: '1 day ago' },
    { type: 'task', content: 'Task "API Integration" marked as overdue', time: '2 days ago' },
  ];

  // Top performers
  const topPerformers = users
    .map(user => ({
      ...user,
      completedTasks: tasks.filter(task => task.assigneeId === user.id && task.status === 'completed').length,
    }))
    .sort((a, b) => b.completedTasks - a.completedTasks)
    .slice(0, 5);

  return (
    <div className="dashboard-overview">
      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Tasks"
              value={totalTasks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Completed Tasks"
              value={completedTasks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Users"
              value={activeUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Teams"
              value={totalTeams}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Progress and Charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} md={12}>
          <Card title="Task Completion Rate" extra={<Tag color="green">{completionRate}%</Tag>}>
            <Progress percent={completionRate} size="small" />
            <div style={{ marginTop: '16px' }}>
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <Statistic
                    title="In Progress"
                    value={inProgressTasks}
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: '#faad14', fontSize: '14px' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Overdue"
                    value={overdueTasks}
                    prefix={<WarningOutlined />}
                    valueStyle={{ color: '#f5222d', fontSize: '14px' }}
                  />
                </Col>
              </Row>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Task Status Distribution">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={taskStatusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {taskStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Recent Activities and Top Performers */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Recent Activities">
            <Timeline>
              {recentActivities.map((activity, index) => (
                <Timeline.Item key={index}>
                  <div style={{ fontSize: '12px', color: '#666' }}>{activity.time}</div>
                  <div>{activity.content}</div>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Top Performers" extra={<TrophyOutlined />}>
            <List
              itemLayout="horizontal"
              dataSource={topPerformers}
              renderItem={(user, index) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar size="small" icon={<UserOutlined />} />}
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{user.name}</span>
                        {index === 0 && <TrophyOutlined style={{ color: '#faad14' }} />}
                      </div>
                    }
                    description={
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{user.role}</span>
                        <Tag color="blue">{user.completedTasks} tasks</Tag>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* Team Performance Chart */}
      <Row style={{ marginTop: '24px' }}>
        <Col span={24}>
          <Card title="Team Performance Comparison">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teamPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="team" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardOverview;