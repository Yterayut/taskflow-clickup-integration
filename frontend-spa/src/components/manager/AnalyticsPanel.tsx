import React from 'react';
import { Card, Row, Col, Statistic, Progress } from 'antd';
import { BarChartOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';

const AnalyticsPanel: React.FC = () => {
  return (
    <div className="analytics-panel">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Task Completion Rate"
              value={78}
              precision={1}
              suffix="%"
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
            <Progress percent={78} size="small" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Team Productivity"
              value={85}
              precision={1}
              suffix="%"
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Progress percent={85} size="small" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Average Response Time"
              value={2.4}
              precision={1}
              suffix="hrs"
              prefix={<FallOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AnalyticsPanel;