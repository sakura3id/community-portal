import { useState } from 'react';
import { UserCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { StatCard } from './StatCard';
import type { StatItem } from './StatCard';
import { SearchBar } from './SearchBar';
import { FilterChip } from './FilterChip';
import type { FilterOption } from './FilterChip';
import { UserCard } from './UserCard';
import type { UserProfileItem } from './UserCard';
import { BottomSheet } from './BottomSheet';
import { ConfirmationDialog } from './ConfirmationDialog';
import { EmptyState } from './EmptyState';
import { triggerHapticFeedback } from './BottomTabBar';

interface MobileApprovalsScreenProps {
  profiles: UserProfileItem[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterStatus: string;
  onFilterStatusChange: (status: string) => void;
  filterType: string;
  onFilterTypeChange: (type: string) => void;
  filterSubtype: string;
  onFilterSubtypeChange?: (subtype: string) => void;
  onApproveProfile: (profile: UserProfileItem) => Promise<void>;
  onSuspendProfile: (profile: UserProfileItem, reason: string) => Promise<void>;
  onUpdateProfile: (profileId: string, data: any) => Promise<void>;
  canManage: boolean;
}

export function MobileApprovalsScreen({
  profiles,
  loading,
  totalCount,
  page,
  pageSize,
  onPageChange,
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterType,
  onFilterTypeChange,
  filterSubtype,
  onApproveProfile,
  onSuspendProfile,
  onUpdateProfile,
  canManage,
}: MobileApprovalsScreenProps) {
  // Stat calculations
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const stats: StatItem[] = [
    { id: 'all', label: 'Total Records', value: totalCount, color: 'var(--primary)' },
    { id: 'unsubmitted', label: 'Unsubmitted', value: profiles.filter(p => p.approval_status === 'unsubmitted').length, color: 'var(--text-muted)' },
    { id: 'pending', label: 'Pending Review', value: profiles.filter(p => p.approval_status === 'pending').length, color: 'var(--pending)' },
    { id: 'approved', label: 'Approved Users', value: profiles.filter(p => p.approval_status === 'approved').length, color: 'var(--success)' },
  ];

  const statusFilterOptions: FilterOption[] = [
    { id: 'all', label: 'All Status' },
    { id: 'unsubmitted', label: 'Unsubmitted' },
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'suspended', label: 'Suspended' },
  ];

  const typeFilterOptions: FilterOption[] = [
    { id: 'all', label: 'All Types' },
    { id: 'resident', label: 'Residents' },
    { id: 'non_resident', label: 'Non-Residents' },
  ];

  // Edit Modal State
  const [editingProfile, setEditingProfile] = useState<UserProfileItem | null>(null);
  const [editForm, setEditForm] = useState({
    house_number: '',
    whatsapp_number: '',
    participant_type: 'resident',
    resident_subtype: 'owner',
    requested_affiliation: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Suspend Modal State
  const [suspendingProfile, setSuspendingProfile] = useState<UserProfileItem | null>(null);
  const [suspendLoading, setSuspendLoading] = useState(false);

  // Filter Drawer State
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const handleStartEdit = (p: UserProfileItem) => {
    setEditingProfile(p);
    setEditForm({
      house_number: p.house_number || '',
      whatsapp_number: p.whatsapp_number || '',
      participant_type: p.participant_type || 'resident',
      resident_subtype: p.resident_subtype || 'owner',
      requested_affiliation: p.requested_affiliation || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    setEditLoading(true);
    try {
      await onUpdateProfile(editingProfile.id, editForm);
      setEditingProfile(null);
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmSuspend = async (reason: string) => {
    if (!suspendingProfile) return;
    setSuspendLoading(true);
    try {
      await onSuspendProfile(suspendingProfile, reason);
      setSuspendingProfile(null);
    } finally {
      setSuspendLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Resident Approvals</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
          Verify newly registered users and manage resident status
        </p>
      </div>

      {/* Stat Cards */}
      <StatCard
        stats={stats}
        activeStatId={filterStatus}
        onStatClick={(id) => onFilterStatusChange(id)}
      />

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Search residents, house, email..."
        onFilterClick={() => setIsFilterSheetOpen(true)}
        isFilterActive={filterStatus !== 'all' || filterType !== 'all' || filterSubtype !== 'all'}
      />

      {/* Quick Filter Chips */}
      <FilterChip
        options={statusFilterOptions}
        selectedId={filterStatus}
        onSelect={onFilterStatusChange}
      />

      {/* User Card Stack / Loading / Empty State */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton-mobile"
              style={{ height: '140px', borderRadius: 'var(--card-radius)' }}
            />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No residents found"
          description="All caught up! There are no residents matching your current filters."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {profiles.map((profile) => (
            <UserCard
              key={profile.id}
              profile={profile}
              canManage={canManage}
              onEdit={handleStartEdit}
              onApprove={onApproveProfile}
              onSuspend={(p) => setSuspendingProfile(p)}
            />
          ))}
        </div>
      )}

      {/* Pagination Footer */}
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

      {/* Filter Bottom Sheet Drawer */}
      <BottomSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Filter Residents"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Approval Status
            </label>
            <FilterChip
              options={statusFilterOptions}
              selectedId={filterStatus}
              onSelect={(id) => onFilterStatusChange(id)}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Participant Type
            </label>
            <FilterChip
              options={typeFilterOptions}
              selectedId={filterType}
              onSelect={(id) => onFilterTypeChange(id)}
            />
          </div>

          <button
            type="button"
            className="btn-mobile btn-mobile-primary"
            onClick={() => setIsFilterSheetOpen(false)}
            style={{ marginTop: '8px' }}
          >
            Apply Filters
          </button>
        </div>
      </BottomSheet>

      {/* Edit Resident Details Bottom Sheet */}
      <BottomSheet
        isOpen={!!editingProfile}
        onClose={() => setEditingProfile(null)}
        title="Edit Resident Profile"
      >
        {editingProfile && (
          <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Full Name
              </label>
              <input
                type="text"
                disabled
                className="search-input-mobile"
                value={editingProfile.full_name || editingProfile.email}
                style={{ opacity: 0.7, marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Participant Type
              </label>
              <select
                className="search-input-mobile"
                value={editForm.participant_type}
                onChange={(e) => setEditForm({ ...editForm, participant_type: e.target.value })}
                style={{ marginTop: '4px' }}
              >
                <option value="resident">Resident</option>
                <option value="non_resident">Non-Resident</option>
              </select>
            </div>

            {editForm.participant_type === 'resident' && (
              <>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    House Number
                  </label>
                  <input
                    type="text"
                    className="search-input-mobile"
                    value={editForm.house_number}
                    onChange={(e) => setEditForm({ ...editForm, house_number: e.target.value })}
                    placeholder="e.g. W31"
                    style={{ marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Relationship / Subtype
                  </label>
                  <select
                    className="search-input-mobile"
                    value={editForm.resident_subtype}
                    onChange={(e) => setEditForm({ ...editForm, resident_subtype: e.target.value })}
                    style={{ marginTop: '4px' }}
                  >
                    <option value="owner">Owner</option>
                    <option value="renter">Renter</option>
                    <option value="household_member">Household Member</option>
                    <option value="caretaker">Caretaker</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                WhatsApp Number
              </label>
              <input
                type="text"
                className="search-input-mobile"
                value={editForm.whatsapp_number}
                onChange={(e) => setEditForm({ ...editForm, whatsapp_number: e.target.value })}
                placeholder="e.g. 08123456789"
                style={{ marginTop: '4px' }}
              />
            </div>

            <div className="btn-row-mobile" style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="btn-mobile"
                onClick={() => setEditingProfile(null)}
                disabled={editLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-mobile btn-mobile-primary"
                disabled={editLoading}
              >
                {editLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </BottomSheet>

      {/* Suspend Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!suspendingProfile}
        onClose={() => setSuspendingProfile(null)}
        onConfirm={handleConfirmSuspend}
        title="Suspend Resident Access"
        description={`Are you sure you want to suspend access for ${suspendingProfile?.full_name || suspendingProfile?.email}? They will no longer be able to log in.`}
        confirmText="Suspend Resident"
        requireReason
        isDanger
        loading={suspendLoading}
      />
    </div>
  );
}
