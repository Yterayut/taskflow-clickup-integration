import React from 'react';
import { Card, Form, Input, Button, Avatar, Upload, Row, Col, Divider, Tag, Progress } from 'antd';
import { UserOutlined, EditOutlined, UploadOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';

const { TextArea } = Input;

interface MyProfileProps {
  userId?: string;
}

const MyProfile: React.FC<MyProfileProps> = ({ userId }) => {
  const [form] = Form.useForm();

  const userProfile = {
    name: 'John Doe',
    email: 'john.doe@company.com',
    phone: '+1234567890',
    role: 'Senior Developer',
    team: 'Development Team',
    department: 'Engineering',
    joinDate: '2023-01-15',
    bio: 'Experienced full-stack developer with expertise in React, Node.js, and cloud technologies.',
    skills: ['React', 'Node.js', 'TypeScript', 'AWS', 'MongoDB', 'GraphQL'],
    performance: {
      overall: 85,
      technical: 90,
      communication: 82,
      leadership: 78,
    },
    achievements: [
      'Employee of the Month - December 2023',
      'Completed Advanced React Certification',
      'Led successful migration to TypeScript',
    ],
  };

  const handleSubmit = (values: any) => {
    console.log('Profile update:', values);
    // Handle profile update
  };

  return (
    <div className="my-profile">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card title="Profile Picture" actions={[<EditOutlined key="edit" />]}>
            <div style={{ textAlign: 'center' }}>
              <Avatar size={120} icon={<UserOutlined />} style={{ marginBottom: '16px' }} />
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>{userProfile.name}</h3>
                <p style={{ margin: 0, color: '#666' }}>{userProfile.role}</p>
                <p style={{ margin: 0, color: '#666' }}>{userProfile.team}</p>
              </div>
              <Upload>
                <Button icon={<UploadOutlined />}>Change Photo</Button>
              </Upload>
            </div>
          </Card>

          <Card title="Quick Stats" style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Overall Performance</span>
                <span>{userProfile.performance.overall}%</span>
              </div>
              <Progress percent={userProfile.performance.overall} size="small" />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Technical Skills</span>
                <span>{userProfile.performance.technical}%</span>
              </div>
              <Progress percent={userProfile.performance.technical} size="small" />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Communication</span>
                <span>{userProfile.performance.communication}%</span>
              </div>
              <Progress percent={userProfile.performance.communication} size="small" />
            </div>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Leadership</span>
                <span>{userProfile.performance.leadership}%</span>
              </div>
              <Progress percent={userProfile.performance.leadership} size="small" />
            </div>
          </Card>
        </Col>
        
        <Col xs={24} md={16}>
          <Card title="Personal Information" extra={<Button icon={<EditOutlined />}>Edit</Button>}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={userProfile}
            >
              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="name"
                    label="Full Name"
                    rules={[{ required: true, message: 'Please enter your name' }]}
                  >
                    <Input prefix={<UserOutlined />} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}
                  >
                    <Input prefix={<MailOutlined />} />
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="phone"
                    label="Phone"
                    rules={[{ required: true, message: 'Please enter your phone number' }]}
                  >
                    <Input prefix={<PhoneOutlined />} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="department" label="Department">
                    <Input disabled />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item name="bio" label="Bio">
                <TextArea rows={4} placeholder="Tell us about yourself..." />
              </Form.Item>
              
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Update Profile
                </Button>
              </Form.Item>
            </Form>
          </Card>
          
          <Card title="Skills & Expertise" style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '16px' }}>
              {userProfile.skills.map((skill, index) => (
                <Tag key={index} color="blue" style={{ marginBottom: '8px' }}>
                  {skill}
                </Tag>
              ))}
            </div>
            <Button icon={<EditOutlined />}>Manage Skills</Button>
          </Card>
          
          <Card title="Achievements" style={{ marginTop: '16px' }}>
            <ul>
              {userProfile.achievements.map((achievement, index) => (
                <li key={index} style={{ marginBottom: '8px' }}>
                  {achievement}
                </li>
              ))}
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MyProfile;