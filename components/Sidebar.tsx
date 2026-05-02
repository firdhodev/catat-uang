'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊', section: 'main' },
  { href: '/transactions', label: 'Transaksi', icon: '💳', section: 'main' },
  { href: '/manual', label: 'Input Manual', icon: '✍️', section: 'main' },
  { href: '/pending', label: 'Email Pending', icon: '📬', section: 'main', badge: true },
  { href: '/settings', label: 'Pengaturan', icon: '⚙️', section: 'config' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch('/api/process-emails')
      .then(r => r.json())
      .then(d => setPendingCount(d.count || 0))
      .catch(() => {});
  }, [pathname]);

  // Close sidebar when route changes on mobile
  useEffect(() => { setIsOpen(false); }, [pathname]);

  return (
    <>
      {/* Hamburger toggle for mobile */}
      <button
        className="sidebar-toggle"
        onClick={() => setIsOpen(o => !o)}
        aria-label="Toggle menu"
        id="btn-sidebar-toggle"
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {/* Overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-text">💰 CatatUang</div>
          <div className="sidebar-logo-sub">Smart Money Tracker</div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Menu</div>

          {navItems
            .filter(item => item.section === 'main')
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && pendingCount > 0 && (
                  <span className="sidebar-badge">{pendingCount > 99 ? '99+' : pendingCount}</span>
                )}
              </Link>
            ))}

          <div className="sidebar-section-label">Konfigurasi</div>

          {navItems
            .filter(item => item.section === 'config')
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
        </nav>

        <div className="sidebar-bottom">
          <div style={{ fontSize: '11px', color: '#555', lineHeight: '1.5' }}>
            <strong style={{ color: '#888' }}>Smart Money Tracker</strong>
            <br />v1.0.0 · Single User
          </div>
        </div>
      </aside>
    </>
  );
}
