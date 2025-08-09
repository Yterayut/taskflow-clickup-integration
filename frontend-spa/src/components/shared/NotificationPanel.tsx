import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Button, 
  Dropdown, 
  List, 
  Badge, 
  Empty, 
  Spin, 
  Typography,
  Space,
  Divider,
  Tag
} from 'antd';
import { 
  BellOutlined, 
  CheckOutlined, 
  DeleteOutlined,
  SettingOutlined,
  EyeOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { RootState } from '../../store';
import { markAsRead, markAllAsRead, removeNotification } from '../../store/slices/notificationsSlice';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
}

const NotificationPanel: React.FC = () => {
  const dispatch = useDispatch();
  const [visible, setVisible] = useState(false);
  const { notifications, loading } = useSelector((state: RootState) => state.notifications);

  const handleMarkAsRead = (notificationId: string) => {
    dispatch(markAsRead(notificationId));
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllAsRead());
  };

  const handleDeleteNotification = (notificationId: string) => {
    dispatch(removeNotification(notificationId));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckOutlined style={{ color: '#52c41a' }} />;
      case 'warning':
        return <BellOutlined style={{ color: '#faad14' }} />;
      case 'error':
        return <CloseOutlined style={{ color: '#f5222d' }} />;
      default:
        return <BellOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'blue';
      default:
        return 'default';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const sortedNotifications = [...notifications].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const notificationMenu = (
    <div style={{ 
      width: 400, 
      maxHeight: 500, 
      padding: '16px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <Text strong style={{ fontSize: '16px' }}>Notifications</Text>
        <Space>
          {unreadCount > 0 && (
            <Button 
              type="link" 
              size="small" 
              onClick={handleMarkAllAsRead}
              icon={<CheckOutlined />}
            >
              Mark all read
            </Button>
          )}
          <Button 
            type="link" 
            size="small" 
            icon={<SettingOutlined />}
          >
            Settings
          </Button>
        </Space>
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="small" />
        </div>
      ) : sortedNotifications.length === 0 ? (
        <Empty 
          description="No notifications" 
          style={{ padding: '20px' }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={sortedNotifications.slice(0, 10)}
          renderItem={(notification: Notification) => (
            <List.Item
              style={{
                padding: '12px 0',
                backgroundColor: notification.read ? 'transparent' : '#f6f8fa',
                borderRadius: '4px',
                marginBottom: '4px',
                paddingLeft: '8px',
                paddingRight: '8px'
              }}
              actions={[
                <Button 
                  type="text" 
                  size="small" 
                  icon={<EyeOutlined />}
                  onClick={() => handleMarkAsRead(notification.id)}
                  disabled={notification.read}
                />,
                <Button 
                  type="text" 
                  size="small" 
                  danger 
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteNotification(notification.id)}
                />
              ]}
            >
              <List.Item.Meta
                avatar={getNotificationIcon(notification.type)}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      fontWeight: notification.read ? 'normal' : 'bold',
                      color: notification.read ? '#666' : '#000'
                    }}>
                      {notification.title}
                    </span>
                    <Tag color={getPriorityColor(notification.priority)} size="small">
                      {notification.priority}
                    </Tag>
                  </div>
                }
                description={
                  <div>
                    <div style={{ 
                      color: notification.read ? '#999' : '#666',
                      fontSize: '13px',
                      marginBottom: '4px'
                    }}>
                      {notification.message}
                    </div>
                    <div style={{ 
                      color: '#999', 
                      fontSize: '12px' 
                    }}>
                      {dayjs(notification.createdAt).fromNow()}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      {sortedNotifications.length > 10 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '12px',
          borderTop: '1px solid #f0f0f0'
        }}>
          <Button type="link" size="small">
            View all notifications
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      overlay={notificationMenu}
      trigger={['click']}
      visible={visible}
      onVisibleChange={setVisible}
      placement="bottomRight"
    >
      <Button 
        type="text" 
        icon={
          <Badge count={unreadCount} size="small">
            <BellOutlined style={{ fontSize: '16px' }} />
          </Badge>
        }
      />
    </Dropdown>
  );
};

export default NotificationPanel;