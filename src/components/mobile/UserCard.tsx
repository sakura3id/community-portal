import { Home, Edit, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from './Badge';
import { useDemoMode } from '../../hooks/useDemoMode';
import { maskName, maskEmail, maskPhone } from '../../lib/masking';
import { triggerHapticFeedback } from './BottomTabBar';

export interface UserProfileItem {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  house_number?: string;
  whatsapp_number?: string;
  approval_status: 'unsubmitted' | 'pending' | 'approved' | 'suspended' | 'rejected';
  participant_type?: 'resident' | 'non_resident';
  resident_subtype?: 'owner' | 'renter' | 'household_member' | 'caretaker' | null;
  requested_affiliation?: string | null;
  profile_house_affiliations?: any[];
}

interface UserCardProps {
  profile: UserProfileItem;
  onEdit?: (profile: UserProfileItem) => void;
  onManageHouses?: (profile: UserProfileItem) => void;
  onSuspend?: (profile: UserProfileItem) => void;
  onApprove?: (profile: UserProfileItem) => void;
  onSelect?: (profile: UserProfileItem) => void;
  canManage?: boolean;
}

export function UserCard({
  profile,
  onEdit,
  onManageHouses,
  onSuspend,
  onApprove,
  onSelect,
  canManage = true,
}: UserCardProps) {
  const { isDemoMode } = useDemoMode();

  const name = maskName(profile.full_name || profile.email, isDemoMode);
  const email = maskEmail(profile.email, isDemoMode);
  const phone = profile.whatsapp_number ? maskPhone(profile.whatsapp_number, isDemoMode) : null;

  const isPending = profile.approval_status === 'pending';
  const isUnsubmitted = profile.approval_status === 'unsubmitted';
  const isApproved = profile.approval_status === 'approved';

  return (
    <div
      className="card-mobile"
      style={{
        cursor: onSelect ? 'pointer' : 'default',
      }}
      onClick={() => onSelect && onSelect(profile)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--primary-glow)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '15px',
              }}
            >
              {(profile.full_name || profile.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              {name}
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              {email}
            </p>
          </div>
        </div>

        <Badge
          label={profile.approval_status.toUpperCase()}
          variant={
            isApproved
              ? 'approved'
              : isPending
              ? 'pending'
              : isUnsubmitted
              ? 'unsubmitted'
              : 'suspended'
          }
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
        <Badge
          label={
            profile.participant_type === 'non_resident'
              ? 'NON-RESIDENT'
              : `RESIDENT${profile.resident_subtype ? ` (${profile.resident_subtype.toUpperCase()})` : ''}`
          }
          variant={profile.participant_type === 'non_resident' ? 'non-resident' : 'resident'}
        />
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Home size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span>
            {profile.house_number ? (
              <strong>House: {profile.house_number}</strong>
            ) : (
              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No house specified</span>
            )}
          </span>
        </div>

        <div>
          <span>WhatsApp: </span>
          {phone ? (
            <span style={{ fontFamily: 'var(--font-mono)' }}>📱 {phone}</span>
          ) : (
            <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>None</span>
          )}
        </div>
      </div>

      {canManage && (onEdit || onManageHouses || onSuspend || onApprove) && (
        <div className="btn-row-mobile" style={{ marginTop: '12px' }}>
          {(isPending || isUnsubmitted) && onApprove && (
            <button
              type="button"
              className="btn-mobile btn-mobile-primary"
              disabled={isDemoMode}
              title={isDemoMode ? 'Actions are disabled in Demo Mode' : undefined}
              onClick={(e) => {
                e.stopPropagation();
                triggerHapticFeedback(12);
                onApprove(profile);
              }}
            >
              <CheckCircle2 size={14} />
              <span>Approve</span>
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              className="btn-mobile"
              disabled={isDemoMode}
              title={isDemoMode ? 'Actions are disabled in Demo Mode' : undefined}
              onClick={(e) => {
                e.stopPropagation();
                triggerHapticFeedback(8);
                onEdit(profile);
              }}
            >
              <Edit size={14} />
              <span>Edit</span>
            </button>
          )}

          {onManageHouses && (
            <button
              type="button"
              className="btn-mobile"
              disabled={isDemoMode}
              title={isDemoMode ? 'Actions are disabled in Demo Mode' : undefined}
              onClick={(e) => {
                e.stopPropagation();
                triggerHapticFeedback(8);
                onManageHouses(profile);
              }}
            >
              <Home size={14} />
              <span>Houses</span>
            </button>
          )}

          {isApproved && onSuspend && (
            <button
              type="button"
              className="btn-mobile btn-mobile-danger"
              disabled={isDemoMode}
              title={isDemoMode ? 'Actions are disabled in Demo Mode' : undefined}
              onClick={(e) => {
                e.stopPropagation();
                triggerHapticFeedback(15);
                onSuspend(profile);
              }}
            >
              <AlertTriangle size={14} />
              <span>Suspend</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
