import React from 'react';
import { Card, Row, Col, Statistic, Progress } from 'antd';
import { BarChartOutlined, TrophyOutlined, ClockCircleOutlined } from '@ant-design/icons';

interface TeamAnalyticsProps {
  teamId?: string;
}

const TeamAnalytics: React.FC<TeamAnalyticsProps> = ({ teamId }) => {
  const analytics = {
    productivity: 85,
    efficiency: 78,
    satisfaction: 92,
    avgResponseTime: 2.4,
    tasksPerWeek: 24,
    completionRate: 89,
  };

  return (
    <div className="team-analytics">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Team Productivity"
              value={analytics.productivity}
              suffix="%"
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Progress percent={analytics.productivity} size="small" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Efficiency Score"
              value={analytics.efficiency}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <Progress percent={analytics.efficiency} size="small" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Team Satisfaction"
              value={analytics.satisfaction}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <Progress percent={analytics.satisfaction} size="small" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Avg Response Time"
              value={analytics.avgResponseTime}
              suffix="hrs"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Tasks Per Week"
              value={analytics.tasksPerWeek}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Completion Rate"
              value={analytics.completionRate}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TeamAnalytics;