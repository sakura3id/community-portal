import { useState } from 'react';
import { Shield, ChevronLeft, ChevronRight, UserCheck, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { Badge } from './Badge';
import { ConfirmationDialog } from './ConfirmationDialog';
import { EmptyState } from './EmptyState';
import { triggerHapticFeedback } from './BottomTabBar';
import { useDemoMode } from '../../hooks/useDemoMode';
import { maskName, maskEmail, maskPhone } from '../../lib/masking';

interface MobileRolesScreenProps {
  profiles: any[];
  userRoles: { user_id: string; role: string }[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onPromoteRole: (userId: string, targetRole: 'resident_verifier' | 'platform_moderator' | 'committee', email: string) => Promise<void>;
  onDemoteRole: (userId: string, targetRole: 'resident_verifier' | 'platform_moderator' | 'committee', email: string, reason: string) => Promise<void>;
  isAdmin: boolean;
}

export function MobileRolesScreen({
  profiles,
  userRoles,
  loading,
  totalCount,
  page,
  pageSize,
  onPageChange,
  searchQuery,
  onSearchChange,
  onPromoteRole,
  onDemoteRole,
  isAdmin,
}: MobileRolesScreenProps) {
  const { isDemoMode } = useDemoMode();
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Demotion Context State
  const [demoteTarget, setDemoteTarget] = useState<{
    userId: string;
    role: 'resident_verifier' | 'platform_moderator' | 'committee';
    email: string;
    name: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isUserRole = (userId: string, roleName: string) => {
    return userRoles.some((ur) => ur.user_id === userId && ur.role === roleName);
  };

  const handleConfirmDemote = async (reason: string) => {
    if (!demoteTarget) return;
    setActionLoading(true);
    try {
      await onDemoteRole(demoteTarget.userId, demoteTarget.role, demoteTarget.email, reason);
      setDemoteTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Platform Privileges & Roles</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
          Elevate or demote global platform privileges for approved residents
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
              style={{ height: '150px', borderRadius: 'var(--card-radius)' }}
            />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No residents found"
          description="No approved residents found matching your search term."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {profiles.map((profile) => {
            const name = maskName(profile.full_name || profile.email, isDemoMode);
            const email = maskEmail(profile.email, isDemoMode);
            const phone = profile.whatsapp_number ? maskPhone(profile.whatsapp_number, isDemoMode) : null;

            const isVerifier = isUserRole(profile.id, 'resident_verifier');
            const isModerator = isUserRole(profile.id, 'platform_moderator');
            const isCommittee = isUserRole(profile.id, 'committee');

            return (
              <div key={profile.id} className="card-mobile">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                      {name}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      {email}
                    </p>
                  </div>
                  <Badge
                    label={profile.participant_type === 'non_resident' ? 'NON-RESIDENT' : 'RESIDENT'}
                    variant={profile.participant_type === 'non_resident' ? 'non-resident' : 'resident'}
                  />
                </div>

                {phone && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    WhatsApp: <span style={{ fontFamily: 'var(--font-mono)' }}>📱 {phone}</span>
                  </div>
                )}

                <div
                  style={{
                    background: 'var(--bg-primary)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                    marginBottom: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>Assigned Privileges:</span>
                  {!isVerifier && !isModerator && !isCommittee ? (
                    <Badge label="STANDARD RESIDENT" variant="standard-resident" />
                  ) : (
                    <>
                      {isVerifier && <Badge label="RESIDENT VERIFIER" variant="resident-verifier" />}
                      {isModerator && <Badge label="MODERATOR" variant="secretariat-admin" />}
                      {isCommittee && <Badge label="COMMITTEE" variant="resident" />}
                    </>
                  )}
                </div>

                {isAdmin && (
                  <div className="btn-row-mobile" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {isVerifier ? (
                      <button
                        type="button"
                        className="btn-mobile btn-mobile-danger"
                        disabled={actionLoading || isDemoMode}
                        title={isDemoMode ? 'Actions are disabled in Demo Mode' : undefined}
                        onClick={() => {
                          triggerHapticFeedback(12);
                          setDemoteTarget({
                            userId: profile.id,
                            role: 'resident_verifier',
                            email: profile.email,
                            name,
                          });
                        }}
                      >
                        <ShieldAlert size={14} />
                        <span>Demote Verifier</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-mobile btn-mobile-primary"
                        disabled={actionLoading || isDemoMode}
                        title={isDemoMode ? 'Actions are disabled in Demo Mode' : undefined}
                        onClick={() => {
                          triggerHapticFeedback(12);
                          onPromoteRole(profile.id, 'resident_verifier', profile.email);
                        }}
                      >
                        <ArrowUpRight size={14} />
                        <span>Promote Verifier</span>
                      </button>
                    )}

                    {isModerator ? (
                      <button
                        type="button"
                        className="btn-mobile btn-mobile-danger"
                        disabled={actionLoading || isDemoMode}
                        title={isDemoMode ? 'Actions are disabled in Demo Mode' : undefined}
                        onClick={() => {
                          triggerHapticFeedback(12);
                          setDemoteTarget({
                            userId: profile.id,
                            role: 'platform_moderator',
                            email: profile.email,
                            name,
                          });
                        }}
                      >
                        <ShieldAlert size={14} />
                        <span>Demote Moderator</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-mobile"
                        disabled={actionLoading || isDemoMode}
                        title={isDemoMode ? 'Actions are disabled in Demo Mode' : undefined}
                        onClick={() => {
                          triggerHapticFeedback(12);
                          onPromoteRole(profile.id, 'platform_moderator', profile.email);
                        }}
                      >
                        <UserCheck size={14} />
                        <span>Promote Moderator</span>
                      </button>
                    )}

                    {isCommittee ? (
                      <button
                        type="button"
                        className="btn-mobile btn-mobile-danger"
                        disabled={actionLoading || isDemoMode}
                        title={isDemoMode ? 'Actions are disabled in Demo Mode' : undefined}
                        onClick={() => {
                          triggerHapticFeedback(12);
                          setDemoteTarget({
                            userId: profile.id,
                            role: 'committee',
                            email: profile.email,
                            name,
                          });
                        }}
                      >
                        <ShieldAlert size={14} />
                        <span>Demote Committee</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-mobile btn-mobile-primary"
                        disabled={actionLoading || isDemoMode}
                        title={isDemoMode ? 'Actions are disabled in Demo Mode' : undefined}
                        onClick={() => {
                          triggerHapticFeedback(12);
                          onPromoteRole(profile.id, 'committee', profile.email);
                        }}
                      >
                        <ArrowUpRight size={14} />
                        <span>Promote Committee</span>
                      </button>
                    )}
                  </div>
                )}
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
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Demote Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!demoteTarget}
        onClose={() => setDemoteTarget(null)}
        onConfirm={handleConfirmDemote}
        title={`Demote ${demoteTarget?.role === 'resident_verifier' ? 'Verifier' : demoteTarget?.role === 'platform_moderator' ? 'Moderator' : 'Committee'}`}
        description={`Are you sure you want to demote ${demoteTarget?.name}? They will lose elevated administrative permissions.`}
        confirmText="Demote Role"
        requireReason
        isDanger
        loading={actionLoading}
      />
    </div>
  );
}
