'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/chat', label: 'Chat AI', icon: '💬' },
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/transactions', label: 'Transaksi', icon: '💳' },
  { href: '/manual', label: 'Tambah', icon: '✍️' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" id="bottom-nav">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`bottom-nav-item ${pathname === item.href ? 'active' : ''}`}
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
