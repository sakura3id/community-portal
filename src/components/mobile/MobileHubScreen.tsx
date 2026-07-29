import { useMemo } from 'react';
import { LogOut, CheckCircle2, FileText, LayoutGrid, FolderOpen } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { ProfileCard } from './ProfileCard';
import { AppCard } from './AppCard';
import type { ApplicationItem } from './AppCard';
import { t } from '../../lib/i18n';
import { buildInfo } from '../../generated/build-info';

interface MobileHubScreenProps {
  participantType: string | null;
  residentSubtype: string | null;
  requestedAffiliation: string | null;
  houseNumber: string | null;
  whatsappNumber: string | null;
  onOpenAdmin: () => void;
}

export function MobileHubScreen({
  participantType,
  residentSubtype,
  requestedAffiliation,
  houseNumber,
  whatsappNumber,
  onOpenAdmin,
}: MobileHubScreenProps) {
  const { user, signOut } = useAuth();
  const { isAdmin, isVerifier, isModerator, isGovernanceManager } = usePermissions();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname.endsWith('.localtest.me') ||
      window.location.hostname.endsWith('.lvh.me') ||
      window.location.hostname === 'localhost');

  const currentDomainSuffix = typeof window !== 'undefined' && window.location.hostname.endsWith('.sr3.my.id')
    ? 'sr3.my.id'
    : 'sakura3.id';

  const iplFinderUrl = isLocal
    ? import.meta.env.VITE_IPL_FINDER_URL || 'http://ipl-finder.localtest.me:8080'
    : import.meta.env.VITE_IPL_FINDER_URL || `https://ipl-finder.${currentDomainSuffix}`;

  const rekapViewerUrl = isLocal
    ? import.meta.env.VITE_REKAP_VIEWER_URL || 'http://rekap.localtest.me:3000'
    : import.meta.env.VITE_REKAP_VIEWER_URL || `https://rekap.${currentDomainSuffix}`;

  const communityDocsUrl = isLocal
    ? import.meta.env.VITE_COMMUNITY_DOCS_URL || 'http://docs.localtest.me:3001'
    : import.meta.env.VITE_COMMUNITY_DOCS_URL || `https://docs.${currentDomainSuffix}`;

  const apps: ApplicationItem[] = [
    {
      name: 'IPL Finder',
      slug: 'ipl_finder',
      description: t('landing.apps.ipl_finder.description'),
      icon: FileText,
      status: 'active',
      badgeText: 'Live',
      link: iplFinderUrl,
    },
    {
      name: 'Rekap Viewer',
      slug: 'rekap_viewer',
      description: t('landing.apps.rekap_viewer.description'),
      icon: LayoutGrid,
      status: 'active',
      badgeText: 'Live',
      link: rekapViewerUrl,
    },
    {
      name: 'Community Documents',
      slug: 'community_docs',
      description: t('landing.apps.community_docs.description'),
      icon: FolderOpen,
      status: 'active',
      badgeText: 'Live',
      link: communityDocsUrl,
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'var(--success-bg)',
              color: 'var(--success)',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            <CheckCircle2 size={12} />
            <span>Identity Active</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            {greeting},
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {user?.user_metadata?.full_name || 'Resident'}
          </p>
        </div>

        <button
          type="button"
          className="btn-mobile"
          onClick={signOut}
          aria-label="Sign out"
          style={{ height: '36px', minHeight: '36px', padding: '0 10px', fontSize: '12px' }}
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </header>

      {/* User Profile Card */}
      <ProfileCard
        user={user}
        participantType={participantType}
        residentSubtype={residentSubtype}
        requestedAffiliation={requestedAffiliation}
        houseNumber={houseNumber}
        whatsappNumber={whatsappNumber}
        isAdmin={isAdmin}
        isVerifier={isVerifier}
        isModerator={isModerator}
        isGovernanceManager={isGovernanceManager}
        onOpenAdmin={onOpenAdmin}
      />

      {/* Applications Section */}
      <section style={{ marginTop: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
          Community Applications
        </h2>
        <div className="app-grid-mobile">
          {apps.map((app) => (
            <AppCard key={app.slug} app={app} />
          ))}
        </div>
      </section>

      {/* Build Footer */}
      <footer
        style={{
          marginTop: '32px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-color)',
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div>
          <span>{buildInfo.appName}</span> • <span>v{buildInfo.version}</span>
        </div>
        {buildInfo.gitCommitSha && buildInfo.gitCommitSha !== 'unknown' && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', opacity: 0.8 }}>
            Commit: {buildInfo.gitCommitSha.substring(0, 7)}
          </div>
        )}
      </footer>
    </div>
  );
}
