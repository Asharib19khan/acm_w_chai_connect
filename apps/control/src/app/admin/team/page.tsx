import { getSettings, listAdmins, listAudit } from '@chai/db';
import { requireAdminPage } from '@/lib/auth/session';
import { TeamClient } from './team-client';

export const metadata = { title: 'Admins & settings' };

export default async function TeamPage() {
  const { admin } = await requireAdminPage('superadmin');
  const [admins, settings, audit] = await Promise.all([
    listAdmins(),
    getSettings(),
    listAudit({ limit: 120 }),
  ]);
  return <TeamClient me={admin.id} admins={admins} settings={settings} audit={audit} />;
}
