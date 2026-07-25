import { useState, useEffect } from 'react';
import { 
  Users, Shield, Database, Activity, Check, X, ShieldAlert, 
  Info, AlertTriangle, ArrowLeft, Sparkles, Edit, Home
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { AFFILIATION_OPTIONS, getAffiliationLabel } from '../constants/affiliations';
import { useDemoMode } from '../hooks/useDemoMode';
import { maskName, maskEmail, maskPhone } from '../lib/masking';

interface AdminDashboardScreenProps {
  onBack: () => void;
}

interface HouseAffiliation {
  id: string;
  profile_id: string;
  house_id: string;
  affiliation_type: 'owner' | 'renter' | 'household_member' | 'caretaker';
  is_primary: boolean;
  houses?: {
    house_number: string;
  } | null;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  house_number: string;
  whatsapp_number: string;
  approval_status: 'unsubmitted' | 'pending' | 'approved' | 'suspended' | 'rejected';
  participant_type?: 'resident' | 'non_resident';
  resident_subtype?: 'owner' | 'renter' | 'household_member' | 'caretaker' | null;
  requested_affiliation?: string | null;
  profile_house_affiliations?: HouseAffiliation[];
}

interface UserRole {
  user_id: string;
  role: 'admin' | 'resident_verifier' | 'platform_moderator';
}

interface Application {
  id: string;
  slug: string;
  name: string;
  url: string;
}

interface AppRole {
  id: string;
  app_id: string;
  name: string;
  description: string;
}

interface UserAppRole {
  id: string;
  user_id: string;
  app_role_id: string;
}

interface GovernanceEvent {
  id: string;
  actor_user_id: string;
  target_user_id: string;
  action: string;
  reason: string;
  created_at: string;
  actor_email?: string;
  target_email?: string;
  metadata?: any;
}

export function AdminDashboardScreen({ onBack }: AdminDashboardScreenProps) {
  const { user } = useAuth();
  const { isDemoMode } = useDemoMode();
  const { isAdmin, isVerifier, isModerator, loading: permLoading } = usePermissions();
  
  // Tab states: 'approvals', 'roles', 'app_governance', 'audit'
  const [activeTab, setActiveTab] = useState<'approvals' | 'roles' | 'app_governance' | 'audit'>(() => {
    const saved = sessionStorage.getItem('admin_active_tab');
    if (saved === 'approvals' || saved === 'roles' || saved === 'app_governance' || saved === 'audit') {
      return saved;
    }
    return 'approvals';
  });

  const handleTabChange = (tab: 'approvals' | 'roles' | 'app_governance' | 'audit') => {
    setActiveTab(tab);
    sessionStorage.setItem('admin_active_tab', tab);
  };
  
  // Shared States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [houseOptions, setHouseOptions] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [appRoles, setAppRoles] = useState<AppRole[]>([]);
  const [userAppRoles, setUserAppRoles] = useState<UserAppRole[]>([]);
  const [governanceEvents, setGovernanceEvents] = useState<GovernanceEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<GovernanceEvent[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [activeProfileDetails, setActiveProfileDetails] = useState<Profile | null>(null);

  // Approvals tab pagination & filters
  const [approvalsPage, setApprovalsPage] = useState(1);
  const [approvalsPageSize, setApprovalsPageSize] = useState(10);
  const [approvalsTotalCount, setApprovalsTotalCount] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSubtype, setFilterSubtype] = useState<string>('all');
  const [approvalsSearchQuery, setApprovalsSearchQuery] = useState('');
  const [debouncedApprovalsSearchQuery, setDebouncedApprovalsSearchQuery] = useState('');

  // Roles tab pagination & filters
  const [rolesPage, setRolesPage] = useState(1);
  const [rolesPageSize, setRolesPageSize] = useState(10);
  const [rolesTotalCount, setRolesTotalCount] = useState(0);
  const [rolesSearchQuery, setRolesSearchQuery] = useState('');
  const [debouncedRolesSearchQuery, setDebouncedRolesSearchQuery] = useState('');
  const [rolesFilterType, setRolesFilterType] = useState<string>('all');
  const [rolesFilterSubtype, setRolesFilterSubtype] = useState<string>('all');

  // App Governance tab pagination & filters
  const [appGovPage, setAppGovPage] = useState(1);
  const [appGovPageSize, setAppGovPageSize] = useState(10);
  const [appGovTotalCount, setAppGovTotalCount] = useState(0);
  const [appGovSearchQuery, setAppGovSearchQuery] = useState('');
  const [debouncedAppGovSearchQuery, setDebouncedAppGovSearchQuery] = useState('');
  const [appGovFilterType, setAppGovFilterType] = useState<string>('all');
  const [appGovFilterSubtype, setAppGovFilterSubtype] = useState<string>('all');

  // Audit tab pagination & filters
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [debouncedAuditSearchQuery, setDebouncedAuditSearchQuery] = useState('');
  
  // Modal / Context states for Rejection or Suspension Reason
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState<{
    profile: Profile;
    action: 'reject' | 'suspend' | 'remove_role';
    roleKey?: string;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  
  // Selected Profile for App Governance Matrix
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Inline Profile Edit States (Option 2)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    house_number: '',
    whatsapp_number: '',
    participant_type: 'resident' as 'resident' | 'non_resident',
    resident_subtype: 'owner' as 'owner' | 'renter' | 'household_member' | 'caretaker' | '',
    requested_affiliation: ''
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Multi-house affiliation states
  const [manageAffiliationsProfile, setManageAffiliationsProfile] = useState<Profile | null>(null);
  const [newAffiliation, setNewAffiliation] = useState({
    house_number: '',
    affiliation_type: 'household_member' as 'owner' | 'renter' | 'household_member' | 'caretaker',
    is_primary: false
  });
  const [affiliationsError, setAffiliationsError] = useState<string | null>(null);
  const [modalHouseSearch, setModalHouseSearch] = useState('');
  const [showModalHouseDropdown, setShowModalHouseDropdown] = useState(false);
  const [inlineHouseSearch, setInlineHouseSearch] = useState('');
  const [showInlineHouseDropdown, setShowInlineHouseDropdown] = useState(false);

  // Determine if actor has rights to edit/approve profiles (admin or verifier only)
  const canManageProfiles = isAdmin || isVerifier;

  // Filter handlers
  const handleFilterStatusChange = (status: string) => {
    setFilterStatus(status);
    setApprovalsPage(1);
  };

  const handleFilterTypeChange = (type: string) => {
    setFilterType(type);
    setFilterSubtype('all');
    setApprovalsPage(1);
  };

  const handleFilterSubtypeChange = (subtype: string) => {
    setFilterSubtype(subtype);
    setApprovalsPage(1);
  };

  const handleRolesFilterTypeChange = (type: string) => {
    setRolesFilterType(type);
    setRolesFilterSubtype('all');
    setRolesPage(1);
  };

  const handleRolesFilterSubtypeChange = (subtype: string) => {
    setRolesFilterSubtype(subtype);
    setRolesPage(1);
  };

  const handleAppGovFilterTypeChange = (type: string) => {
    setAppGovFilterType(type);
    setAppGovFilterSubtype('all');
    setAppGovPage(1);
  };

  const handleAppGovFilterSubtypeChange = (subtype: string) => {
    setAppGovFilterSubtype(subtype);
    setAppGovPage(1);
  };

  // Debounce effects
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedApprovalsSearchQuery(approvalsSearchQuery);
      setApprovalsPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [approvalsSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRolesSearchQuery(rolesSearchQuery);
      setRolesPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [rolesSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAppGovSearchQuery(appGovSearchQuery);
      setAppGovPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [appGovSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAuditSearchQuery(auditSearchQuery);
      setAuditPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [auditSearchQuery]);

  // Redirect to approvals tab if permissions load and user is not admin but viewing admin-only tabs
  useEffect(() => {
    if (!permLoading) {
      if ((activeTab === 'roles' || activeTab === 'audit') && !isAdmin) {
        handleTabChange('approvals');
      }
    }
  }, [isAdmin, permLoading, activeTab]);

  const fetchStaticData = async () => {
    try {
      const { data: appData } = await supabase.from('applications').select('*');
      setApplications(appData || []);

      const { data: roleTemplates } = await supabase.from('app_roles').select('*');
      setAppRoles(roleTemplates || []);

      const { data: houseData } = await supabase
        .from('houses')
        .select('house_number')
        .order('house_number', { ascending: true });
      setHouseOptions(houseData ? houseData.map(h => h.house_number) : []);
    } catch (err) {
      console.error('Failed to load static admin data:', err);
    }
  };

  const fetchApprovalsTab = async () => {
    try {
      setLoading(true);
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

      if (debouncedApprovalsSearchQuery) {
        query = query.or(`full_name.ilike.%${debouncedApprovalsSearchQuery}%,email.ilike.%${debouncedApprovalsSearchQuery}%,house_number.ilike.%${debouncedApprovalsSearchQuery}%`);
      }

      const from = (approvalsPage - 1) * approvalsPageSize;
      const to = from + approvalsPageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setProfiles((data as unknown as Profile[]) || []);
      setApprovalsTotalCount(count || 0);

      // Fetch audit logs contextually for visible profiles
      if (data && data.length > 0) {
        const userIds = data.map(p => p.id);
        const { data: evData, error: evError } = await supabase
          .from('governance_events')
          .select('*')
          .in('target_user_id', userIds)
          .order('created_at', { ascending: false });

        if (!evError && evData) {
          const mappedEvents = evData.map(ev => ({
            ...ev,
            actor_email: ev.metadata?.actor_email || 'System',
            target_email: ev.metadata?.target_email || 'Resident'
          }));
          setGovernanceEvents(mappedEvents);
        } else {
          setGovernanceEvents([]);
        }
      } else {
        setGovernanceEvents([]);
      }
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRolesTab = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('profiles')
        .select('*, profile_house_affiliations(*, houses(house_number))', { count: 'exact' })
        .eq('approval_status', 'approved');

      if (rolesFilterType !== 'all') {
        query = query.eq('participant_type', rolesFilterType);
      }
      if (rolesFilterSubtype !== 'all') {
        query = query.eq('resident_subtype', rolesFilterSubtype);
      }

      if (debouncedRolesSearchQuery) {
        query = query.or(`full_name.ilike.%${debouncedRolesSearchQuery}%,email.ilike.%${debouncedRolesSearchQuery}%,house_number.ilike.%${debouncedRolesSearchQuery}%`);
      }

      const from = (rolesPage - 1) * rolesPageSize;
      const to = from + rolesPageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setProfiles(data || []);
      setRolesTotalCount(count || 0);

      if (data && data.length > 0) {
        const userIds = data.map(p => p.id);
        const { data: rData, error: rError } = await supabase
          .from('user_roles')
          .select('*')
          .in('user_id', userIds);

        if (!rError && rData) {
          setUserRoles(rData || []);
        } else {
          setUserRoles([]);
        }
      } else {
        setUserRoles([]);
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppGovTab = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('profiles')
        .select('*, profile_house_affiliations(*, houses(house_number))', { count: 'exact' })
        .eq('approval_status', 'approved');

      if (appGovFilterType !== 'all') {
        query = query.eq('participant_type', appGovFilterType);
      }
      if (appGovFilterSubtype !== 'all') {
        query = query.eq('resident_subtype', appGovFilterSubtype);
      }

      if (debouncedAppGovSearchQuery) {
        query = query.or(`full_name.ilike.%${debouncedAppGovSearchQuery}%,email.ilike.%${debouncedAppGovSearchQuery}%,house_number.ilike.%${debouncedAppGovSearchQuery}%`);
      }

      const from = (appGovPage - 1) * appGovPageSize;
      const to = from + appGovPageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setProfiles(data || []);
      setAppGovTotalCount(count || 0);

      // Auto select first user on list if none is selected
      if (data && data.length > 0 && !selectedProfileId) {
        setSelectedProfileId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch app governance users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAppRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_app_roles')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      setUserAppRoles(data || []);
    } catch (err) {
      console.error('Failed to fetch user app roles:', err);
    }
  };

  const fetchAuditTab = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('governance_events')
        .select('*', { count: 'exact' });

      if (debouncedAuditSearchQuery) {
        query = query.or(`action.ilike.%${debouncedAuditSearchQuery}%,reason.ilike.%${debouncedAuditSearchQuery}%,metadata->>actor_email.ilike.%${debouncedAuditSearchQuery}%,metadata->>target_email.ilike.%${debouncedAuditSearchQuery}%`);
      }

      const from = (auditPage - 1) * auditPageSize;
      const to = from + auditPageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const mappedEvents = (data || []).map(ev => ({
        ...ev,
        actor_email: ev.metadata?.actor_email || 'System',
        target_email: ev.metadata?.target_email || 'Resident'
      }));
      setAuditLogs(mappedEvents);
      setAuditTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshActiveTab = async () => {
    if (activeTab === 'approvals') {
      await fetchApprovalsTab();
    } else if (activeTab === 'roles') {
      await fetchRolesTab();
    } else if (activeTab === 'app_governance') {
      await fetchAppGovTab();
      if (selectedProfileId) {
        await fetchUserAppRoles(selectedProfileId);
      }
    } else if (activeTab === 'audit') {
      await fetchAuditTab();
    }
  };

  // Run on mount
  useEffect(() => {
    fetchStaticData();
  }, []);

  // Sync tab loading
  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchApprovalsTab();
    }
  }, [activeTab, approvalsPage, approvalsPageSize, debouncedApprovalsSearchQuery, filterStatus, filterType, filterSubtype]);

  useEffect(() => {
    if (activeTab === 'roles') {
      fetchRolesTab();
    }
  }, [activeTab, rolesPage, rolesPageSize, debouncedRolesSearchQuery, rolesFilterType, rolesFilterSubtype]);

  useEffect(() => {
    if (activeTab === 'app_governance') {
      fetchAppGovTab();
    }
  }, [activeTab, appGovPage, appGovPageSize, debouncedAppGovSearchQuery, appGovFilterType, appGovFilterSubtype]);

  // Sync activeProfileDetails and userAppRoles when selected user changes
  useEffect(() => {
    if (activeTab === 'app_governance' && selectedProfileId) {
      fetchUserAppRoles(selectedProfileId);
      const found = profiles.find(p => p.id === selectedProfileId);
      if (found) {
        setActiveProfileDetails(found);
      } else {
        const fetchActiveProfileDetails = async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', selectedProfileId)
            .single();
          if (!error && data) {
            setActiveProfileDetails(data);
          }
        };
        fetchActiveProfileDetails();
      }
    } else {
      setActiveProfileDetails(null);
    }
  }, [activeTab, selectedProfileId, profiles]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditTab();
    }
  }, [activeTab, auditPage, auditPageSize, debouncedAuditSearchQuery]);

  // Helper to log audit event to governance_events
  const logGovernanceAction = async (
    targetUserId: string, 
    action: string, 
    reason: string, 
    targetEmail: string,
    customMetadata: Record<string, any> = {}
  ) => {
    try {
      await supabase
        .from('governance_events')
        .insert({
          actor_user_id: user?.id,
          target_user_id: targetUserId,
          action,
          reason: reason || null,
          metadata: {
            actor_email: user?.email,
            target_email: targetEmail,
            ...customMetadata
          }
        });
    } catch (err) {
      console.error('Failed to write governance event:', err);
    }
  };

  // Helper normalization and validation functions (Option 2)
  const normalizeHouseNumber = (val: string) => val.trim().replace(/\s+/g, ' ');
  const normalizeWhatsAppNumber = (val: string) => val.replace(/[^\d+]/g, '');

  const validateProfileEdit = (
    partType: 'resident' | 'non_resident',
    houseNum: string,
    whatsappNum: string,
    subType: string,
    affiliation: string
  ): string | null => {
    if (partType === 'resident') {
      if (!houseNum) return 'House number is required for residents.';
      if (houseNum.length > 25) return 'House number must be 25 characters or less.';
      if (!subType) return 'Relationship to house is required.';
    } else {
      if (!affiliation) return 'Affiliation is required for non-residents.';
    }
    
    if (whatsappNum) {
      const digitsOnly = whatsappNum.replace(/\D/g, '');
      if (digitsOnly.length < 9 || digitsOnly.length > 15) {
        return 'WhatsApp number must contain between 9 and 15 digits.';
      }
    }
    return null;
  };

  const getSubtypeLabel = (value: string): string => {
    if (value === 'owner') return 'Owner';
    if (value === 'renter') return 'Renter';
    if (value === 'household_member') return 'Household Member';
    if (value === 'caretaker') return 'Caretaker';
    return value;
  };

  const handleAddAffiliation = async () => {
    if (!newAffiliation.house_number) {
      setAffiliationsError('House number is required');
      return;
    }
    setLoading(true);
    setAffiliationsError(null);
    try {
      const { data: houseData } = await supabase
        .from('houses')
        .select('id')
        .eq('house_number', newAffiliation.house_number)
        .maybeSingle();

      if (!houseData) {
        throw new Error('Invalid house number');
      }

      if (newAffiliation.is_primary) {
        await supabase
          .from('profile_house_affiliations')
          .update({ is_primary: false })
          .eq('profile_id', manageAffiliationsProfile!.id);
      }

      const targetAffType = manageAffiliationsProfile!.participant_type === 'resident'
        ? newAffiliation.affiliation_type
        : 'caretaker';

      const { error } = await supabase
        .from('profile_house_affiliations')
        .insert({
          profile_id: manageAffiliationsProfile!.id,
          house_id: houseData.id,
          affiliation_type: targetAffType,
          is_primary: newAffiliation.is_primary
        });

      if (error) throw error;

      if (newAffiliation.is_primary) {
        await supabase
          .from('profiles')
          .update({
            house_number: newAffiliation.house_number,
            resident_subtype: targetAffType
          })
          .eq('id', manageAffiliationsProfile!.id);
      }

      showToastBanner('Affiliation added successfully', 'success');
      await refreshActiveTab();

      const { data: directProfile } = await supabase
        .from('profiles')
        .select('*, profile_house_affiliations(*, houses(house_number))')
        .eq('id', manageAffiliationsProfile!.id)
        .maybeSingle();
      if (directProfile) {
        setManageAffiliationsProfile(directProfile);
      }
      setNewAffiliation({ house_number: '', affiliation_type: 'household_member', is_primary: false });
      setModalHouseSearch(''); // clear search input on success too
      // Close the modal upon successful addition to satisfy the close-on-add requirement
      setManageAffiliationsProfile(null);
    } catch (err: any) {
      setAffiliationsError(err.message || 'Failed to add affiliation');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAffiliation = async (affId: string, isPrimary: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profile_house_affiliations')
        .delete()
        .eq('id', affId);

      if (error) throw error;

      if (isPrimary && manageAffiliationsProfile) {
        const remaining = manageAffiliationsProfile.profile_house_affiliations?.filter(a => a.id !== affId) || [];
        if (remaining.length > 0) {
          const newPrimaryId = remaining[0].id;
          await supabase
            .from('profile_house_affiliations')
            .update({ is_primary: true })
            .eq('id', newPrimaryId);

          await supabase
            .from('profiles')
            .update({
              house_number: remaining[0].houses?.house_number || null,
              resident_subtype: remaining[0].affiliation_type || null
            })
            .eq('id', manageAffiliationsProfile.id);
        } else {
          await supabase
            .from('profiles')
            .update({
              house_number: null,
              resident_subtype: null
            })
            .eq('id', manageAffiliationsProfile.id);
        }
      }

      showToastBanner('Affiliation removed successfully', 'success');
      await refreshActiveTab();

      const { data: directProfile } = await supabase
        .from('profiles')
        .select('*, profile_house_affiliations(*, houses(house_number))')
        .eq('id', manageAffiliationsProfile!.id)
        .maybeSingle();
      if (directProfile) {
        setManageAffiliationsProfile(directProfile);
      } else {
        setManageAffiliationsProfile(null);
      }
    } catch (err: any) {
      showToastBanner(err.message || 'Failed to remove affiliation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimaryAffiliation = async (aff: HouseAffiliation) => {
    setLoading(true);
    try {
      await supabase
        .from('profile_house_affiliations')
        .update({ is_primary: false })
        .eq('profile_id', manageAffiliationsProfile!.id);

      const { error } = await supabase
        .from('profile_house_affiliations')
        .update({ is_primary: true })
        .eq('id', aff.id);

      if (error) throw error;

      await supabase
        .from('profiles')
        .update({
          house_number: aff.houses?.house_number || null,
          resident_subtype: aff.affiliation_type || null
        })
        .eq('id', manageAffiliationsProfile!.id);

      showToastBanner('Primary affiliation updated successfully', 'success');
      await refreshActiveTab();

      const { data: directProfile } = await supabase
        .from('profiles')
        .select('*, profile_house_affiliations(*, houses(house_number))')
        .eq('id', manageAffiliationsProfile!.id)
        .maybeSingle();
      if (directProfile) {
        setManageAffiliationsProfile(directProfile);
      } else {
        setManageAffiliationsProfile(null);
      }
    } catch (err: any) {
      showToastBanner(err.message || 'Failed to set primary affiliation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (profile: Profile) => {
    setEditingProfileId(profile.id);
    setInlineHouseSearch(profile.house_number || '');
    setEditForm({
      house_number: profile.house_number || '',
      whatsapp_number: profile.whatsapp_number || '',
      participant_type: (profile.participant_type || 'resident') as 'resident' | 'non_resident',
      resident_subtype: (profile.resident_subtype || 'owner') as 'owner' | 'renter' | '',
      requested_affiliation: profile.requested_affiliation || ''
    });
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setEditingProfileId(null);
    setEditError(null);
  };

  const handleSaveProfileEdit = async (profile: Profile) => {
    const normHouse = editForm.house_number ? normalizeHouseNumber(editForm.house_number) : '';
    const normWhatsApp = editForm.whatsapp_number ? normalizeWhatsAppNumber(editForm.whatsapp_number) : '';
    const affiliation = editForm.participant_type === 'non_resident' ? editForm.requested_affiliation.trim() : '';

    const validationError = validateProfileEdit(
      editForm.participant_type,
      normHouse,
      normWhatsApp,
      editForm.resident_subtype,
      affiliation
    );
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setLoading(true);
    setEditError(null);
    try {
      const targetSubtype = editForm.participant_type === 'resident'
        ? editForm.resident_subtype
        : (normHouse ? 'caretaker' : null);

      const { error } = await supabase
        .from('profiles')
        .update({
          participant_type: editForm.participant_type,
          resident_subtype: targetSubtype,
          house_number: normHouse || null,
          requested_affiliation: editForm.participant_type === 'non_resident' ? affiliation : null,
          whatsapp_number: normWhatsApp || null
        })
        .eq('id', profile.id);

      if (error) throw error;

      if (profile.approval_status === 'approved' && normHouse) {
        const { data: houseData } = await supabase
          .from('houses')
          .select('id')
          .eq('house_number', normHouse)
          .maybeSingle();

        if (houseData) {
          const existingPrimary = profile.profile_house_affiliations?.find(a => a.is_primary);
          const affiliationType = editForm.participant_type === 'resident'
            ? (editForm.resident_subtype || 'owner')
            : 'caretaker';

          if (existingPrimary) {
            await supabase
              .from('profile_house_affiliations')
              .update({
                house_id: houseData.id,
                affiliation_type: affiliationType
              })
              .eq('id', existingPrimary.id);
          } else {
            await supabase
              .from('profile_house_affiliations')
              .insert({
                profile_id: profile.id,
                house_id: houseData.id,
                affiliation_type: affiliationType,
                is_primary: true
              });
          }
        }
      } else if (profile.approval_status === 'approved' && !normHouse) {
        const existingPrimary = profile.profile_house_affiliations?.find(a => a.is_primary);
        if (existingPrimary) {
          await supabase
            .from('profile_house_affiliations')
            .delete()
            .eq('id', existingPrimary.id);
        }
      }

      // Log structured metadata showing before and after states
      await logGovernanceAction(
        profile.id,
        'modified_resident_profile',
        'Corrected user profile classification details',
        profile.email,
        {
          before: {
            participant_type: profile.participant_type,
            resident_subtype: profile.resident_subtype,
            house_number: profile.house_number,
            requested_affiliation: profile.requested_affiliation,
            whatsapp_number: profile.whatsapp_number
          },
          after: {
            participant_type: editForm.participant_type,
            resident_subtype: targetSubtype,
            house_number: normHouse || null,
            requested_affiliation: editForm.participant_type === 'non_resident' ? affiliation : null,
            whatsapp_number: normWhatsApp || null
          }
        }
      );

      setEditingProfileId(null);
      await refreshActiveTab();
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || 'Failed to save changes.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract state updates and profile edits from audit logs
  const getProfileAuditDetails = (profileId: string) => {
    const profileEvents = governanceEvents.filter(ev => ev.target_user_id === profileId);
    
    // Latest event that approved, rejected, or suspended
    const stateEvent = profileEvents.find(ev => 
      ev.action === 'approved_resident' || 
      ev.action === 'rejected_resident' || 
      ev.action === 'suspended_resident'
    );
    
    // Latest event that modified house number
    const houseEditEvent = profileEvents.find(ev => 
      ev.action === 'modified_resident_profile' &&
      ev.metadata &&
      (ev.metadata as any).before?.house_number !== (ev.metadata as any).after?.house_number
    );
    
    // Latest event that modified whatsapp number
    const whatsappEditEvent = profileEvents.find(ev => 
      ev.action === 'modified_resident_profile' &&
      ev.metadata &&
      (ev.metadata as any).before?.whatsapp_number !== (ev.metadata as any).after?.whatsapp_number
    );
    
    return { stateEvent, houseEditEvent, whatsappEditEvent };
  };

  // Handle Approve Resident (Global standing)
  const handleApproveResident = async (profile: Profile) => {
    setLoading(true);
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
              is_primary: true
            });
          if (affilError) {
            console.error('Failed to create onboarding house affiliation:', affilError);
          }
        }
      }

      await logGovernanceAction(profile.id, 'approved_resident', 'Verification check passed', profile.email);
      showToastBanner('Resident globally approved successfully', 'success');
      await refreshActiveTab();
    } catch (err: any) {
      showToastBanner(err.message || 'Approval failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Rejection / Suspension Modal
  const triggerReasonModal = (profile: Profile, action: 'reject' | 'suspend') => {
    setModalContext({ profile, action });
    setActionReason('');
    setReasonModalOpen(true);
  };

  // Execute Negative Action (Reject / Suspend) with required reason
  const executeNegativeAction = async () => {
    if (!actionReason.trim()) {
      showToastBanner('A reason is strictly required for this operational action', 'error');
      return;
    }

    if (!modalContext) return;
    const { profile, action } = modalContext;
    setLoading(true);
    setReasonModalOpen(false);

    try {
      const targetStatus = action === 'reject' ? 'rejected' : 'suspended';
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: targetStatus })
        .eq('id', profile.id);

      if (error) throw error;

      // If user is rejected or suspended, we also revoke all their assigned app role templates
      if (targetStatus === 'suspended' || targetStatus === 'rejected') {
        await supabase
          .from('user_app_roles')
          .delete()
          .eq('user_id', profile.id);
      }

      await logGovernanceAction(
        profile.id, 
        `${action}ed_resident`, 
        actionReason.trim(), 
        profile.email
      );

      showToastBanner(`Resident successfully ${action}ed`, 'success');
      await refreshActiveTab();
    } catch (err: any) {
      showToastBanner(err.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
      setModalContext(null);
    }
  };

  // Assign Global Role (admin, verifier, moderator)
  const handleAssignGlobalRole = async (targetUserId: string, role: string, targetEmail: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: targetUserId, role })
        .select();

      if (error) throw error;

      await logGovernanceAction(targetUserId, `assigned_global_role:${role}`, 'Elevated platform privileges', targetEmail);
      showToastBanner(`Elevated privilege to global ${role}`, 'success');
      await refreshActiveTab();
    } catch (err: any) {
      showToastBanner(err.message || 'Role assignment failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Remove Global Role
  const handleRemoveGlobalRole = async (targetUserId: string, role: string, targetEmail: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId)
        .eq('role', role);

      if (error) throw error;

      await logGovernanceAction(targetUserId, `removed_global_role:${role}`, 'Revoked global privilege', targetEmail);
      showToastBanner(`Revoked global role: ${role}`, 'success');
      await refreshActiveTab();
    } catch (err: any) {
      showToastBanner(err.message || 'Role removal failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // App-RBAC Mapping: Change User's Template Role for specific Application
  const handleAppRoleTemplateChange = async (userId: string, appSlug: string, newRoleId: string | 'none', userEmail: string) => {
    setLoading(true);
    try {
      const app = applications.find(a => a.slug === appSlug);
      if (!app) return;

      // 1. Fetch current role template for this user/app if exists
      const targetRoles = appRoles.filter(ar => ar.app_id === app.id);
      const roleIds = targetRoles.map(r => r.id);

      const existingMapping = userAppRoles.find(
        uar => uar.user_id === userId && roleIds.includes(uar.app_role_id)
      );

      // 2. Delete existing mapping if it exists
      if (existingMapping) {
        await supabase
          .from('user_app_roles')
          .delete()
          .eq('id', existingMapping.id);
      }

      // 3. Insert new mapping if they did not select 'none'
      if (newRoleId !== 'none') {
        const { error } = await supabase
          .from('user_app_roles')
          .insert({
            user_id: userId,
            app_role_id: newRoleId,
            granted_by: user?.id
          });

        if (error) throw error;

        const roleObj = appRoles.find(r => r.id === newRoleId);
        await logGovernanceAction(
          userId, 
          `assigned_app_role:${appSlug}.${roleObj?.name}`, 
          `Granted app governance template access`, 
          userEmail
        );
        showToastBanner(`Assigned ${app.name} role: ${roleObj?.name}`, 'success');
      } else {
        await logGovernanceAction(
          userId, 
          `revoked_app_role:${appSlug}`, 
          `Revoked all application capabilities`, 
          userEmail
        );
        showToastBanner(`Revoked all access to ${app.name}`, 'success');
      }

      await refreshActiveTab();
    } catch (err: any) {
      showToastBanner(err.message || 'Template mapping failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toast / Status Alerts
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const showToastBanner = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const renderPagination = (
    currentPage: number,
    pageSize: number,
    totalCount: number,
    onPageChange: (page: number) => void,
    onPageSizeChange: (size: number) => void
  ) => {
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const from = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalCount);

    return (
      <div className="pagination-panel" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
          Showing <strong style={{ color: 'var(--text-primary)' }}>{from}</strong> to{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{to}</strong> of{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong> records
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="search-input"
              style={{ width: '70px', padding: '4px 8px', margin: 0, fontSize: '13px' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => onPageChange(1)}
              className="admin-btn secondary"
              style={{ padding: '6px 12px', margin: 0, minWidth: 'auto' }}
              title="First Page"
            >
              «
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="admin-btn secondary"
              style={{ padding: '6px 12px', margin: 0, minWidth: 'auto' }}
              title="Previous Page"
            >
              ‹
            </button>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              fontSize: '13.5px',
              color: 'var(--text-primary)',
              fontWeight: 600
            }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="admin-btn secondary"
              style={{ padding: '6px 12px', margin: 0, minWidth: 'auto' }}
              title="Next Page"
            >
              ›
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(totalPages)}
              className="admin-btn secondary"
              style={{ padding: '6px 12px', margin: 0, minWidth: 'auto' }}
              title="Last Page"
            >
              »
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCompactPagination = (
    currentPage: number,
    pageSize: number,
    totalCount: number,
    onPageChange: (page: number) => void,
    onPageSizeChange: (size: number) => void
  ) => {
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const from = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalCount);

    return (
      <div style={{
        padding: '12px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {/* Row count summary and dropdown */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Showing <strong>{from}</strong>-<strong>{to}</strong> of <strong>{totalCount}</strong>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="search-input"
              style={{ width: '60px', padding: '2px 4px', margin: 0, fontSize: '12px' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Navigation arrows */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(1)}
            className="admin-btn secondary"
            style={{ padding: '4px 8px', margin: 0, minWidth: 'auto', fontSize: '12px' }}
            title="First Page"
          >
            «
          </button>
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="admin-btn secondary"
            style={{ padding: '4px 8px', margin: 0, minWidth: 'auto', fontSize: '12px' }}
            title="Previous Page"
          >
            ‹
          </button>
          <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 600, padding: '0 8px' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="admin-btn secondary"
            style={{ padding: '4px 8px', margin: 0, minWidth: 'auto', fontSize: '12px' }}
            title="Next Page"
          >
            ›
          </button>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            className="admin-btn secondary"
            style={{ padding: '4px 8px', margin: 0, minWidth: 'auto', fontSize: '12px' }}
            title="Last Page"
          >
            »
          </button>
        </div>
      </div>
    );
  };

  const renderManageAffiliationsModal = () => {
    if (!manageAffiliationsProfile) return null;

    const currentAffils = manageAffiliationsProfile.profile_house_affiliations || [];

    return (
      <div className="modal-overlay animate-fade-in" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div className="glassmorphic" style={{
          width: '500px',
          padding: '24px',
          borderRadius: '16px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Manage House Affiliations</h3>
            <button onClick={() => setManageAffiliationsProfile(null)} className="admin-btn secondary" style={{ padding: '6px 12px', minWidth: 'auto' }}>
              <X style={{ width: '16px' }} />
            </button>
          </div>

          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
            Resident: <strong>{manageAffiliationsProfile.full_name}</strong> ({manageAffiliationsProfile.email})
          </p>

          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {currentAffils.length === 0 ? (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No active house affiliations.</span>
            ) : (
              currentAffils.map(aff => (
                <div key={aff.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>
                      {aff.houses?.house_number}
                      {manageAffiliationsProfile?.participant_type === 'resident' && ` (${getSubtypeLabel(aff.affiliation_type)})`}
                    </span>
                    {aff.is_primary && (
                      <span style={{ color: 'var(--primary)', fontSize: '11px', fontWeight: 600 }}>[Primary]</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!aff.is_primary && (
                      <button 
                        onClick={() => handleSetPrimaryAffiliation(aff)}
                        className="admin-btn secondary" 
                        style={{ fontSize: '12px', padding: '4px 8px', minWidth: 'auto' }}
                        disabled={isDemoMode}
                      >
                        Set Primary
                      </button>
                    )}
                    <button 
                      onClick={() => handleDeleteAffiliation(aff.id, aff.is_primary)}
                      className="admin-btn danger" 
                      style={{ padding: '4px 8px', minWidth: 'auto' }}
                      disabled={isDemoMode}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Add Affiliation</h4>
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>House No.</label>
                  <div className="searchable-select-container">
                    <input
                      type="text"
                      placeholder="-- Select --"
                      value={modalHouseSearch}
                      onChange={(e) => {
                        setModalHouseSearch(e.target.value);
                        setNewAffiliation(prev => ({ ...prev, house_number: '' }));
                        setShowModalHouseDropdown(true);
                      }}
                      onFocus={() => setShowModalHouseDropdown(true)}
                      onBlur={() => {
                        setTimeout(() => setShowModalHouseDropdown(false), 200);
                      }}
                      className="search-input"
                      style={{ width: '100%', padding: '6px 10px', fontSize: '13px', margin: 0 }}
                    />
                    {showModalHouseDropdown && (
                      <div className="searchable-select-dropdown">
                        {houseOptions.filter(num => num.toLowerCase().startsWith(modalHouseSearch.toLowerCase())).length === 0 ? (
                          <div className="searchable-select-empty">No matching houses</div>
                        ) : (
                          houseOptions
                            .filter(num => num.toLowerCase().startsWith(modalHouseSearch.toLowerCase()))
                            .map(num => (
                              <div
                                key={num}
                                className={`searchable-select-item ${newAffiliation.house_number === num ? 'selected' : ''}`}
                                onMouseDown={() => {
                                  setNewAffiliation(prev => ({ ...prev, house_number: num }));
                                  setModalHouseSearch(num);
                                }}
                              >
                                {num}
                              </div>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {manageAffiliationsProfile?.participant_type === 'resident' && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Relationship</label>
                    <select
                      value={newAffiliation.affiliation_type}
                      onChange={(e) => setNewAffiliation(prev => ({ ...prev, affiliation_type: e.target.value as any }))}
                      className="search-input"
                      style={{ width: '100%', padding: '6px 10px', fontSize: '13px', margin: 0 }}
                    >
                      <option value="owner">Owner</option>
                      <option value="renter">Renter</option>
                      <option value="household_member">Household Member</option>
                      <option value="caretaker">Caretaker</option>
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input 
                  type="checkbox" 
                  id="new_aff_primary" 
                  checked={newAffiliation.is_primary} 
                  onChange={(e) => setNewAffiliation(prev => ({ ...prev, is_primary: e.target.checked }))} 
                />
                <label htmlFor="new_aff_primary" style={{ fontSize: '13px', userSelect: 'none' }}>Mark as Primary Affiliation</label>
              </div>
              {affiliationsError && (
                <span style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{affiliationsError}</span>
              )}
              <button 
                onClick={handleAddAffiliation}
                className="admin-btn primary" 
                style={{ marginTop: '8px', width: '100%' }}
                disabled={isDemoMode}
              >
                Add Affiliation
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-dashboard-layout animate-fade-in">
      {/* Glow Backdrop Accent */}
      <div className="glow-accent glow-ecosystem"></div>

      {toastMessage && (
        <div className={`toast-overlay ${toastMessage.type} animate-slide-up`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <header className="admin-header">
        <div>
          <button onClick={onBack} className="admin-btn secondary" style={{ marginBottom: '12px' }}>
            <ArrowLeft className="btn-icon" />
            <span>Return to Hub</span>
          </button>
          <h1>Governance & Identity Center</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Shared Identity Ecosystem Administration Panel</p>
        </div>
        
        <div className="role-tags">
          {isAdmin && <span className="role-tag status-admin" style={{ padding: '6px 12px' }}>Super Admin</span>}
          {isVerifier && <span className="role-tag status-approved" style={{ padding: '6px 12px' }}>Verifier</span>}
          {isModerator && <span className="role-tag status-approved" style={{ padding: '6px 12px', borderColor: 'var(--pending)' }}>Moderator</span>}
        </div>
      </header>

      {/* Navigation Sub-Tabs */}
      <nav className="admin-nav-tabs">
        {(isAdmin || isVerifier) && (
          <button 
            onClick={() => handleTabChange('approvals')}
            className={`admin-tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
          >
            <Users style={{ width: '16px' }} />
            <span>Resident Approvals</span>
          </button>
        )}
        
        {isAdmin && (
          <button 
            onClick={() => handleTabChange('roles')}
            className={`admin-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
          >
            <Shield style={{ width: '16px' }} />
            <span>Platform Roles</span>
          </button>
        )}

        {(isAdmin || isVerifier) && (
          <button 
            onClick={() => { handleTabChange('app_governance'); setSelectedProfileId(null); }}
            className={`admin-tab-btn ${activeTab === 'app_governance' ? 'active' : ''}`}
          >
            <Database style={{ width: '16px' }} />
            <span>App Access Governance</span>
          </button>
        )}

        {isAdmin && (
          <button 
            onClick={() => handleTabChange('audit')}
            className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          >
            <Activity style={{ width: '16px' }} />
            <span>Ecosystem Audit Logs</span>
          </button>
        )}
      </nav>

      {/* Tab Panels */}
      <div className="admin-content-card glassmorphic animate-slide-up">
        {activeTab === 'approvals' && (
          <div>
            <div className="admin-section-header">
              <h2>Resident Approvals & Waiting Room</h2>
              <p>Verify newly registered house numbers and grant baseline community standing.</p>
            </div>

            <div className="toolbar-wrapper" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <div className="search-bar-wrapper" style={{ flex: '1', minWidth: '250px', margin: 0 }}>
                <input 
                  type="text"
                  placeholder="Search by name, email, or house number..."
                  className="search-input"
                  value={approvalsSearchQuery}
                  onChange={(e) => setApprovalsSearchQuery(e.target.value)}
                  style={{ margin: 0 }}
                />
              </div>
              
              <div className="filters-group" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div className="filter-select-wrapper">
                  <select
                    value={filterStatus}
                    onChange={(e) => handleFilterStatusChange(e.target.value)}
                    className="search-input"
                    style={{ width: '150px', margin: 0, padding: '10px 14px' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="unsubmitted">Unsubmitted</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="suspended">Suspended</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="filter-select-wrapper">
                  <select
                    value={filterType}
                    onChange={(e) => handleFilterTypeChange(e.target.value)}
                    className="search-input"
                    style={{ width: '150px', margin: 0, padding: '10px 14px' }}
                  >
                    <option value="all">All Types</option>
                    <option value="resident">Resident</option>
                    <option value="non_resident">Non-Resident</option>
                  </select>
                </div>

                {(filterType === 'all' || filterType === 'resident') && (
                  <div className="filter-select-wrapper">
                    <select
                      value={filterSubtype}
                      onChange={(e) => handleFilterSubtypeChange(e.target.value)}
                      className="search-input"
                      style={{ width: '150px', margin: 0, padding: '10px 14px' }}
                    >
                      <option value="all">All Subtypes</option>
                      <option value="owner">Owner</option>
                      <option value="renter">Renter</option>
                      <option value="household_member">Household Member</option>
                      <option value="caretaker">Caretaker</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="loading-container" style={{ padding: '40px 0' }}>
                <span className="spinner"></span>
                <p>Fetching platform data...</p>
              </div>
            ) : profiles.length === 0 ? (
              <div className="empty-state">
                <Users className="empty-icon" />
                <p>No residents match the active search criteria.</p>
              </div>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User Info</th>
                      <th>House / Affiliation</th>
                      <th>WhatsApp Contact</th>
                      <th>Approval Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map(profile => {
                      const { stateEvent, houseEditEvent, whatsappEditEvent } = getProfileAuditDetails(profile.id);
                      return (
                        <tr key={profile.id}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontWeight: 600 }}>{maskName(profile.full_name || 'Anonymous User', isDemoMode)}</span>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{maskEmail(profile.email, isDemoMode)}</span>
                              <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                <span className={`role-tag ${profile.participant_type === 'resident' ? 'status-approved' : 'status-verifier'}`} style={{ fontSize: '9px', padding: '1px 6px' }}>
                                  {profile.participant_type || 'resident'}
                                </span>
                                {profile.participant_type === 'resident' && profile.resident_subtype && (
                                  <span className="role-tag status-admin" style={{ fontSize: '9px', padding: '1px 6px', backgroundColor: 'transparent' }}>
                                    {profile.resident_subtype}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            {editingProfileId === profile.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div>
                                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Type</label>
                                  <select
                                    value={editForm.participant_type}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, participant_type: e.target.value as any }))}
                                    className="search-input"
                                    style={{ padding: '4px 6px', fontSize: '13px', width: '140px', margin: 0 }}
                                  >
                                    <option value="resident">Resident</option>
                                    <option value="non_resident">Non-Resident</option>
                                  </select>
                                </div>
                                {editForm.participant_type === 'resident' ? (
                                  <>
                                    <div>
                                      <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Subtype</label>
                                      <select
                                        value={editForm.resident_subtype}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, resident_subtype: e.target.value as any }))}
                                        className="search-input"
                                        style={{ padding: '4px 6px', fontSize: '13px', width: '140px', margin: 0 }}
                                      >
                                        <option value="owner">Owner</option>
                                        <option value="renter">Renter</option>
                                        <option value="household_member">Household Member</option>
                                        <option value="caretaker">Caretaker</option>
                                      </select>
                                    </div>
                                    <div>
                                       <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>House</label>
                                         <div className="searchable-select-container" style={{ width: '140px' }}>
                                          <input
                                            type="text"
                                            placeholder="-- Select --"
                                            value={inlineHouseSearch}
                                            onChange={(e) => {
                                              setInlineHouseSearch(e.target.value);
                                              setEditForm(prev => ({ ...prev, house_number: '' }));
                                              setShowInlineHouseDropdown(true);
                                            }}
                                            onFocus={() => setShowInlineHouseDropdown(true)}
                                            onBlur={() => {
                                              setTimeout(() => setShowInlineHouseDropdown(false), 200);
                                            }}
                                            className="search-input"
                                            style={{ padding: '4px 6px', fontSize: '13px', width: '100%', margin: 0 }}
                                          />
                                          {showInlineHouseDropdown && (
                                            <div className="searchable-select-dropdown" style={{ minWidth: '140px' }}>
                                              {houseOptions.filter(num => num.toLowerCase().startsWith(inlineHouseSearch.toLowerCase())).length === 0 ? (
                                                <div className="searchable-select-empty">No match</div>
                                              ) : (
                                                houseOptions
                                                  .filter(num => num.toLowerCase().startsWith(inlineHouseSearch.toLowerCase()))
                                                  .map(num => (
                                                    <div
                                                      key={num}
                                                      className={`searchable-select-item ${editForm.house_number === num ? 'selected' : ''}`}
                                                      onMouseDown={() => {
                                                        setEditForm(prev => ({ ...prev, house_number: num }));
                                                        setInlineHouseSearch(num);
                                                      }}
                                                    >
                                                      {num}
                                                    </div>
                                                  ))
                                              )}
                                            </div>
                                          )}
                                        </div>
                                     </div>
                                  </>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>
                                      <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Affiliation</label>
                                      <select
                                        value={editForm.requested_affiliation || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditForm(prev => ({
                                            ...prev,
                                            requested_affiliation: val
                                          }));
                                        }}
                                        className="search-input"
                                        style={{ padding: '4px 6px', fontSize: '13px', width: '140px', margin: 0 }}
                                      >
                                        <option value="">-- Select --</option>
                                        {AFFILIATION_OPTIONS.map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Assoc. House (Opt.)</label>
                                      <div className="searchable-select-container" style={{ width: '140px' }}>
                                        <input
                                          type="text"
                                          placeholder="-- None --"
                                          value={inlineHouseSearch}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setInlineHouseSearch(val);
                                            setEditForm(prev => ({ 
                                              ...prev, 
                                              house_number: val,
                                              resident_subtype: val ? 'caretaker' : ''
                                            }));
                                            setShowInlineHouseDropdown(true);
                                          }}
                                          onFocus={() => setShowInlineHouseDropdown(true)}
                                          onBlur={() => {
                                            setTimeout(() => setShowInlineHouseDropdown(false), 200);
                                          }}
                                          className="search-input"
                                          style={{ padding: '4px 6px', fontSize: '13px', width: '100%', margin: 0 }}
                                        />
                                        {showInlineHouseDropdown && (
                                          <div className="searchable-select-dropdown" style={{ minWidth: '140px' }}>
                                            {houseOptions.filter(num => num.toLowerCase().startsWith(inlineHouseSearch.toLowerCase())).length === 0 ? (
                                              <div className="searchable-select-empty">No match</div>
                                            ) : (
                                              houseOptions
                                                .filter(num => num.toLowerCase().startsWith(inlineHouseSearch.toLowerCase()))
                                                .map(num => (
                                                  <div
                                                    key={num}
                                                    className={`searchable-select-item ${editForm.house_number === num ? 'selected' : ''}`}
                                                    onMouseDown={() => {
                                                      setEditForm(prev => ({ 
                                                        ...prev, 
                                                        house_number: num,
                                                        resident_subtype: 'caretaker'
                                                      }));
                                                      setInlineHouseSearch(num);
                                                    }}
                                                  >
                                                    {num}
                                                  </div>
                                                ))
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {editError && <span style={{ color: 'var(--danger)', fontSize: '11px' }}>{editError}</span>}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {profile.participant_type === 'non_resident' && (
                                  <span style={{ fontWeight: 600, color: 'var(--pending)' }}>
                                    {getAffiliationLabel(profile.requested_affiliation || 'Non-Resident Staff')}
                                  </span>
                                )}
                                {profile.profile_house_affiliations && profile.profile_house_affiliations.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {profile.profile_house_affiliations.map(aff => (
                                      <span key={aff.id} style={{ fontSize: '13px' }}>
                                        {aff.houses?.house_number}
                                        {profile.participant_type === 'resident' && ` (${getSubtypeLabel(aff.affiliation_type)})`}
                                        {aff.is_primary && <span style={{ color: 'var(--primary)', marginLeft: '4px', fontSize: '10px', fontWeight: 600 }}>[Primary]</span>}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  profile.house_number ? (
                                    <span>
                                      {profile.house_number}
                                      {profile.participant_type === 'resident' && ` (${getSubtypeLabel(profile.resident_subtype || '')})`}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
                                  )
                                )}
                                {houseEditEvent && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }} title={`Edited: ${houseEditEvent.reason}`}>
                                    Corrected by {maskEmail(houseEditEvent.actor_email, isDemoMode)}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            {editingProfileId === profile.id ? (
                              <input
                                type="text"
                                className="search-input"
                                style={{ padding: '6px 8px', fontSize: '14px', width: '150px', margin: 0 }}
                                placeholder="e.g. 08123456789"
                                value={editForm.whatsapp_number}
                                onChange={(e) => setEditForm(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                              />
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>{profile.whatsapp_number ? maskPhone(profile.whatsapp_number, isDemoMode) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>}</span>
                                {whatsappEditEvent && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }} title={`Edited: ${whatsappEditEvent.reason}`}>
                                    Corrected by {maskEmail(whatsappEditEvent.actor_email, isDemoMode)}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span className={`pill-badge ${profile.approval_status}`}>
                                {profile.approval_status}
                              </span>
                              {stateEvent && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {profile.approval_status === 'approved' ? 'Approved' : 
                                   profile.approval_status === 'rejected' ? 'Rejected' : 'Suspended'} by {maskEmail(stateEvent.actor_email, isDemoMode)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {canManageProfiles ? (
                              <div className="admin-action-group" style={{ justifyContent: 'flex-end' }}>
                                {editingProfileId === profile.id ? (
                                  <>
                                    <button 
                                      onClick={() => handleSaveProfileEdit(profile)}
                                      className="admin-btn primary"
                                      disabled={loading || isDemoMode}
                                      title={isDemoMode ? "Actions are disabled in Demo Mode" : undefined}
                                    >
                                      <Check style={{ width: '14px' }} />
                                      <span>Save</span>
                                    </button>
                                    <button 
                                      onClick={handleCancelEdit}
                                      className="admin-btn secondary"
                                      disabled={loading}
                                    >
                                      <X style={{ width: '14px' }} />
                                      <span>Cancel</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => handleStartEdit(profile)}
                                      className="admin-btn secondary"
                                      title="Edit resident profile details"
                                      disabled={isDemoMode}
                                    >
                                      <Edit style={{ width: '14px' }} />
                                      <span>Edit</span>
                                    </button>
 
                                    {profile.approval_status === 'approved' && profile.participant_type === 'resident' && (
                                      <button 
                                        onClick={() => { setManageAffiliationsProfile(profile); setModalHouseSearch(''); }}
                                        className="admin-btn secondary"
                                        style={{ borderColor: 'var(--primary)' }}
                                        title="Manage multiple house affiliations"
                                        disabled={isDemoMode}
                                      >
                                        <Home style={{ width: '14px' }} />
                                        <span>Houses</span>
                                      </button>
                                    )}
 
                                    {(profile.approval_status === 'pending' || profile.approval_status === 'unsubmitted') && (
                                      <>
                                        <button 
                                          onClick={() => handleApproveResident(profile)}
                                          className="admin-btn primary"
                                          disabled={isDemoMode}
                                          title={isDemoMode ? "Actions are disabled in Demo Mode" : undefined}
                                        >
                                          <Check style={{ width: '14px' }} />
                                          <span>Approve</span>
                                        </button>
                                        <button 
                                          onClick={() => triggerReasonModal(profile, 'reject')}
                                          className="admin-btn danger"
                                          disabled={isDemoMode}
                                          title={isDemoMode ? "Actions are disabled in Demo Mode" : undefined}
                                        >
                                          <X style={{ width: '14px' }} />
                                          <span>Reject</span>
                                        </button>
                                      </>
                                    )}
 
                                    {profile.approval_status === 'approved' && (
                                      <button 
                                        onClick={() => triggerReasonModal(profile, 'suspend')}
                                        className="admin-btn danger"
                                        disabled={isDemoMode}
                                        title={isDemoMode ? "Actions are disabled in Demo Mode" : undefined}
                                      >
                                        <ShieldAlert style={{ width: '14px' }} />
                                        <span>Suspend</span>
                                      </button>
                                    )}
 
                                    {profile.approval_status === 'suspended' && (
                                      <button 
                                        onClick={() => handleApproveResident(profile)}
                                        className="admin-btn primary"
                                        disabled={isDemoMode}
                                        title={isDemoMode ? "Actions are disabled in Demo Mode" : undefined}
                                      >
                                        <Check style={{ width: '14px' }} />
                                        <span>Re-Approve</span>
                                      </button>
                                    )}
 
                                    {profile.approval_status === 'rejected' && (
                                      <button 
                                        onClick={() => handleApproveResident(profile)}
                                        className="admin-btn primary"
                                        disabled={isDemoMode}
                                        title={isDemoMode ? "Actions are disabled in Demo Mode" : undefined}
                                      >
                                        <Check style={{ width: '14px' }} />
                                        <span>Re-Approve</span>
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  {isDemoMode ? 'Read-only (Demo Mode)' : 'Read-only (Admins/Verifiers only)'}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {renderPagination(approvalsPage, approvalsPageSize, approvalsTotalCount, setApprovalsPage, setApprovalsPageSize)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'roles' && (
          <div>
            <div className="admin-section-header">
              <h2>Global Privileged Roles</h2>
              <p>Elevate verified community members to manage approvals, settings, or platform security.</p>
            </div>

            <div className="toolbar-wrapper" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <div className="search-bar-wrapper" style={{ flex: '1', minWidth: '250px', margin: 0 }}>
                <input 
                  type="text"
                  placeholder="Search by name, email, or house number..."
                  className="search-input"
                  value={rolesSearchQuery}
                  onChange={(e) => setRolesSearchQuery(e.target.value)}
                  style={{ margin: 0 }}
                />
              </div>
              
              <div className="filters-group" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div className="filter-select-wrapper">
                  <select
                    value={rolesFilterType}
                    onChange={(e) => handleRolesFilterTypeChange(e.target.value)}
                    className="search-input"
                    style={{ width: '150px', margin: 0, padding: '10px 14px' }}
                  >
                    <option value="all">All Types</option>
                    <option value="resident">Resident</option>
                    <option value="non_resident">Non-Resident</option>
                  </select>
                </div>

                {(rolesFilterType === 'all' || rolesFilterType === 'resident') && (
                  <div className="filter-select-wrapper">
                    <select
                      value={rolesFilterSubtype}
                      onChange={(e) => handleRolesFilterSubtypeChange(e.target.value)}
                      className="search-input"
                      style={{ width: '150px', margin: 0, padding: '10px 14px' }}
                    >
                      <option value="all">All Subtypes</option>
                      <option value="owner">Owner</option>
                      <option value="renter">Renter</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="loading-container" style={{ padding: '40px 0' }}>
                <span className="spinner"></span>
                <p>Fetching platform data...</p>
              </div>
            ) : profiles.length === 0 ? (
              <div className="empty-state">
                <Shield className="empty-icon" />
                <p>No approved users match the active search criteria.</p>
              </div>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User Info</th>
                      <th>WhatsApp Contact</th>
                      <th>Global Privileges</th>
                      <th style={{ textAlign: 'right' }}>Manage Privilege</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map(profile => {
                      const roles = userRoles.filter(ur => ur.user_id === profile.id).map(r => r.role);
                      
                      return (
                        <tr key={profile.id}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontWeight: 600 }}>{maskName(profile.full_name || 'Anonymous User', isDemoMode)}</span>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{maskEmail(profile.email, isDemoMode)}</span>
                              <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                <span className={`role-tag ${profile.participant_type === 'non_resident' ? 'status-verifier' : 'status-approved'}`} style={{ fontSize: '9px', padding: '1px 6px' }}>
                                  {profile.participant_type === 'non_resident' 
                                    ? getAffiliationLabel(profile.requested_affiliation || 'Non-Resident')
                                    : `Resident (${profile.resident_subtype || 'owner'})`}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>{profile.whatsapp_number ? maskPhone(profile.whatsapp_number, isDemoMode) : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                          <td>
                            <div className="role-tags">
                              {roles.length === 0 ? (
                                <span className="role-tag status-approved" style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)', backgroundColor: 'transparent' }}>
                                  {profile.participant_type === 'non_resident' ? 'Standard Non-Resident' : 'Standard Resident'}
                                </span>
                              ) : (
                                roles.map(r => (
                                  <span key={r} className="role-tag status-admin" style={{ 
                                    backgroundColor: r === 'admin' ? 'var(--primary-glow)' : 'var(--success-bg)',
                                    borderColor: r === 'admin' ? 'var(--primary)' : 'var(--success-border)',
                                    color: r === 'admin' ? 'var(--primary)' : 'var(--success)'
                                  }}>
                                    {r === 'admin' ? 'Super Admin' : r.replace('_', ' ')}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="admin-action-group" style={{ justifyContent: 'flex-end' }}>
                              {/* Toggle Verifier */}
                              {roles.includes('resident_verifier') ? (
                                <button 
                                  onClick={() => handleRemoveGlobalRole(profile.id, 'resident_verifier', profile.email)}
                                  className="admin-btn danger"
                                  disabled={isDemoMode}
                                  title={isDemoMode ? "Actions are disabled in Demo Mode" : undefined}
                                >
                                  <span>Demote Verifier</span>
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleAssignGlobalRole(profile.id, 'resident_verifier', profile.email)}
                                  className="admin-btn secondary"
                                  disabled={isDemoMode}
                                  title={isDemoMode ? "Actions are disabled in Demo Mode" : undefined}
                                >
                                  <span>Promote Verifier</span>
                                </button>
                              )}

                              {/* Toggle Moderator */}
                              {roles.includes('platform_moderator') ? (
                                <button 
                                  onClick={() => handleRemoveGlobalRole(profile.id, 'platform_moderator', profile.email)}
                                  className="admin-btn danger"
                                  disabled={isDemoMode}
                                  title={isDemoMode ? "Actions are disabled in Demo Mode" : undefined}
                                >
                                  <span>Demote Moderator</span>
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleAssignGlobalRole(profile.id, 'platform_moderator', profile.email)}
                                  className="admin-btn secondary"
                                  disabled={isDemoMode}
                                  title={isDemoMode ? "Actions are disabled in Demo Mode" : undefined}
                                >
                                  <span>Promote Moderator</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {renderPagination(rolesPage, rolesPageSize, rolesTotalCount, setRolesPage, setRolesPageSize)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'app_governance' && (
          <div>
            <div className="admin-section-header">
              <h2>App Access Governance (App-RBAC)</h2>
              <p>Map approved community members to application-specific role templates.</p>
            </div>

            <div className="gov-layout">
              {/* Left Column: User Selector */}
              <div className="gov-list-panel">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input 
                    type="text" 
                    placeholder="Search approved residents..." 
                    className="search-input"
                    value={appGovSearchQuery}
                    onChange={(e) => setAppGovSearchQuery(e.target.value)}
                    style={{ margin: 0 }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={appGovFilterType}
                      onChange={(e) => handleAppGovFilterTypeChange(e.target.value)}
                      className="search-input"
                      style={{ flex: 1, margin: 0, padding: '6px 10px', fontSize: '13px' }}
                    >
                      <option value="all">All Types</option>
                      <option value="resident">Resident</option>
                      <option value="non_resident">Non-Resident</option>
                    </select>
                    
                    {(appGovFilterType === 'all' || appGovFilterType === 'resident') && (
                      <select
                        value={appGovFilterSubtype}
                        onChange={(e) => handleAppGovFilterSubtypeChange(e.target.value)}
                        className="search-input"
                        style={{ flex: 1, margin: 0, padding: '6px 10px', fontSize: '13px' }}
                      >
                        <option value="all">All Subtypes</option>
                        <option value="owner">Owner</option>
                        <option value="renter">Renter</option>
                      </select>
                    )}
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {loading ? (
                    <div className="loading-container" style={{ padding: '20px 0' }}>
                      <span className="spinner" style={{ width: '24px', height: '24px' }}></span>
                    </div>
                  ) : profiles.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No approved residents found.
                    </div>
                  ) : (
                    profiles.map(p => (
                      <div 
                        key={p.id}
                        onClick={() => setSelectedProfileId(p.id)}
                        className={`gov-user-item ${selectedProfileId === p.id ? 'active' : ''}`}
                      >
                        <span style={{ fontWeight: 600, display: 'block', fontSize: '13.5px' }}>{maskName(p.full_name, isDemoMode)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{maskEmail(p.email, isDemoMode)}</span>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Pagination Controls */}
                {renderCompactPagination(appGovPage, appGovPageSize, appGovTotalCount, setAppGovPage, setAppGovPageSize)}
              </div>

              {/* Right Column: App Access Matrix */}
              <div className="gov-detail-panel">
                {selectedProfileId ? (() => {
                  const activeProfile = activeProfileDetails;
                  if (!activeProfile) return null;

                  return (
                    <>
                      {/* Identity Card Profile Details (Separation of concerns) */}
                      <section className="profile-card glassmorphic" style={{ padding: '24px', backgroundColor: 'var(--bg-primary)' }}>
                        <div className="profile-heading">
                          {activeProfile.avatar_url ? (
                            <img className="profile-avatar" src={activeProfile.avatar_url} style={{ width: '48px', height: '48px' }} />
                          ) : (
                            <div className="profile-avatar-fallback" style={{ width: '48px', height: '48px' }}>
                              <Users className="fallback-avatar-icon" style={{ width: '20px', height: '20px' }} />
                            </div>
                          )}
                          <div className="profile-info">
                            <h3 style={{ fontSize: '16px' }}>{maskName(activeProfile.full_name, isDemoMode)}</h3>
                            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{maskEmail(activeProfile.email, isDemoMode)}</p>
                            <span className="pill-badge approved" style={{ marginTop: '6px' }}>
                              🟢 Approved {activeProfile.participant_type === 'non_resident' ? 'Non-Resident' : 'Resident'}
                            </span>
                          </div>
                        </div>
                      </section>

                      {/* App Access Matrix Card */}
                      <section className="matrix-card glassmorphic">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Sparkles className="notice-icon" />
                          <h3 style={{ fontSize: '15px' }}>Application Access Mapping</h3>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '6px' }}>
                          Map this resident's access to application-specific role templates.
                        </p>

                        <div className="matrix-grid">
                          {applications.map(app => {
                            const availableAppRoles = appRoles.filter(ar => ar.app_id === app.id);
                            
                            // Find user's currently assigned role for this app
                            const userAssignedAppRole = userAppRoles.find(uar => 
                              uar.user_id === activeProfile.id && 
                              availableAppRoles.map(ar => ar.id).includes(uar.app_role_id)
                            );
                            
                            const currentRoleId = userAssignedAppRole ? userAssignedAppRole.app_role_id : 'none';

                            return (
                              <div key={app.id} className="matrix-row">
                                <div>
                                  <div className="matrix-row-title">
                                    {userAssignedAppRole ? '✓ ' : '✗ '} {app.name}
                                  </div>
                                  <div className="matrix-row-desc">
                                    Namespace: {app.slug}
                                  </div>
                                </div>
                                <select
                                  value={currentRoleId}
                                  onChange={(e) => handleAppRoleTemplateChange(
                                    activeProfile.id, 
                                    app.slug, 
                                    e.target.value,
                                    activeProfile.email
                                  )}
                                  className="matrix-select"
                                  disabled={isDemoMode}
                                >
                                  <option value="none">No Access</option>
                                  {availableAppRoles.map(role => (
                                    <option key={role.id} value={role.id}>
                                      Role: {role.name.toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </>
                  );
                })() : (
                  <div className="empty-state">
                    <Info className="empty-icon" />
                    <p>Select an approved resident from the list to manage application access.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div>
            <div className="admin-section-header">
              <h2>Ecosystem Governance Logs</h2>
              <p>Searchable and immutable ledger of approvals, rejections, suspensions, and role changes.</p>
            </div>

            <div className="search-bar-wrapper">
              <input 
                type="text"
                placeholder="Search audit trail by actor, action, or context..."
                className="search-input"
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="loading-container" style={{ padding: '40px 0' }}>
                <span className="spinner"></span>
                <p>Fetching platform data...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="empty-state">
                <Activity className="empty-icon" />
                <p>No audit logging records matched your search query.</p>
              </div>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Actor</th>
                      <th>Action Code</th>
                      <th>Target User</th>
                      <th>Reason / Operational Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(ev => (
                      <tr key={ev.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                          {new Date(ev.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontWeight: 500, fontSize: '13px' }}>{maskEmail(ev.actor_email, isDemoMode)}</td>
                        <td>
                          <span className="role-tag status-admin" style={{ fontSize: '10px', textTransform: 'lowercase', fontFamily: 'var(--font-mono)' }}>
                            {ev.action}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px' }}>{maskEmail(ev.target_email, isDemoMode)}</td>
                        <td>
                          {ev.reason ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                              <AlertTriangle style={{ width: '13px', color: 'var(--pending)', flexShrink: 0 }} />
                              <span>{ev.reason}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>System automated action</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {renderPagination(auditPage, auditPageSize, auditTotalCount, setAuditPage, setAuditPageSize)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Required Operational Reason Modal */}
      {reasonModalOpen && modalContext && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-card glassmorphic animate-slide-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--error)' }}>
              <AlertTriangle style={{ width: '22px' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Operational Reason Required</h2>
            </div>
            
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
              You are {modalContext.action === 'reject' ? 'rejecting' : 'suspending'} registration for{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{maskName(modalContext.profile.full_name, isDemoMode)}</strong> ({maskEmail(modalContext.profile.email, isDemoMode)}).
              Provide operational context for this action:
            </p>

            <textarea
              placeholder={`e.g., Suspended due to resident move-out`}
              className="admin-textarea"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              required
            />

            <div className="modal-footer">
              <button 
                onClick={() => setReasonModalOpen(false)}
                className="admin-btn secondary"
              >
                Cancel
              </button>
              <button 
                onClick={executeNegativeAction}
                className="admin-btn danger"
              >
                Confirm {modalContext.action === 'reject' ? 'Rejection' : 'Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}
      {manageAffiliationsProfile && renderManageAffiliationsModal()}
    </div>
  );
}
