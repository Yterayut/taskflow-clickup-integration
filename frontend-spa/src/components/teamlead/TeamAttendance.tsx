import React from 'react';
import { Card, Table, Tag, Avatar, Calendar, Badge } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface TeamAttendanceProps {
  teamId?: string;
}

const TeamAttendance: React.FC<TeamAttendanceProps> = ({ teamId }) => {
  const attendance = [
    { id: 1, name: 'John Doe', status: 'present', checkIn: '09:00', checkOut: '17:00', hours: 8 },
    { id: 2, name: 'Jane Smith', status: 'present', checkIn: '09:15', checkOut: '17:15', hours: 8 },
    { id: 3, name: 'Bob Johnson', status: 'absent', checkIn: '-', checkOut: '-', hours: 0 },
    { id: 4, name: 'Alice Brown', status: 'late', checkIn: '09:30', checkOut: '17:00', hours: 7.5 },
  ];

  const columns = [
    {
      title: 'Member',
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

  const getListData = (value: moment.Moment) => {
    const random = Math.random() * 3;
    if (random > 2) {
      return [
        { type: 'warning', content: 'Team meeting at 10:00 AM' },
        { type: 'success', content: 'All members present' },
      ];
    } else if (random > 1) {
      return [
        { type: 'error', content: '1 member absent' },
      ];
    }
    return [];
  };

  const dateCellRender = (value: moment.Moment) => {
    const listData = getListData(value);
    return (
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {listData.map((item, index) => (
          <li key={index}>
            <Badge 
              status={item.type as any} 
              text={item.content} 
              style={{ fontSize: '10px' }}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="team-attendance">
      <Card title="Today's Attendance" style={{ marginBottom: '16px' }}>
        <Table
          columns={columns}
          dataSource={attendance}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      <Card title="Attendance Calendar">
        <Calendar 
          dateCellRender={dateCellRender}
          style={{ border: 'none' }}
        />
      </Card>
    </div>
  );
};

export default TeamAttendance;