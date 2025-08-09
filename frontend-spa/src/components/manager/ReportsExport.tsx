import React from 'react';
import { Card, Button, Row, Col, DatePicker, Select, Space, List } from 'antd';
import { DownloadOutlined, FileTextOutlined, CalendarOutlined } from '@ant-design/icons';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ReportsExport: React.FC = () => {
  const reports = [
    { id: 1, name: 'Team Performance Report', type: 'PDF', date: '2024-01-15', size: '2.3 MB' },
    { id: 2, name: 'Task Completion Analysis', type: 'Excel', date: '2024-01-14', size: '1.8 MB' },
    { id: 3, name: 'Employee Attendance Report', type: 'CSV', date: '2024-01-13', size: '456 KB' },
  ];

  return (
    <div className="reports-export">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Generate New Report">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select placeholder="Select report type" style={{ width: '100%' }}>
                <Option value="performance">Team Performance</Option>
                <Option value="tasks">Task Analysis</Option>
                <Option value="attendance">Attendance Report</Option>
              </Select>
              <RangePicker style={{ width: '100%' }} />
              <Select placeholder="Export format" style={{ width: '100%' }}>
                <Option value="pdf">PDF</Option>
                <Option value="excel">Excel</Option>
                <Option value="csv">CSV</Option>
              </Select>
              <Button type="primary" block icon={<DownloadOutlined />}>
                Generate Report
              </Button>
            </Space>
          </Card>
        </Col>
        
        <Col xs={24} md={12}>
          <Card title="Recent Reports">
            <List
              itemLayout="horizontal"
              dataSource={reports}
              renderItem={(report) => (
                <List.Item
                  actions={[
                    <Button size="small" icon={<DownloadOutlined />} />,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<FileTextOutlined />}
                    title={report.name}
                    description={
                      <div>
                        <div>{report.type} • {report.size}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          <CalendarOutlined /> {report.date}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ReportsExport;