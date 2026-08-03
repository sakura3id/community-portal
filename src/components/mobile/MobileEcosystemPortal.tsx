import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useDemoMode } from '../../hooks/useDemoMode';
import { BottomTabBar } from './BottomTabBar';
import type { MobileTab } from './BottomTabBar';
import { MobileHubScreen } from './MobileHubScreen';
import { MobileApprovalsScreen } from './MobileApprovalsScreen';
import { MobileRolesScreen } from './MobileRolesScreen';
import { MobileAppRbacScreen } from './MobileAppRbacScreen';
import { MobileLogsScreen } from './MobileLogsScreen';
import * as analytics from '../../lib/analytics';

export function MobileEcosystemPortal() {
  const { user } = useAuth();
  const { isAdmin, isVerifier, isGovernanceManager } = usePermissions();
  const { isDemoMode } = useDemoMode();

  // Tab State & URL Sync
  const [activeTab, setActiveTab] = useState<MobileTab>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab') as MobileTab;
      if (tabParam && ['hub', 'approvals', 'roles', 'app-rbac', 'logs'].includes(tabParam)) {
        return tabParam;
      }
      const saved = sessionStorage.getItem('mobile_active_tab') as MobileTab;
      if (saved && ['hub', 'approvals', 'roles', 'app-rbac', 'logs'].includes(saved)) {
        return saved;
      }
    }
    return 'hub';
  });

  const handleTabChange = (tab: MobileTab) => {
    setActiveTab(tab);
    sessionStorage.setItem('mobile_active_tab', tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
    analytics.track('page_viewed', { page: `community_portal_${tab}` });
  };

  // Profile data for Hub
  const [houseNumber, setHouseNumber] = useState<string | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [participantType, setParticipantType] = useState<string | null>(null);
  const [residentSubtype, setResidentSubtype] = useState<string | null>(null);
  const [requestedAffiliation, setRequestedAffiliation] = useState<string | null>(null);

  // Data states for admin screens
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination & filter states
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Approvals filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSubtype, setFilterSubtype] = useState<string>('all');

  // Roles states
  const [userRoles, setUserRoles] = useState<any[]>([]);

  // App RBAC states
  const [applications, setApplications] = useState<any[]>([]);
  const [appRoles, setAppRoles] = useState<any[]>([]);
  const [userAppRoles, setUserAppRoles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Audit Logs states
  const [logs, setLogs] = useState<any[]>([]);
  const [actionFilter, setActionFilter] = useState('all');

  // Fetch logged in profile for Hub
  useEffect(() => {
    if (!user?.id) return;
    const fetchProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('house_number, whatsapp_number, participant_type, resident_subtype, requested_affiliation')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          setHouseNumber(data.house_number);
          setWhatsappNumber(data.whatsapp_number);
          setParticipantType(data.participant_type);
          setResidentSubtype(data.resident_subtype);
          setRequestedAffiliation(data.requested_affiliation);
        }
      } catch (err) {
        console.error('Error fetching landing profile:', err);
      }
    };
    fetchProfile();
  }, [user?.id]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Static Data (Apps & App Roles)
  useEffect(() => {
    const fetchStatic = async () => {
      try {
        const { data: appData } = await supabase.from('applications').select('*');
        setApplications(appData || []);

        const { data: roleTemplates } = await supabase.from('app_roles').select('*');
        setAppRoles(roleTemplates || []);
      } catch (err) {
        console.error('Failed static fetch:', err);
      }
    };
    fetchStatic();
  }, []);

  // Governance action audit logger helper
  const logGovernanceAction = async (targetUserId: string, action: string, reason: string, targetEmail: string) => {
    try {
      await supabase.from('governance_events').insert({
        actor_user_id: user?.id,
        target_user_id: targetUserId,
        action,
        reason: reason || null,
        metadata: {
          actor_email: user?.email,
          target_email: targetEmail,
        },
      });
    } catch (err) {
      console.error('Failed logging governance action:', err);
    }
  };

  // Fetch Tab Data
  const fetchData = useCallback(async () => {
    if (activeTab === 'hub') return;
    setLoading(true);

    try {
      if (activeTab === 'approvals') {
        let query = supabase
          .from('profiles')
          .select('*, profile_house_affiliations(*, houses(house_number))', { count: 'exact' })
          .not('participant_type', 'is', null);

        if (filterStatus !== 'all') {
          query = query.eq('approval_status', filterStatus);
        }
        if (filterType !== 'all') {
          query = query.eq('participant_type', filterType);
        }
        if (filterSubtype !== 'all') {
          query = query.eq('resident_subtype', filterSubtype);
        }
        if (debouncedSearchQuery) {
          query = query.or(
            `full_name.ilike.%${debouncedSearchQuery}%,email.ilike.%${debouncedSearchQuery}%,house_number.ilike.%${debouncedSearchQuery}%`
          );
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);

        if (error) throw error;
        setProfiles(data || []);
        setTotalCount(count || 0);
      } else if (activeTab === 'roles') {
        let query = supabase
          .from('profiles')
          .select('*', { count: 'exact' })
          .eq('approval_status', 'approved');

        if (debouncedSearchQuery) {
          query = query.or(
            `full_name.ilike.%${debouncedSearchQuery}%,email.ilike.%${debouncedSearchQuery}%,house_number.ilike.%${debouncedSearchQuery}%`
          );
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);

        if (error) throw error;
        setProfiles(data || []);
        setTotalCount(count || 0);

        if (data && data.length > 0) {
          const userIds = data.map((p) => p.id);
          const { data: rData } = await supabase.from('user_roles').select('*').in('user_id', userIds);
          setUserRoles(rData || []);
        } else {
          setUserRoles([]);
        }
      } else if (activeTab === 'app-rbac') {
        let query = supabase
          .from('profiles')
          .select('*', { count: 'exact' })
          .eq('approval_status', 'approved');

        if (debouncedSearchQuery) {
          query = query.or(
            `full_name.ilike.%${debouncedSearchQuery}%,email.ilike.%${debouncedSearchQuery}%,house_number.ilike.%${debouncedSearchQuery}%`
          );
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);

        if (error) throw error;
        setProfiles(data || []);
        setTotalCount(count || 0);

        if (data && data.length > 0 && !selectedProfileId) {
          setSelectedProfileId(data[0].id);
        }
      } else if (activeTab === 'logs') {
        let query = supabase.from('governance_events').select('*', { count: 'exact' });

        if (actionFilter !== 'all') {
          query = query.ilike('action', `%${actionFilter}%`);
        }

        if (debouncedSearchQuery) {
          query = query.or(
            `action.ilike.%${debouncedSearchQuery}%,reason.ilike.%${debouncedSearchQuery}%,metadata->>actor_email.ilike.%${debouncedSearchQuery}%,metadata->>target_email.ilike.%${debouncedSearchQuery}%`
          );
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);

        if (error) throw error;

        const mappedEvents = (data || []).map((ev) => ({
          ...ev,
          actor_email: ev.metadata?.actor_email || 'System',
          target_email: ev.metadata?.target_email || 'Resident',
        }));
        setLogs(mappedEvents);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Failed fetching data for tab:', activeTab, err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, debouncedSearchQuery, filterStatus, filterType, filterSubtype, actionFilter, selectedProfileId]);

  useEffect(() => {
    let mounted = true;
    const runFetch = async () => {
      if (mounted) {
        await fetchData();
      }
    };
    runFetch();
    return () => {
      mounted = false;
    };
  }, [fetchData]);

  // Sync user app roles when selected user changes
  useEffect(() => {
    if (activeTab === 'app-rbac' && selectedProfileId) {
      const fetchUserAppRoles = async () => {
        try {
          const { data } = await supabase.from('user_app_roles').select('*').eq('user_id', selectedProfileId);
          setUserAppRoles(data || []);
        } catch (err) {
          console.error('Error fetching user app roles:', err);
        }
      };
      fetchUserAppRoles();
    }
  }, [activeTab, selectedProfileId]);

  // Handlers for Approvals
  const handleApproveProfile = async (profile: any) => {
    if (isDemoMode) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: 'approved' })
        .eq('id', profile.id);

      if (error) throw error;

      if (profile.house_number && profile.resident_subtype) {
        const { data: houseData } = await supabase
          .from('houses')
          .select('id')
          .eq('house_number', profile.house_number)
          .maybeSingle();

        if (houseData) {
          const { error: affilError } = await supabase
            .from('profile_house_affiliations')
            .insert({
              profile_id: profile.id,
              house_id: houseData.id,
              affiliation_type: profile.resident_subtype,
              is_primary: true,
            });
          if (affilError) {
            console.error('Failed to create onboarding house affiliation:', affilError);
          }
        }
      }

      await logGovernanceAction(profile.id, 'APPROVAL_GRANTED', 'Approved via mobile portal', profile.email);
      fetchData();
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  const handleSuspendProfile = async (profile: any, reason: string) => {
    if (isDemoMode) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: 'suspended' })
        .eq('id', profile.id);

      if (error) throw error;

      // Revoke all assigned app roles on suspension
      await supabase
        .from('user_app_roles')
        .delete()
        .eq('user_id', profile.id);

      await logGovernanceAction(profile.id, 'PROFILE_SUSPENDED', reason, profile.email);
      fetchData();
    } catch (err) {
      console.error('Suspend failed:', err);
    }
  };

  const handleUpdateProfile = async (profileId: string, updateData: any) => {
    if (isDemoMode) return;
    try {
      // 1. Fetch current profile with affiliations
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, profile_house_affiliations(*, houses(house_number))')
        .eq('id', profileId)
        .maybeSingle();

      if (!profile) throw new Error('Profile not found');

      // 2. Perform the profile update
      const { error } = await supabase.from('profiles').update(updateData).eq('id', profileId);
      if (error) throw error;

      // 3. If approved, sync the primary house affiliation
      if (profile.approval_status === 'approved') {
        const normHouse = updateData.house_number ? updateData.house_number.trim().toUpperCase() : '';
        if (normHouse) {
          const { data: houseData } = await supabase
            .from('houses')
            .select('id')
            .eq('house_number', normHouse)
            .maybeSingle();

          if (houseData) {
            const existingPrimary = profile.profile_house_affiliations?.find((a: any) => a.is_primary);
            const affiliationType = updateData.participant_type === 'resident'
              ? (updateData.resident_subtype || 'owner')
              : 'caretaker';

            if (existingPrimary) {
              await supabase
                .from('profile_house_affiliations')
                .update({
                  house_id: houseData.id,
                  affiliation_type: affiliationType,
                })
                .eq('id', existingPrimary.id);
            } else {
              await supabase
                .from('profile_house_affiliations')
                .insert({
                  profile_id: profileId,
                  house_id: houseData.id,
                  affiliation_type: affiliationType,
                  is_primary: true,
                });
            }
          }
        } else {
          // If house number is cleared, remove the primary affiliation
          const existingPrimary = profile.profile_house_affiliations?.find((a: any) => a.is_primary);
          if (existingPrimary) {
            await supabase
              .from('profile_house_affiliations')
              .delete()
              .eq('id', existingPrimary.id);
          }
        }
      }

      fetchData();
    } catch (err) {
      console.error('Update profile failed:', err);
    }
  };

  // Handlers for House Affiliation Management
  const handleAddAffiliation = async (
    profileId: string,
    houseNumber: string,
    affiliationType: string,
    isPrimary: boolean,
    participantType: string
  ) => {
    if (isDemoMode) return;
    const { data: houseData } = await supabase
      .from('houses')
      .select('id')
      .eq('house_number', houseNumber)
      .maybeSingle();

    if (!houseData) throw new Error('Invalid house number');

    if (isPrimary) {
      await supabase
        .from('profile_house_affiliations')
        .update({ is_primary: false })
        .eq('profile_id', profileId);
    }

    const targetAffType = participantType === 'resident' ? affiliationType : 'caretaker';

    const { error } = await supabase
      .from('profile_house_affiliations')
      .insert({
        profile_id: profileId,
        house_id: houseData.id,
        affiliation_type: targetAffType,
        is_primary: isPrimary,
      });

    if (error) throw error;

    if (isPrimary) {
      await supabase
        .from('profiles')
        .update({ house_number: houseNumber, resident_subtype: targetAffType })
        .eq('id', profileId);
    }

    await logGovernanceAction(profileId, 'AFFILIATION_ADDED', `Added ${targetAffType} affiliation for house ${houseNumber}`, '');
    await fetchData();
  };

  const handleDeleteAffiliation = async (profileId: string, affId: string, isPrimary: boolean, remainingAffs: any[]) => {
    if (isDemoMode) return;
    const { error } = await supabase
      .from('profile_house_affiliations')
      .delete()
      .eq('id', affId);

    if (error) throw error;

    if (isPrimary) {
      const remaining = remainingAffs.filter(a => a.id !== affId);
      if (remaining.length > 0) {
        await supabase
          .from('profile_house_affiliations')
          .update({ is_primary: true })
          .eq('id', remaining[0].id);
        await supabase
          .from('profiles')
          .update({
            house_number: remaining[0].houses?.house_number || null,
            resident_subtype: remaining[0].affiliation_type || null,
          })
          .eq('id', profileId);
      } else {
        await supabase
          .from('profiles')
          .update({ house_number: null, resident_subtype: null })
          .eq('id', profileId);
      }
    }

    await logGovernanceAction(profileId, 'AFFILIATION_REMOVED', 'Removed house affiliation', '');
    await fetchData();
  };

  const handleSetPrimaryAffiliation = async (profileId: string, aff: any) => {
    if (isDemoMode) return;
    await supabase
      .from('profile_house_affiliations')
      .update({ is_primary: false })
      .eq('profile_id', profileId);

    const { error } = await supabase
      .from('profile_house_affiliations')
      .update({ is_primary: true })
      .eq('id', aff.id);

    if (error) throw error;

    await supabase
      .from('profiles')
      .update({
        house_number: aff.houses?.house_number || null,
        resident_subtype: aff.affiliation_type || null,
      })
      .eq('id', profileId);

    await logGovernanceAction(profileId, 'PRIMARY_AFFILIATION_CHANGED', `Set primary to ${aff.houses?.house_number}`, '');
    await fetchData();
  };

  // Handlers for Roles
  const handlePromoteRole = async (userId: string, targetRole: 'resident_verifier' | 'platform_moderator', email: string) => {
    if (isDemoMode) return;
    try {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: targetRole });
      if (error) throw error;
      await logGovernanceAction(userId, 'ROLE_PROMOTED', `Promoted to ${targetRole}`, email);
      fetchData();
    } catch (err) {
      console.error('Promote role failed:', err);
    }
  };

  const handleDemoteRole = async (
    userId: string,
    targetRole: 'resident_verifier' | 'platform_moderator',
    email: string,
    reason: string
  ) => {
    if (isDemoMode) return;
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', targetRole);

      if (error) throw error;
      await logGovernanceAction(userId, 'ROLE_DEMOTED', reason || `Demoted from ${targetRole}`, email);
      fetchData();
    } catch (err) {
      console.error('Demote role failed:', err);
    }
  };

  // Handlers for App RBAC
  const handleAssignAppRole = async (userId: string, appRoleId: string) => {
    if (isDemoMode) return;
    try {
      const { error } = await supabase.from('user_app_roles').insert({
        user_id: userId,
        app_role_id: appRoleId,
      });
      if (error) throw error;
      await logGovernanceAction(userId, 'APP_ROLE_ASSIGNED', 'Assigned app role', 'User');
      if (selectedProfileId) {
        const { data } = await supabase.from('user_app_roles').select('*').eq('user_id', selectedProfileId);
        setUserAppRoles(data || []);
      }
    } catch (err) {
      console.error('Assign app role failed:', err);
    }
  };

  const handleRemoveAppRole = async (userAppRoleId: string, _appRoleId: string, appName: string) => {
    if (isDemoMode) return;
    try {
      const { error } = await supabase.from('user_app_roles').delete().eq('id', userAppRoleId);
      if (error) throw error;
      await logGovernanceAction(selectedProfileId || 'user', 'APP_ROLE_REMOVED', `Revoked role in ${appName}`, 'User');
      if (selectedProfileId) {
        const { data } = await supabase.from('user_app_roles').select('*').eq('user_id', selectedProfileId);
        setUserAppRoles(data || []);
      }
    } catch (err) {
      console.error('Remove app role failed:', err);
    }
  };

  return (
    <div className="mobile-app-shell">
      <div className="mobile-scroll-content">
        <div className="glow-accent glow-ecosystem"></div>

        {activeTab === 'hub' && (
          <MobileHubScreen
            participantType={participantType}
            residentSubtype={residentSubtype}
            requestedAffiliation={requestedAffiliation}
            houseNumber={houseNumber}
            whatsappNumber={whatsappNumber}
            onOpenAdmin={() => handleTabChange('approvals')}
          />
        )}

        {activeTab === 'approvals' && (
          <MobileApprovalsScreen
            profiles={profiles}
            loading={loading}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
            filterSubtype={filterSubtype}
            onFilterSubtypeChange={setFilterSubtype}
            onApproveProfile={handleApproveProfile}
            onSuspendProfile={handleSuspendProfile}
            onUpdateProfile={handleUpdateProfile}
            onAddAffiliation={handleAddAffiliation}
            onDeleteAffiliation={handleDeleteAffiliation}
            onSetPrimaryAffiliation={handleSetPrimaryAffiliation}
            canManage={isAdmin || isVerifier}
          />
        )}

        {activeTab === 'roles' && (
          <MobileRolesScreen
            profiles={profiles}
            userRoles={userRoles}
            loading={loading}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onPromoteRole={handlePromoteRole}
            onDemoteRole={handleDemoteRole}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'app-rbac' && (
          <MobileAppRbacScreen
            profiles={profiles}
            applications={applications}
            appRoles={appRoles}
            userAppRoles={userAppRoles}
            loading={loading}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedProfileId={selectedProfileId}
            onSelectProfile={setSelectedProfileId}
            onAssignAppRole={handleAssignAppRole}
            onRemoveAppRole={handleRemoveAppRole}
            canManage={isGovernanceManager}
          />
        )}

        {activeTab === 'logs' && (
          <MobileLogsScreen
            logs={logs}
            loading={loading}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            actionFilter={actionFilter}
            onActionFilterChange={setActionFilter}
          />
        )}
      </div>

      <BottomTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isGovernanceManager={isGovernanceManager}
      />
    </div>
  );
}
