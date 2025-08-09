import React, { useState } from 'react';
import { Card, Input, Button, List, Tag, Space, Tabs, Avatar, Badge } from 'antd';
import { 
  SearchOutlined, 
  BookOutlined, 
  FileTextOutlined, 
  LinkOutlined,
  StarOutlined,
  EyeOutlined,
  PlusOutlined
} from '@ant-design/icons';

const { Search } = Input;
const { TabPane } = Tabs;

interface KnowledgeManagementProps {
  userId?: string;
}

const KnowledgeManagement: React.FC<KnowledgeManagementProps> = ({ userId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('articles');

  const knowledgeArticles = [
    {
      id: 1,
      title: 'React Best Practices Guide',
      type: 'guide',
      author: 'Jane Smith',
      category: 'Development',
      views: 156,
      likes: 23,
      date: '2024-01-10',
      tags: ['React', 'JavaScript', 'Frontend'],
      description: 'Comprehensive guide covering React best practices and patterns.',
    },
    {
      id: 2,
      title: 'API Authentication Methods',
      type: 'tutorial',
      author: 'John Doe',
      category: 'Security',
      views: 89,
      likes: 12,
      date: '2024-01-08',
      tags: ['API', 'Authentication', 'Security'],
      description: 'Different methods for implementing API authentication.',
    },
    {
      id: 3,
      title: 'Database Optimization Tips',
      type: 'article',
      author: 'Bob Johnson',
      category: 'Database',
      views: 234,
      likes: 45,
      date: '2024-01-05',
      tags: ['Database', 'Performance', 'SQL'],
      description: 'Tips and tricks for optimizing database queries.',
    },
  ];

  const quickLinks = [
    { id: 1, title: 'Company Wiki', url: 'https://wiki.company.com', icon: <BookOutlined /> },
    { id: 2, title: 'API Documentation', url: 'https://api.company.com/docs', icon: <FileTextOutlined /> },
    { id: 3, title: 'Style Guide', url: 'https://styleguide.company.com', icon: <LinkOutlined /> },
    { id: 4, title: 'Employee Handbook', url: 'https://handbook.company.com', icon: <BookOutlined /> },
  ];

  const recentActivities = [
    { id: 1, action: 'viewed', item: 'React Best Practices Guide', time: '2 hours ago' },
    { id: 2, action: 'bookmarked', item: 'API Authentication Methods', time: '1 day ago' },
    { id: 3, action: 'commented on', item: 'Database Optimization Tips', time: '2 days ago' },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'guide': return <BookOutlined />;
      case 'tutorial': return <FileTextOutlined />;
      case 'article': return <FileTextOutlined />;
      default: return <FileTextOutlined />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'guide': return 'blue';
      case 'tutorial': return 'green';
      case 'article': return 'orange';
      default: return 'default';
    }
  };

  const filteredArticles = knowledgeArticles.filter(article =>
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="knowledge-management">
      <Card 
        title="Knowledge Management"
        extra={
          <Space>
            <Search
              placeholder="Search knowledge base..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 300 }}
              prefix={<SearchOutlined />}
            />
            <Button type="primary" icon={<PlusOutlined />}>
              Add Article
            </Button>
          </Space>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Articles" key="articles">
            <List
              itemLayout="horizontal"
              dataSource={filteredArticles}
              renderItem={(article) => (
                <List.Item
                  actions={[
                    <Button size="small" icon={<EyeOutlined />}>View</Button>,
                    <Button size="small" icon={<StarOutlined />}>Save</Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={getTypeIcon(article.type)}
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{article.title}</span>
                        <Tag color={getTypeColor(article.type)}>{article.type}</Tag>
                      </div>
                    }
                    description={
                      <div>
                        <div style={{ marginBottom: '8px' }}>{article.description}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#666' }}>
                          <span>By {article.author}</span>
                          <span>{article.date}</span>
                          <span><EyeOutlined /> {article.views} views</span>
                          <span><StarOutlined /> {article.likes} likes</span>
                        </div>
                        <div style={{ marginTop: '8px' }}>
                          {article.tags.map((tag, index) => (
                            <Tag key={index} size="small" color="blue">
                              {tag}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </TabPane>
          
          <TabPane tab="Quick Links" key="links">
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }}
              dataSource={quickLinks}
              renderItem={(link) => (
                <List.Item>
                  <Card
                    hoverable
                    style={{ textAlign: 'center' }}
                    onClick={() => window.open(link.url, '_blank')}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '16px' }}>
                      {link.icon}
                    </div>
                    <div style={{ fontWeight: 'bold' }}>{link.title}</div>
                  </Card>
                </List.Item>
              )}
            />
          </TabPane>
          
          <TabPane tab="Recent Activity" key="activity">
            <List
              itemLayout="horizontal"
              dataSource={recentActivities}
              renderItem={(activity) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar size="small" icon={<UserOutlined />} />}
                    title={
                      <span>
                        You {activity.action} <strong>{activity.item}</strong>
                      </span>
                    }
                    description={
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        {activity.time}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default KnowledgeManagement;