import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/invoices', label: 'Invoices' },
  { to: '/companies', label: 'Companies' },
  { to: '/customer-details', label: 'Customer details' },
  { to: '/product-codes', label: 'Product codes' },
  { to: '/connections', label: 'Connections', role: 'ADMIN' },
  { to: '/users', label: 'Users', role: 'ADMIN' },
];

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const items = NAV_ITEMS.filter((item) => !item.role || item.role === user?.role);

  const effectivelyCollapsed = isCollapsed && !mobileOpen;
  
  return (
    <nav className={`sidebar ${effectivelyCollapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        {!effectivelyCollapsed && <div className="sidebar-mark">NRS SI</div>}
        <button 
          className="sidebar-toggle" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          title="Toggle Sidebar"
        >
          {effectivelyCollapsed ? '»' : '«'}
        </button>
        {mobileOpen && (
          <button 
            className="mobile-sidebar-close" 
            onClick={onMobileClose}
            style={{ display: 'flex', background: 'transparent', border: 'none', color: 'var(--ink)', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ×
          </button>
        )}
      </div>
      <ul className="sidebar-list">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link-active' : ''}`}
              title={item.label}
              style={{ textAlign: effectivelyCollapsed ? 'center' : 'left', padding: effectivelyCollapsed ? 'var(--space-2)' : 'var(--space-2) var(--space-5)' }}
            >
              {effectivelyCollapsed ? item.label.charAt(0) : item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
