import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  Space,
  Tag, 
  Tooltip, 
  Popconfirm,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Switch,
  Dropdown,
  Menu
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  FilterOutlined,
  SearchOutlined,
  DownloadOutlined,
  ReloadOutlined,
  EyeOutlined,
  UserOutlined,
  CalendarOutlined,
  FlagOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { RootState } from '../../store';
import { fetchAllTasks, createTask, updateTask, deleteTask } from '../../store/slices/tasksSlice';
import { fetchUsers } from '../../store/slices/usersSlice';
import { fetchTeams } from '../../store/slices/teamsSlice';
import dayjs from 'dayjs';

const { Option } = Select;
const { Search } = Input;
const { TextArea } = Input;

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId: string;
  assigneeName: string;
  teamId: string;
  teamName: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

const AllTasksManager: React.FC = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  const { tasks, loading } = useSelector((state: RootState) => state.tasks);
  const { users } = useSelector((state: RootState) => state.users);
  const { teams } = useSelector((state: RootState) => state.teams);

  useEffect(() => {
    dispatch(fetchAllTasks());
    dispatch(fetchUsers());
    dispatch(fetchTeams());
  }, [dispatch]);

  const handleCreateTask = () => {
    setEditingTask(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    form.setFieldsValue({
      ...task,
      dueDate: task.dueDate ? dayjs(task.dueDate) : null,
    });
    setIsModalVisible(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await dispatch(deleteTask(taskId));
      message.success('Task deleted successfully');
    } catch (error) {
      message.error('Failed to delete task');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const taskData = {
        ...values,
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
      };

      if (editingTask) {
        await dispatch(updateTask({ id: editingTask.id, ...taskData }));
        message.success('Task updated successfully');
      } else {
        await dispatch(createTask(taskData));
        message.success('Task created successfully');
      }

      setIsModalVisible(false);
      form.resetFields();
      setEditingTask(null);
    } catch (error) {
      message.error('Failed to save task');
    }
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingTask(null);
  };

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

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchText.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchText.toLowerCase()) ||
                         task.assigneeName.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesTeam = teamFilter === 'all' || task.teamId === teamFilter;
    const matchesOverdue = !showOverdueOnly || task.status === 'overdue';

    return matchesSearch && matchesStatus && matchesPriority && matchesTeam && matchesOverdue;
  });

  const columns = [
    {
      title: 'Task',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Task) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{title}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.description}</div>
        </div>
      ),
    },
    {
      title: 'Assignee',
      dataIndex: 'assigneeName',
      key: 'assigneeName',
      render: (name: string, record: Task) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserOutlined />
          <div>
            <div>{name}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{record.teamName}</div>
          </div>
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
        <Tag color={getPriorityColor(priority)} icon={<FlagOutlined />}>
          {priority.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (dueDate: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CalendarOutlined />
          {dueDate ? dayjs(dueDate).format('MMM DD, YYYY') : 'No due date'}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: Task) => (
        <Space>
          <Tooltip title="View Details">
            <Button size="small" icon={<EyeOutlined />} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEditTask(record)} />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this task?"
            onConfirm={() => handleDeleteTask(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Quick stats
  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.status === 'completed').length;
  const overdueTasks = filteredTasks.filter(t => t.status === 'overdue').length;
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress').length;

  return (
    <div className="all-tasks-manager">
      {/* Quick Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Total Tasks" value={totalTasks} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Completed" value={completedTasks} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="In Progress" value={inProgressTasks} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Overdue" value={overdueTasks} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
      </Row>

      {/* Filters and Actions */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Search
              placeholder="Search tasks..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} md={4}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
              placeholder="Status"
            >
              <Option value="all">All Status</Option>
              <Option value="pending">Pending</Option>
              <Option value="in_progress">In Progress</Option>
              <Option value="completed">Completed</Option>
              <Option value="overdue">Overdue</Option>
            </Select>
          </Col>
          <Col xs={24} md={4}>
            <Select
              value={priorityFilter}
              onChange={setPriorityFilter}
              style={{ width: '100%' }}
              placeholder="Priority"
            >
              <Option value="all">All Priority</Option>
              <Option value="urgent">Urgent</Option>
              <Option value="high">High</Option>
              <Option value="medium">Medium</Option>
              <Option value="low">Low</Option>
            </Select>
          </Col>
          <Col xs={24} md={4}>
            <Select
              value={teamFilter}
              onChange={setTeamFilter}
              style={{ width: '100%' }}
              placeholder="Team"
            >
              <Option value="all">All Teams</Option>
              {teams.map(team => (
                <Option key={team.id} value={team.id}>{team.name}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={4}>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTask}>
                New Task
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => dispatch(fetchAllTasks())} />
            </Space>
          </Col>
        </Row>
        <Row style={{ marginTop: '16px' }}>
          <Col>
            <Space>
              <span>Show overdue only:</span>
              <Switch checked={showOverdueOnly} onChange={setShowOverdueOnly} />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tasks Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredTasks}
          loading={loading}
          rowKey="id"
          pagination={{
            total: filteredTasks.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} tasks`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Create/Edit Task Modal */}
      <Modal
        title={editingTask ? 'Edit Task' : 'Create New Task'}
        visible={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
        okText={editingTask ? 'Update' : 'Create'}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="Task Title"
            rules={[{ required: true, message: 'Please enter task title' }]}
          >
            <Input placeholder="Enter task title" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter task description' }]}
          >
            <TextArea rows={3} placeholder="Enter task description" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="assigneeId"
                label="Assignee"
                rules={[{ required: true, message: 'Please select assignee' }]}
              >
                <Select placeholder="Select assignee">
                  {users.map(user => (
                    <Option key={user.id} value={user.id}>{user.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="teamId"
                label="Team"
                rules={[{ required: true, message: 'Please select team' }]}
              >
                <Select placeholder="Select team">
                  {teams.map(team => (
                    <Option key={team.id} value={team.id}>{team.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="Priority"
                rules={[{ required: true, message: 'Please select priority' }]}
              >
                <Select placeholder="Select priority">
                  <Option value="low">Low</Option>
                  <Option value="medium">Medium</Option>
                  <Option value="high">High</Option>
                  <Option value="urgent">Urgent</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select placeholder="Select status">
                  <Option value="pending">Pending</Option>
                  <Option value="in_progress">In Progress</Option>
                  <Option value="completed">Completed</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="dueDate" label="Due Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AllTasksManager;