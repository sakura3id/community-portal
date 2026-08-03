import { useState, useEffect } from 'react';
import { Clock, LogOut, Check, Home, Phone, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { AFFILIATION_OPTIONS, getAffiliationLabel } from '../constants/affiliations';
import { t } from '../lib/i18n';
import * as analytics from '../lib/analytics';

import { useDemoMode } from '../hooks/useDemoMode';
import { maskName, maskPhone } from '../lib/masking';
import { normalizeWhatsAppNumber, validateWhatsAppNumber, parseWhatsAppNumber } from '../lib/phone';
import { COUNTRIES } from '../constants/countries';

const getSubtypeLabel = (value: string): string => {
  const key = `house_relationships.${value}.label`;
  const translated = t(key);
  return translated !== key ? translated : value;
};

export function PendingApprovalScreen() {
  const { user, signOut } = useAuth();
  const { isDemoMode } = useDemoMode();
  const [participantType, setParticipantType] = useState<'resident' | 'non_resident'>('resident');
  const [residentSubtype, setResidentSubtype] = useState<'owner' | 'renter' | 'household_member' | 'caretaker'>('owner');
  const [houseNumber, setHouseNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+62');
  const [phoneBody, setPhoneBody] = useState('');
  const [requestedAffiliation, setRequestedAffiliation] = useState('');
  const [houseOptions, setHouseOptions] = useState<string[]>([]);
  const [houseSearch, setHouseSearch] = useState('');
  const [showHouseDropdown, setShowHouseDropdown] = useState(false);

  const [savedParticipantType, setSavedParticipantType] = useState<string | null>(null);
  const [savedResidentSubtype, setSavedResidentSubtype] = useState<string | null>(null);
  const [savedHouseNumber, setSavedHouseNumber] = useState<string | null>(null);
  const [savedWhatsappNumber, setSavedWhatsappNumber] = useState<string | null>(null);
  const [savedRequestedAffiliation, setSavedRequestedAffiliation] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('house_number, whatsapp_number, participant_type, resident_subtype, requested_affiliation, approval_status')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          // Check if onboarding details have actually been submitted
          const hasSubmitted =
            (data.participant_type === 'resident' && data.house_number) ||
            (data.participant_type === 'non_resident' && data.requested_affiliation);

          if (hasSubmitted) {
            setSavedParticipantType(data.participant_type);
            setSavedResidentSubtype(data.resident_subtype);
            setSavedHouseNumber(data.house_number);
            setSavedRequestedAffiliation(data.requested_affiliation);
            setSavedWhatsappNumber(data.whatsapp_number);
          }

          if (data.participant_type) {
            setParticipantType(data.participant_type as 'resident' | 'non_resident');
          }
          if (data.resident_subtype) {
            setResidentSubtype(data.resident_subtype as 'owner' | 'renter' | 'household_member' | 'caretaker');
          }
          if (data.house_number) {
            setHouseNumber(data.house_number);
            setHouseSearch(data.house_number);
          }
          if (data.whatsapp_number) {
            const parsed = parseWhatsAppNumber(data.whatsapp_number);
            setPhoneCountryCode(parsed.countryCode);
            setPhoneBody(parsed.body);
          }
          if (data.requested_affiliation) {
            setRequestedAffiliation(data.requested_affiliation);
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        showToast(t('waiting_room.toast_fetch_error'), 'error');
      } finally {
        setFetching(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  useEffect(() => {
    const fetchHouses = async () => {
      try {
        const { data, error } = await supabase
          .from('houses')
          .select('house_number')
          .order('house_number', { ascending: true });
        if (error) throw error;
        if (data) {
          setHouseOptions(data.map(h => h.house_number));
        }
      } catch (err) {
        console.error('Error fetching houses:', err);
      }
    };
    fetchHouses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (participantType === 'resident') {
      if (!houseNumber.trim()) {
        showToast(t('waiting_room.validation.house_number_required'), 'error');
        return;
      }
      if (houseNumber.length > 25) {
        showToast(t('waiting_room.validation.house_number_max_length'), 'error');
        return;
      }
      if (!residentSubtype) {
        showToast(t('waiting_room.validation.subtype_required'), 'error');
        return;
      }
    } else {
      if (!requestedAffiliation) {
        showToast(t('waiting_room.validation.affiliation_required'), 'error');
        return;
      }
    }

    const fullNormalized = phoneBody.trim() ? normalizeWhatsAppNumber(phoneCountryCode + phoneBody) : '';

    if (phoneBody.trim()) {
      if (!validateWhatsAppNumber(fullNormalized)) {
        showToast(t('waiting_room.validation.whatsapp_invalid'), 'error');
        return;
      }
      if (fullNormalized.length > 25) {
        showToast(t('waiting_room.validation.whatsapp_max_length'), 'error');
        return;
      }
    }

    setLoading(true);
    const isFirstSubmission = !savedParticipantType;
    const finalAffiliation = requestedAffiliation;

    try {
      // 1. Update profiles table
      const { error } = await supabase
        .from('profiles')
        .update({
          participant_type: participantType,
          resident_subtype: participantType === 'resident'
            ? residentSubtype
            : (houseNumber ? 'caretaker' : null),
          house_number: houseNumber ? houseNumber.trim() : null,
          requested_affiliation: participantType === 'non_resident' ? finalAffiliation : null,
          whatsapp_number: fullNormalized || null,
          approval_status: 'pending', // Explicitly mark status as pending on submission
        })
        .eq('id', user?.id);

      if (error) throw error;

      analytics.track('profile_completed', {
        has_house_number: !!houseNumber,
        has_whatsapp_number: !!fullNormalized
      });

      setSavedParticipantType(participantType);
      setSavedResidentSubtype(participantType === 'resident' ? residentSubtype : null);
      setSavedHouseNumber(houseNumber ? houseNumber.trim() : null);
      setSavedRequestedAffiliation(participantType === 'non_resident' ? finalAffiliation : null);
      setSavedWhatsappNumber(fullNormalized || null);

      // 2. Trigger edge function notification if it's the first submission
      if (isFirstSubmission) {
        // Construct description to send via the houseNumber email field
        let customDesc = '';
        if (participantType === 'resident') {
          customDesc = `Resident ${residentSubtype} (House: ${houseNumber.trim()})`;
        } else {
          customDesc = `Non-Resident (${finalAffiliation})${houseNumber ? ` (Associated House: ${houseNumber.trim()})` : ''}`;
        }

        try {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              type: 'new_user',
              userEmail: user?.email,
              userName: user?.user_metadata?.full_name || user?.user_metadata?.name,
              houseNumber: customDesc,
            },
          });
          console.log('Admin notification sent');
        } catch (notifError) {
          console.error('Failed to send admin notification:', notifError);
        }
      }

      showToast(t('waiting_room.toast_saved_success'), 'success');
    } catch (error) {
      console.error(error);
      showToast((error as Error).message || t('waiting_room.toast_save_error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-container">
      {/* Decorative Blur Accents */}
      <div className="glow-accent glow-success"></div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className={`toast-overlay ${toastMessage.type} animate-slide-up`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      <div className="auth-card glassmorphic">
        <div className="status-header animate-fade-in">
          {savedParticipantType ? (
            <div className="status-badge pending">
              <Clock className="badge-icon spin-subtle" />
              <span>{t('waiting_room.awaiting_verification')}</span>
            </div>
          ) : (
            <div className="status-badge unsubmitted">
              <Clock className="badge-icon" />
              <span>{t('waiting_room.profile_incomplete')}</span>
            </div>
          )}
          <h1 className="portal-title">{t('waiting_room.title')}</h1>
          <p className="portal-subtitle">
            {t('waiting_room.welcome', { name: maskName(user?.user_metadata?.full_name || user?.email || '', isDemoMode) })}
          </p>
        </div>

        <div className="info-divider"></div>

        <div className="content-section animate-slide-up">
          {fetching ? (
            <div className="loading-container">
              <span className="spinner"></span>
              <p>{t('waiting_room.loading')}</p>
            </div>
          ) : savedParticipantType ? (
            /* Submissive Verification Card State */
            <div className="submission-summary">
              <div className="success-badge">
                <Check className="check-icon" />
                <span>{t('waiting_room.submitted_title')}</span>
              </div>
              <p className="summary-desc">
                {t('waiting_room.submitted_desc')}
              </p>

              <div className="saved-details">
                <div className="detail-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <span className="row-label">{t('waiting_room.classification')}:</span>
                  <span className="row-value">
                    {savedParticipantType === 'resident'
                      ? `${t('waiting_room.resident')} (${getSubtypeLabel(savedResidentSubtype || '')})`
                      : t('waiting_room.non_resident')}
                  </span>
                </div>
                {savedParticipantType === 'resident' && savedHouseNumber && (
                  <div className="detail-row">
                    <Home className="row-icon" />
                    <span className="row-label">{t('waiting_room.registered_house')}:</span>
                    <span className="row-value">{savedHouseNumber}</span>
                  </div>
                )}
                {savedParticipantType === 'non_resident' && savedRequestedAffiliation && (
                  <div className="detail-row">
                    <span className="row-label">{t('waiting_room.requested_affiliation')}:</span>
                    <span className="row-value">
                      {getAffiliationLabel(savedRequestedAffiliation)}
                    </span>
                  </div>
                )}
                {savedParticipantType === 'non_resident' && savedHouseNumber && (
                  <div className="detail-row">
                    <Home className="row-icon" />
                    <span className="row-label">{t('waiting_room.associated_house')}:</span>
                    <span className="row-value">
                      {savedHouseNumber}
                    </span>
                  </div>
                )}
                {savedWhatsappNumber && (
                  <div className="detail-row">
                    <Phone className="row-icon" />
                    <span className="row-label">{t('waiting_room.whatsapp_contact')}:</span>
                    <span className="row-value">{maskPhone(savedWhatsappNumber, isDemoMode)}</span>
                  </div>
                )}
              </div>

              <div className="notice-box">
                <ShieldCheck className="notice-icon" />
                <p>{t('waiting_room.activation_notice')}</p>
              </div>
            </div>
          ) : (
            /* Registration Form State */
            <form onSubmit={handleSubmit} className="portal-form">
              <p className="form-intro">
                {t('waiting_room.form_intro')}
              </p>

              {/* Step 1: Participant Classification Segmented Control */}
              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600 }}>{t('waiting_room.role_in_community')} <span className="required-star">*</span></label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className={`segment-btn ${participantType === 'resident' ? 'active' : ''}`}
                    onClick={() => setParticipantType('resident')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: participantType === 'resident' ? 'var(--primary)' : 'var(--border-color)',
                      backgroundColor: participantType === 'resident' ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                      color: participantType === 'resident' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13.5px'
                    }}
                  >
                    {t('waiting_room.resident')}
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${participantType === 'non_resident' ? 'active' : ''}`}
                    onClick={() => setParticipantType('non_resident')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: participantType === 'non_resident' ? 'var(--primary)' : 'var(--border-color)',
                      backgroundColor: participantType === 'non_resident' ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                      color: participantType === 'non_resident' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13.5px'
                    }}
                  >
                    {t('waiting_room.non_resident')}
                  </button>
                </div>
              </div>

              {/* Step 2: Dynamic Form Fields based on Classification */}
              {participantType === 'resident' && (
                <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px' }}>
                  <div className="form-group">
                    <label htmlFor="residentSubtype">
                      <span>{t('waiting_room.relationship_to_house')} <span className="required-star">*</span></span>
                    </label>
                    <select
                      id="residentSubtype"
                      value={residentSubtype}
                      onChange={(e) => setResidentSubtype(e.target.value as 'owner' | 'renter' | 'household_member' | 'caretaker')}
                      required
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        fontFamily: 'var(--font-sans)',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        marginTop: '8px'
                      }}
                    >
                      <option value="owner">{t('house_relationships.owner.label')}</option>
                      <option value="renter">{t('house_relationships.renter.label')}</option>
                      <option value="household_member">{t('house_relationships.household_member.label')}</option>
                      <option value="caretaker">{t('house_relationships.caretaker.label')}</option>
                    </select>

                    {/* Contextual help text */}
                    {residentSubtype && (
                      <div className="notice-box" style={{ marginTop: '8px', borderLeft: '3px solid var(--primary)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                            {t(`house_relationships.${residentSubtype}.description`)}
                          </p>
                          {residentSubtype === 'household_member' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                {t('house_relationships.household_member.examples_title')}
                              </p>
                              <ul style={{ paddingLeft: '16px', listStyleType: 'disc', fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <li>{t('house_relationships.household_member.examples.0')}</li>
                                <li>{t('house_relationships.household_member.examples.1')}</li>
                                <li>{t('house_relationships.household_member.examples.2')}</li>
                                <li>{t('house_relationships.household_member.examples.3')}</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="houseNumber">
                      <Home className="input-label-icon" />
                      <span>{t('waiting_room.house_number')} <span className="required-star">*</span></span>
                    </label>
                    <div className="searchable-select-container">
                      <input
                        type="text"
                        id="houseNumber"
                        placeholder={t('waiting_room.select_house')}
                        value={houseSearch}
                        onChange={(e) => {
                          setHouseSearch(e.target.value);
                          setHouseNumber('');
                          setShowHouseDropdown(true);
                        }}
                        onFocus={() => setShowHouseDropdown(true)}
                        onBlur={() => {
                          setTimeout(() => setShowHouseDropdown(false), 200);
                        }}
                        required
                        disabled={loading}
                        className="search-input"
                        style={{ margin: 0, padding: '12px 16px', fontSize: '14px', borderRadius: '12px' }}
                      />
                      {showHouseDropdown && (
                        <div className="searchable-select-dropdown">
                          {houseOptions.filter(num => num.toLowerCase().startsWith(houseSearch.toLowerCase())).length === 0 ? (
                            <div className="searchable-select-empty">No matching houses</div>
                          ) : (
                            houseOptions
                              .filter(num => num.toLowerCase().startsWith(houseSearch.toLowerCase()))
                              .map(num => (
                                <div
                                  key={num}
                                  className={`searchable-select-item ${houseNumber === num ? 'selected' : ''}`}
                                  onMouseDown={() => {
                                    setHouseNumber(num);
                                    setHouseSearch(num);
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

              {participantType === 'non_resident' && (
                <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px' }}>
                  <div className="form-group">
                    <label htmlFor="requestedAffiliation">
                      <span>{t('waiting_room.requested_affiliation_label')} <span className="required-star">*</span></span>
                    </label>
                    <select
                      id="requestedAffiliation"
                      value={requestedAffiliation}
                      onChange={(e) => setRequestedAffiliation(e.target.value)}
                      disabled={loading}
                      required
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        fontFamily: 'var(--font-sans)',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        marginTop: '8px'
                      }}
                    >
                      <option value="">{t('waiting_room.select_affiliation')}</option>
                      {AFFILIATION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {getAffiliationLabel(opt.value)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="associatedHouse">
                      <Home className="input-label-icon" />
                      <span>{t('waiting_room.associated_house_label')}</span>
                    </label>
                    <div className="searchable-select-container">
                      <input
                        type="text"
                        id="associatedHouse"
                        placeholder={t('waiting_room.no_house_associated')}
                        value={houseSearch}
                        onChange={(e) => {
                          setHouseSearch(e.target.value);
                          setHouseNumber(e.target.value);
                          setShowHouseDropdown(true);
                        }}
                        onFocus={() => setShowHouseDropdown(true)}
                        onBlur={() => {
                          setTimeout(() => setShowHouseDropdown(false), 200);
                        }}
                        disabled={loading}
                        className="search-input"
                        style={{ margin: 0, padding: '12px 16px', fontSize: '14px', borderRadius: '12px' }}
                      />
                      {showHouseDropdown && (
                        <div className="searchable-select-dropdown">
                          {houseOptions.filter(num => num.toLowerCase().startsWith(houseSearch.toLowerCase())).length === 0 ? (
                            <div className="searchable-select-empty">No matching houses</div>
                          ) : (
                            houseOptions
                              .filter(num => num.toLowerCase().startsWith(houseSearch.toLowerCase()))
                              .map(num => (
                                <div
                                  key={num}
                                  className={`searchable-select-item ${houseNumber === num ? 'selected' : ''}`}
                                  onMouseDown={() => {
                                    setHouseNumber(num);
                                    setHouseSearch(num);
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

              {/* Step 3: Common Contact Info */}
              <div className="form-group" style={{ marginTop: '4px' }}>
                <label htmlFor="whatsappNumber">
                  <Phone className="input-label-icon" />
                  <span>{t('waiting_room.whatsapp_number_label')}</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <select
                    value={phoneCountryCode}
                    onChange={(e) => setPhoneCountryCode(e.target.value)}
                    disabled={loading}
                    style={{
                      width: '95px',
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontFamily: 'var(--font-sans)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={`${c.code}-${c.dialCode}`} value={c.dialCode}>
                        {c.flag} {c.dialCode} ({c.name})
                      </option>
                    ))}
                  </select>
                  <input
                    id="whatsappNumber"
                    type="tel"
                    placeholder="8123456789"
                    value={phoneBody}
                    onChange={(e) => setPhoneBody(e.target.value)}
                    maxLength={20}
                    disabled={loading}
                    style={{
                      flex: 1,
                      margin: 0
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isDemoMode}
                className="submit-button"
                style={{ marginTop: '12px' }}
              >
                {loading ? (
                  <span className="spinner"></span>
                ) : (
                  <>
                    <span>{t('waiting_room.submit_details')}</span>
                    <ArrowRight className="btn-arrow" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="card-footer actions">
          <button onClick={signOut} className="signout-button" type="button">
            <LogOut className="signout-icon" />
            <span>{t('waiting_room.sign_out')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
