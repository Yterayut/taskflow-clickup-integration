import React from 'react';
import { Card, Row, Col, Statistic, Progress, List, Avatar, Tag } from 'antd';
import { 
  UnorderedListOutlined as TasksOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  CalendarOutlined,
  TrophyOutlined,
  UserOutlined
} from '@ant-design/icons';

interface MyDashboardProps {
  userId?: string;
}

const MyDashboard: React.FC<MyDashboardProps> = ({ userId }) => {
  const userStats = {
    totalTasks: 15,
    completedTasks: 12,
    pendingTasks: 2,
    overdueTasks: 1,
    completionRate: 80,
    weeklyGoal: 10,
    weeklyCompleted: 8,
  };

  const recentTasks = [
    { id: 1, title: 'API Integration', status: 'completed', priority: 'high', dueDate: '2024-01-15' },
    { id: 2, title: 'UI Design', status: 'in_progress', priority: 'medium', dueDate: '2024-01-16' },
    { id: 3, title: 'Bug Fix', status: 'pending', priority: 'urgent', dueDate: '2024-01-17' },
  ];

  const achievements = [
    { id: 1, title: 'Task Master', description: 'Completed 10 tasks in a week', icon: '🏆' },
    { id: 2, title: 'Early Bird', description: 'Submitted 5 tasks before deadline', icon: '⏰' },
    { id: 3, title: 'Team Player', description: 'Helped 3 team members', icon: '🤝' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'in_progress': return 'blue';
      case 'pending': return 'orange';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'blue';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  return (
    <div className="my-dashboard">
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8} md={6}>
          <Card>
            <Statistic
              title="Total Tasks"
              value={userStats.totalTasks}
              prefix={<UnorderedListOutlined as TasksOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card>
            <Statistic
              title="Completed"
              value={userStats.completedTasks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card>
            <Statistic
              title="Pending"
              value={userStats.pendingTasks}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card>
            <div>
              <div style={{ fontSize: '14px', color: '#666' }}>Completion Rate</div>
              <Progress percent={userStats.completionRate} size="small" />
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card title="Weekly Goal">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Progress
                type="circle"
                percent={Math.round((userStats.weeklyCompleted / userStats.weeklyGoal) * 100)}
                width={120}
                format={(percent) => `${userStats.weeklyCompleted}/${userStats.weeklyGoal}`}
              />
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {userStats.weeklyCompleted} / {userStats.weeklyGoal}
                </div>
                <div style={{ color: '#666' }}>Tasks This Week</div>
              </div>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} md={8}>
          <Card title="Recent Tasks">
            <List
              itemLayout="horizontal"
              dataSource={recentTasks}
              renderItem={(task) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{task.title}</span>
                        <Tag color={getStatusColor(task.status)} size="small">
                          {task.status}
                        </Tag>
                      </div>
                    }
                    description={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Tag color={getPriorityColor(task.priority)} size="small">
                          {task.priority}
                        </Tag>
                        <span style={{ fontSize: '12px' }}>
                          <CalendarOutlined /> {task.dueDate}
                        </span>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        
        <Col xs={24} md={8}>
          <Card title="Achievements" extra={<TrophyOutlined />}>
            <List
              itemLayout="horizontal"
              dataSource={achievements}
              renderItem={(achievement) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<span style={{ fontSize: '24px' }}>{achievement.icon}</span>}
                    title={achievement.title}
                    description={
                      <span style={{ fontSize: '12px' }}>
                        {achievement.description}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MyDashboard;