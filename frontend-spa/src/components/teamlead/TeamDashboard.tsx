import React from 'react';
import { Card, Row, Col, Statistic, Progress, List, Avatar } from 'antd';
import { TeamOutlined, UserOutlined, UnorderedListOutlined as TasksOutlined, CheckCircleOutlined } from '@ant-design/icons';

interface TeamDashboardProps {
  teamId?: string;
}

const TeamDashboard: React.FC<TeamDashboardProps> = ({ teamId }) => {
  const teamStats = {
    totalMembers: 8,
    activeTasks: 24,
    completedTasks: 18,
    completionRate: 75,
  };

  const recentActivity = [
    { id: 1, user: 'John Doe', action: 'completed task "API Integration"', time: '2 hours ago' },
    { id: 2, user: 'Jane Smith', action: 'started task "UI Design"', time: '3 hours ago' },
    { id: 3, user: 'Bob Johnson', action: 'commented on "Bug Fix"', time: '5 hours ago' },
  ];

  return (
    <div className="team-dashboard">
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Team Members"
              value={teamStats.totalMembers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Active Tasks"
              value={teamStats.activeTasks}
              prefix={<UnorderedListOutlined as TasksOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Completed"
              value={teamStats.completedTasks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <div>
              <div style={{ fontSize: '14px', color: '#666' }}>Completion Rate</div>
              <Progress percent={teamStats.completionRate} size="small" />
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Team Performance">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Progress
                type="circle"
                percent={teamStats.completionRate}
                width={120}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  {teamStats.completionRate}%
                </div>
                <div style={{ color: '#666' }}>Team Efficiency</div>
              </div>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} md={12}>
          <Card title="Recent Activity">
            <List
              itemLayout="horizontal"
              dataSource={recentActivity}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar size="small" icon={<UserOutlined />} />}
                    title={item.user}
                    description={
                      <div>
                        <div>{item.action}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{item.time}</div>
                      </div>
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

export default TeamDashboard;