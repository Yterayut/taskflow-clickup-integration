import React from 'react';
import { Card, Table, Avatar, Tag, Button, Space, Progress } from 'antd';
import { UserOutlined, EditOutlined, MessageOutlined } from '@ant-design/icons';

interface TeamMembersProps {
  teamId?: string;
}

const TeamMembers: React.FC<TeamMembersProps> = ({ teamId }) => {
  const members = [
    { id: 1, name: 'John Doe', role: 'Senior Developer', performance: 85, status: 'active', tasksCompleted: 12 },
    { id: 2, name: 'Jane Smith', role: 'Developer', performance: 92, status: 'active', tasksCompleted: 15 },
    { id: 3, name: 'Bob Johnson', role: 'Junior Developer', performance: 78, status: 'active', tasksCompleted: 8 },
    { id: 4, name: 'Alice Brown', role: 'QA Engineer', performance: 88, status: 'active', tasksCompleted: 10 },
  ];

  const columns = [
    {
      title: 'Member',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 'bold' }}>{name}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{record.role}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Performance',
      dataIndex: 'performance',
      key: 'performance',
      render: (performance: number) => (
        <div style={{ width: '100px' }}>
          <Progress percent={performance} size="small" />
        </div>
      ),
    },
    {
      title: 'Tasks Completed',
      dataIndex: 'tasksCompleted',
      key: 'tasksCompleted',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button size="small" icon={<MessageOutlined />} />
          <Button size="small" icon={<EditOutlined />} />
        </Space>
      ),
    },
  ];

  return (
    <div className="team-members">
      <Card title="Team Members">
        <Table
          columns={columns}
          dataSource={members}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default TeamMembers;