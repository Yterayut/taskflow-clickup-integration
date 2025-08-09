import React from 'react';
import { Card, Table, Tag, Avatar, Button, DatePicker, Space, Statistic, Row, Col } from 'antd';
import { UserOutlined, CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const AttendanceManager: React.FC = () => {
  const attendance = [
    { id: 1, name: 'John Doe', date: '2024-01-15', status: 'present', hours: 8, checkIn: '09:00', checkOut: '17:00' },
    { id: 2, name: 'Jane Smith', date: '2024-01-15', status: 'present', hours: 8, checkIn: '09:15', checkOut: '17:15' },
    { id: 3, name: 'Bob Johnson', date: '2024-01-15', status: 'absent', hours: 0, checkIn: '-', checkOut: '-' },
    { id: 4, name: 'Alice Brown', date: '2024-01-15', status: 'late', hours: 7.5, checkIn: '09:30', checkOut: '17:00' },
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
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'present' ? 'green' : status === 'absent' ? 'red' : 'orange';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Check In',
      dataIndex: 'checkIn',
      key: 'checkIn',
    },
    {
      title: 'Check Out',
      dataIndex: 'checkOut',
      key: 'checkOut',
    },
    {
      title: 'Hours',
      dataIndex: 'hours',
      key: 'hours',
      render: (hours: number) => `${hours}h`,
    },
  ];

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;

  return (
    <div className="attendance-manager">
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Present Today"
              value={presentCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Absent Today"
              value={absentCount}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Late Today"
              value={lateCount}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card 
        title="Attendance Overview"
        extra={
          <Space>
            <DatePicker placeholder="Select date" />
            <Button type="primary">View Report</Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={attendance}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default AttendanceManager;