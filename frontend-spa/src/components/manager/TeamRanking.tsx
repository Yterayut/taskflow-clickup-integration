import React from 'react';
import { Card, List, Avatar, Progress, Tag } from 'antd';
import { TrophyOutlined, TeamOutlined } from '@ant-design/icons';

const TeamRanking: React.FC = () => {
  const rankings = [
    { id: 1, name: 'Design Team', score: 95, trend: 'up', grade: 'A+' },
    { id: 2, name: 'Development Team', score: 88, trend: 'up', grade: 'A' },
    { id: 3, name: 'Marketing Team', score: 76, trend: 'down', grade: 'B+' },
    { id: 4, name: 'Support Team', score: 82, trend: 'stable', grade: 'B+' },
  ];

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'green';
    if (grade.startsWith('B')) return 'blue';
    if (grade.startsWith('C')) return 'orange';
    return 'red';
  };

  return (
    <div className="team-ranking">
      <Card title="Team Performance Ranking" extra={<TrophyOutlined />}>
        <List
          itemLayout="horizontal"
          dataSource={rankings}
          renderItem={(item, index) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '50%', 
                      background: index === 0 ? '#faad14' : index === 1 ? '#d9d9d9' : '#cd7f32',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: 'white'
                    }}>
                      {index + 1}
                    </div>
                    <Avatar size="small" icon={<TeamOutlined />} />
                  </div>
                }
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{item.name}</span>
                    <Tag color={getGradeColor(item.grade)}>{item.grade}</Tag>
                  </div>
                }
                description={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Progress percent={item.score} size="small" style={{ width: '100px' }} />
                    <span>{item.score} points</span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default TeamRanking;