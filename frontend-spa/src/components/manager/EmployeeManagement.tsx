import React from 'react';
import { Card, Table, Button, Tag, Avatar, Space } from 'antd';
import { UserOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const EmployeeManagement: React.FC = () => {
  const employees = [
    { id: 1, name: 'John Doe', role: 'Developer', team: 'Development', status: 'active', performance: 'high' },
    { id: 2, name: 'Jane Smith', role: 'Designer', team: 'Design', status: 'active', performance: 'medium' },
    { id: 3, name: 'Bob Johnson', role: 'Marketing', team: 'Marketing', status: 'active', performance: 'high' },
  ];

  const columns = [
    {
      title: 'Employee',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Avatar size="small" icon={<UserOutlined />} />
          {name}
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
    },
    {
      title: 'Team',
      dataIndex: 'team',
      key: 'team',
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
      title: 'Performance',
      dataIndex: 'performance',
      key: 'performance',
      render: (performance: string) => (
        <Tag color={performance === 'high' ? 'green' : performance === 'medium' ? 'orange' : 'red'}>
          {performance.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button size="small" icon={<EditOutlined />} />
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Space>
      ),
    },
  ];

  return (
    <div className="employee-management">
      <Card title="Employee Management">
        <Table
          columns={columns}
          dataSource={employees}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default EmployeeManagement;