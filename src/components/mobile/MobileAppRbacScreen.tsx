import { useState } from 'react';
import { Layers, ChevronRight, ArrowLeft, Check, X, ChevronLeft, ChevronRight as RightIcon } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { Badge } from './Badge';
import { EmptyState } from './EmptyState';
import { ExpandableSection } from './ExpandableSection';
import { triggerHapticFeedback } from './BottomTabBar';
import { useDemoMode } from '../../hooks/useDemoMode';
import { maskName, maskEmail } from '../../lib/masking';

interface MobileAppRbacScreenProps {
  profiles: any[];
  applications: any[];
  appRoles: any[];
  userAppRoles: any[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedProfileId: string | null;
  onSelectProfile: (userId: string) => void;
  onAssignAppRole: (userId: string, appRoleId: string) => Promise<void>;
  onRemoveAppRole: (userAppRoleId: string, appRoleId: string, appName: string) => Promise<void>;
  canManage: boolean;
}

export function MobileAppRbacScreen({
  profiles,
  applications,
  appRoles,
  userAppRoles,
  loading,
  totalCount,
  page,
  pageSize,
  onPageChange,
  searchQuery,
  onSearchChange,
  selectedProfileId,
  onSelectProfile,
  onAssignAppRole,
  onRemoveAppRole,
  canManage,
}: MobileAppRbacScreenProps) {
  const { isDemoMode } = useDemoMode();
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Selected profile detail view state
  const [activeUserDetail, setActiveUserDetail] = useState<any | null>(null);
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);

  const selectedProfile = activeUserDetail || profiles.find((p) => p.id === selectedProfileId);

  const handleSelectUser = (p: any) => {
    triggerHapticFeedback(10);
    onSelectProfile(p.id);
    setActiveUserDetail(p);
  };

  const handleBackToList = () => {
    triggerHapticFeedback(5);
    setActiveUserDetail(null);
  };

  const handleRoleChange = async (appId: string, currentAssignment: any, targetRoleId: string) => {
    setUpdatingAppId(appId);
    try {
      if (currentAssignment) {
        // Remove old role first if selecting standard or new role
        const appObj = applications.find((a) => a.id === appId);
        await onRemoveAppRole(currentAssignment.id, currentAssignment.app_role_id, appObj?.name || 'App');
      }

      if (targetRoleId && targetRoleId !== 'no_access') {
        await onAssignAppRole(selectedProfile.id, targetRoleId);
      }
    } finally {
      setUpdatingAppId(null);
    }
  };

  return (
    <div>
      {activeUserDetail ? (
        /* DETAIL VIEW */
        <div className="screen-enter">
          <button
            type="button"
            className="btn-mobile"
            onClick={handleBackToList}
            style={{ marginBottom: '14px', height: '36px', minHeight: '36px', padding: '0 10px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Resident List</span>
          </button>

          <div className="card-mobile" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '16px',
                }}
              >
                {(selectedProfile?.full_name || selectedProfile?.email || 'U').charAt(0).toUpperCase()}
              </div>

              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  {maskName(selectedProfile?.full_name || selectedProfile?.email, isDemoMode)}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  {maskEmail(selectedProfile?.email, isDemoMode)}
                </p>
                <div style={{ marginTop: '4px' }}>
                  <Badge
                    label={selectedProfile?.participant_type === 'non_resident' ? 'NON-RESIDENT' : 'RESIDENT'}
                    variant={selectedProfile?.participant_type === 'non_resident' ? 'non-resident' : 'resident'}
                  />
                </div>
              </div>
            </div>
          </div>

          <ExpandableSection
            title="Application Access Mapping"
            subtitle={`${applications.length} applications registered`}
            defaultExpanded
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '12px' }}>
              {applications.map((app) => {
                const appRoleTemplates = appRoles.filter((r) => r.app_id === app.id);
                const currentAssignment = userAppRoles.find((uar) =>
                  appRoleTemplates.some((art) => art.id === uar.app_role_id)
                );
                const hasAccess = !!currentAssignment;
                const assignedRole = currentAssignment
                  ? appRoleTemplates.find((art) => art.id === currentAssignment.app_role_id)
                  : null;

                const isUpdating = updatingAppId === app.id;

                return (
                  <div
                    key={app.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: hasAccess ? 'var(--success-bg)' : 'var(--border-color)',
                            color: hasAccess ? 'var(--success)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {hasAccess ? <Check size={14} /> : <X size={14} />}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{app.name}</h4>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {app.slug}
                          </span>
                        </div>
                      </div>

                      <select
                        className="search-input-mobile"
                        disabled={!canManage || isUpdating || isDemoMode}
                        title={isDemoMode ? 'Actions are disabled in Demo Mode' : undefined}
                        value={currentAssignment ? currentAssignment.app_role_id : 'no_access'}
                        onChange={(e) => handleRoleChange(app.id, currentAssignment, e.target.value)}
                        style={{
                          width: 'auto',
                          maxWidth: '140px',
                          height: '36px',
                          fontSize: '12px',
                          padding: '0 8px',
                          borderRadius: '8px',
                          borderColor: hasAccess ? 'var(--primary)' : 'var(--border-color)',
                          fontWeight: hasAccess ? 600 : 400,
                        }}
                      >
                        <option value="no_access">No Access</option>
                        {appRoleTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {assignedRole && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '32px' }}>
                        Description: {assignedRole.description || 'Standard role privileges'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ExpandableSection>
        </div>
      ) : (
        /* MASTER LIST VIEW */
        <div>
          <div style={{ marginBottom: '14px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>App Access Governance</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Select an approved resident to manage application-specific roles
            </p>
          </div>

          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search approved residents..."
          />

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="skeleton-mobile"
                  style={{ height: '70px', borderRadius: 'var(--card-radius)' }}
                />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No approved residents"
              description="No approved residents found matching your search term."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {profiles.map((p) => {
                const name = maskName(p.full_name || p.email, isDemoMode);
                const email = maskEmail(p.email, isDemoMode);

                return (
                  <div
                    key={p.id}
                    className="card-mobile"
                    onClick={() => handleSelectUser(p)}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      marginBottom: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'var(--primary-glow)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '14px',
                        }}
                      >
                        {(p.full_name || p.email || 'U').charAt(0).toUpperCase()}
                      </div>

                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                          {name}
                        </h4>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '1px 0 0 0' }}>
                          {email}
                        </p>
                      </div>
                    </div>

                    <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Page {page} of {totalPages} ({totalCount} total)
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-mobile"
                  disabled={page <= 1}
                  onClick={() => {
                    triggerHapticFeedback(8);
                    onPageChange(page - 1);
                  }}
                  style={{ height: '36px', minHeight: '36px', padding: '0 10px' }}
                >
                  <ChevronLeft size={16} />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  className="btn-mobile"
                  disabled={page >= totalPages}
                  onClick={() => {
                    triggerHapticFeedback(8);
                    onPageChange(page + 1);
                  }}
                  style={{ height: '36px', minHeight: '36px', padding: '0 10px' }}
                >
                  <span>Next</span>
                  <RightIcon size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
