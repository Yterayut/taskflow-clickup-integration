import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layout, Menu, Avatar, Dropdown, Badge, Button } from 'antd';
import { 
  DashboardOutlined, 
  TeamOutlined, 
  UserOutlined, 
  SettingOutlined,
  BellOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UnorderedListOutlined as TasksOutlined,
  BarChartOutlined,
  FileTextOutlined,
  CalendarOutlined,
  BookOutlined
} from '@ant-design/icons';
import { RootState } from '../../store';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { logout } from '../../store/slices/authSlice';
import { connectWebSocket } from '../../store/slices/realtimeSlice';
import RoleBasedDashboard from '../dashboard/RoleBasedDashboard';
import NotificationPanel from '../shared/NotificationPanel';
import './DashboardLayout.css';

const { Header, Sider, Content } = Layout;

const DashboardLayout: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { sidebarCollapsed } = useSelector((state: RootState) => state.ui);
  const { notifications } = useSelector((state: RootState) => state.notifications);
  const { connected } = useSelector((state: RootState) => state.realtime);

  useEffect(() => {
    if (user && !connected) {
      dispatch(connectWebSocket());
    }
  }, [dispatch, user, connected]);

  const handleLogout = () => {
    dispatch(logout());
  };

  const getMenuItems = () => {
    const role = user?.role;
    
    if (role === 'Master' || role === 'Manager') {
      return [
        {
          key: 'dashboard',
          icon: <DashboardOutlined />,
          label: 'Dashboard Overview',
        },
        {
          key: 'all-tasks',
          icon: <UnorderedListOutlined as TasksOutlined />,
          label: 'All Tasks',
        },
        {
          key: 'team-overview',
          icon: <TeamOutlined />,
          label: 'Team Overview',
        },
        {
          key: 'analytics',
          icon: <BarChartOutlined />,
          label: 'Analytics',
        },
        {
          key: 'employee-management',
          icon: <UserOutlined />,
          label: 'Employee Management',
        },
        {
          key: 'ranking',
          icon: <BarChartOutlined />,
          label: 'Team Ranking',
        },
        {
          key: 'reports',
          icon: <FileTextOutlined />,
          label: 'Reports',
        },
        {
          key: 'attendance',
          icon: <CalendarOutlined />,
          label: 'Attendance',
        },
        {
          key: 'settings',
          icon: <SettingOutlined />,
          label: 'Settings',
        },
      ];
    } else if (role === 'Team Lead') {
      return [
        {
          key: 'team-dashboard',
          icon: <DashboardOutlined />,
          label: 'My Team Dashboard',
        },
        {
          key: 'team-members',
          icon: <TeamOutlined />,
          label: 'Team Members',
        },
        {
          key: 'team-tasks',
          icon: <UnorderedListOutlined as TasksOutlined />,
          label: 'Team Tasks',
        },
        {
          key: 'team-analytics',
          icon: <BarChartOutlined />,
          label: 'Team Analytics',
        },
        {
          key: 'team-attendance',
          icon: <CalendarOutlined />,
          label: 'Team Attendance',
        },
      ];
    } else {
      return [
        {
          key: 'my-dashboard',
          icon: <DashboardOutlined />,
          label: 'My Dashboard',
        },
        {
          key: 'my-tasks',
          icon: <UnorderedListOutlined as TasksOutlined />,
          label: 'My Tasks',
        },
        {
          key: 'my-profile',
          icon: <UserOutlined />,
          label: 'My Profile',
        },
        {
          key: 'knowledge',
          icon: <BookOutlined />,
          label: 'Knowledge Management',
        },
      ];
    }
  };

  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />}>
        My Profile
      </Menu.Item>
      <Menu.Item key="settings" icon={<SettingOutlined />}>
        Settings
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        Logout
      </Menu.Item>
    </Menu>
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={sidebarCollapsed}
        theme="dark"
      >
        <div className="logo">
          <h3 style={{ color: 'white', margin: '16px', textAlign: 'center' }}>
            {sidebarCollapsed ? 'TF' : 'TaskFlow Pro'}
          </h3>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          items={getMenuItems()}
        />
      </Sider>
      
      <Layout>
        <Header style={{ 
          padding: '0 16px', 
          background: '#fff', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => dispatch(toggleSidebar())}
          />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Badge count={unreadCount} size="small">
              <NotificationPanel />
            </Badge>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: connected ? 'green' : 'red' }}>
                {connected ? '● Online' : '● Offline'}
              </span>
            </div>
            
            <Dropdown overlay={userMenu} trigger={['click']}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span>{user?.name}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        
        <Content style={{ margin: '16px', padding: '24px', background: '#fff' }}>
          <RoleBasedDashboard />
        </Content>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout;