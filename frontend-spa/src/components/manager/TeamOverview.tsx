import React from 'react';
import { Card, Row, Col, Statistic, Progress, List, Avatar, Tag } from 'antd';
import { TeamOutlined, UserOutlined, TrophyOutlined } from '@ant-design/icons';

const TeamOverview: React.FC = () => {
  // Placeholder data
  const teams = [
    { id: 1, name: 'Development', members: 8, performance: 85, status: 'active' },
    { id: 2, name: 'Marketing', members: 5, performance: 78, status: 'active' },
    { id: 3, name: 'Design', members: 4, performance: 92, status: 'active' },
  ];

  return (
    <div className="team-overview">
      <Row gutter={[16, 16]}>
        {teams.map(team => (
          <Col xs={24} md={8} key={team.id}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TeamOutlined />
                  {team.name}
                </div>
              }
              extra={<Tag color="green">{team.status}</Tag>}
            >
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Members"
                    value={team.members}
                    prefix={<UserOutlined />}
                  />
                </Col>
                <Col span={12}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#666' }}>Performance</div>
                    <Progress percent={team.performance} size="small" />
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default TeamOverview;