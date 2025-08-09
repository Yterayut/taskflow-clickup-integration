import React from 'react';
import { Card, Table, Tag, Avatar, Button, Space, Progress } from 'antd';
import { UserOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';

interface TeamTasksProps {
  teamId?: string;
}

const TeamTasks: React.FC<TeamTasksProps> = ({ teamId }) => {
  const tasks = [
    { id: 1, title: 'API Integration', assignee: 'John Doe', status: 'in_progress', priority: 'high', progress: 75 },
    { id: 2, title: 'UI Design', assignee: 'Jane Smith', status: 'pending', priority: 'medium', progress: 0 },
    { id: 3, title: 'Bug Fix', assignee: 'Bob Johnson', status: 'completed', priority: 'urgent', progress: 100 },
    { id: 4, title: 'Testing', assignee: 'Alice Brown', status: 'in_progress', priority: 'medium', progress: 50 },
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

  const columns = [
    {
      title: 'Task',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => (
        <div style={{ fontWeight: 'bold' }}>{title}</div>
      ),
    },
    {
      title: 'Assignee',
      dataIndex: 'assignee',
      key: 'assignee',
      render: (assignee: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Avatar size="small" icon={<UserOutlined />} />
          {assignee}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>
          {priority.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => (
        <Progress percent={progress} size="small" style={{ width: '100px' }} />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} />
          <Button size="small" icon={<EditOutlined />} />
        </Space>
      ),
    },
  ];

  return (
    <div className="team-tasks">
      <Card title="Team Tasks">
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default TeamTasks;