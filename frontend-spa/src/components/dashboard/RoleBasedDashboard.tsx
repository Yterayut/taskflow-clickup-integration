import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import ManagerDashboard from '../manager/ManagerDashboard';
import TeamLeadDashboard from '../teamlead/TeamLeadDashboard';
import EmployeeDashboard from '../employee/EmployeeDashboard';
import { Alert } from 'antd';

const RoleBasedDashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);

  if (!user) {
    return <Alert message="User not found" type="error" />;
  }

  switch (user.role) {
    case 'Master':
    case 'Manager':
      return <ManagerDashboard />;
    case 'Team Lead':
      return <TeamLeadDashboard />;
    case 'Employee':
      return <EmployeeDashboard />;
    default:
      return <Alert message="Unknown user role" type="error" />;
  }
};

export default RoleBasedDashboard;