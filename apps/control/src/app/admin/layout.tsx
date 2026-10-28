import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminHeader } from '@/components/admin-header';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin · Chai Connect' },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, session } = await requireAdminPage();
  return (
    <div className="bg-ink min-h-dvh">
      <AdminHeader
        name={admin.name}
        role={admin.role}
        expiresAt={session.expiresAt}
        portal="admin"
      />
      <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </div>
  );
}
