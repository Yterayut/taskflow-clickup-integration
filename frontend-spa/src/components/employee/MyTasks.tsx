import React from 'react';
import { Card, Table, Tag, Button, Space, Select, Input, Progress } from 'antd';
import { 
  EditOutlined, 
  EyeOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  CheckCircleOutlined,
  SearchOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { Search } = Input;

interface MyTasksProps {
  userId?: string;
}

const MyTasks: React.FC<MyTasksProps> = ({ userId }) => {
  const tasks = [
    { 
      id: 1, 
      title: 'API Integration', 
      description: 'Integrate third-party API for user authentication',
      status: 'in_progress', 
      priority: 'high', 
      progress: 75,
      dueDate: '2024-01-15',
      estimatedHours: 8,
      spentHours: 6
    },
    { 
      id: 2, 
      title: 'UI Design Review', 
      description: 'Review and provide feedback on new UI mockups',
      status: 'pending', 
      priority: 'medium', 
      progress: 0,
      dueDate: '2024-01-16',
      estimatedHours: 4,
      spentHours: 0
    },
    { 
      id: 3, 
      title: 'Bug Fix - Login Issue', 
      description: 'Fix the login validation bug reported by QA',
      status: 'completed', 
      priority: 'urgent', 
      progress: 100,
      dueDate: '2024-01-14',
      estimatedHours: 2,
      spentHours: 2.5
    },
    { 
      id: 4, 
      title: 'Documentation Update', 
      description: 'Update API documentation with new endpoints',
      status: 'pending', 
      priority: 'low', 
      progress: 0,
      dueDate: '2024-01-18',
      estimatedHours: 3,
      spentHours: 0
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'in_progress': return 'blue';
      case 'pending': return 'orange';
      case 'overdue': return 'red';
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

  const getActionButton = (status: string) => {
    switch (status) {
      case 'pending':
        return <Button size="small" type="primary" icon={<PlayCircleOutlined />}>Start</Button>;
      case 'in_progress':
        return <Button size="small" icon={<PauseCircleOutlined />}>Pause</Button>;
      case 'completed':
        return <Button size="small" disabled icon={<CheckCircleOutlined />}>Done</Button>;
      default:
        return <Button size="small">Action</Button>;
    }
  };

  const columns = [
    {
      title: 'Task',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: any) => (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{title}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.description}</div>
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
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
    },
    {
      title: 'Time',
      key: 'time',
      render: (_, record: any) => (
        <div style={{ fontSize: '12px' }}>
          <div>{record.spentHours}h / {record.estimatedHours}h</div>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} />
          <Button size="small" icon={<EditOutlined />} />
          {getActionButton(record.status)}
        </Space>
      ),
    },
  ];

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    pending: tasks.filter(t => t.status === 'pending').length,
  };

  return (
    <div className="my-tasks">
      <Card 
        title="My Tasks"
        extra={
          <Space>
            <Search 
              placeholder="Search tasks..." 
              style={{ width: 200 }}
              prefix={<SearchOutlined />}
            />
            <Select defaultValue="all" style={{ width: 120 }}>
              <Option value="all">All Status</Option>
              <Option value="pending">Pending</Option>
              <Option value="in_progress">In Progress</Option>
              <Option value="completed">Completed</Option>
            </Select>
          </Space>
        }
      >
        <div style={{ marginBottom: '16px' }}>
          <Space>
            <Tag color="blue">Total: {taskStats.total}</Tag>
            <Tag color="green">Completed: {taskStats.completed}</Tag>
            <Tag color="orange">In Progress: {taskStats.inProgress}</Tag>
            <Tag color="gray">Pending: {taskStats.pending}</Tag>
          </Space>
        </div>
        
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default MyTasks;