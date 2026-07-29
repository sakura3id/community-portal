import { useState } from 'react';
import { Shield, KeyRound, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { t } from '../lib/i18n';
import { buildInfo } from '../generated/build-info';

export function LoginScreen() {
  const { signInWithGoogle, signInAsDemo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [showDemoPassword, setShowDemoPassword] = useState(false);
  const [demoPassword, setDemoPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      setError((err as Error).message || t('login.auth_failed'));
      setLoading(false);
    }
  };

  const handleDemoLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!showDemoPassword) {
      setShowDemoPassword(true);
      return;
    }
    if (!demoPassword.trim()) {
      setError("Please enter the demo password");
      return;
    }
    try {
      setDemoLoading(true);
      setError(null);
      await signInAsDemo(demoPassword);
    } catch (err) {
      console.error(err);
      setError((err as Error).message || t('login.auth_failed'));
      setDemoLoading(false);
    }
  };

  return (
    <div className="portal-container">
      {/* Decorative Blur Accents */}
      <div className="glow-accent glow-1"></div>
      <div className="glow-accent glow-2"></div>

      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column' }} className="animate-fade-in">
        <div className="auth-card glassmorphic">
          <div className="brand-section">
          <div className="logo-container">
            <Shield className="brand-icon" />
            <KeyRound className="brand-icon-sub" />
          </div>
          <h1 className="portal-title">Sakura 3</h1>
          <p className="portal-subtitle">{t('login.portal_subtitle')}</p>
        </div>

        <div className="info-divider"></div>

        <div className="content-section animate-slide-up">
          <h2>{t('login.secure_entry')}</h2>
          <p className="description">
            {t('login.description')}
          </p>

          {error && (
            <div className="error-banner">
              <span className="error-message">{error}</span>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || demoLoading}
            className="sso-button"
            type="button"
          >
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>{t('login.continue_with_google')}</span>
                <ArrowRight className="btn-arrow" />
              </>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0', color: 'var(--text-muted)', fontSize: '12px', opacity: 0.8 }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
            <span style={{ padding: '0 12px', fontWeight: 600, letterSpacing: '0.05em' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
          </div>

          {showDemoPassword ? (
            <form onSubmit={handleDemoLogin} className="portal-form" style={{ marginTop: '8px', gap: '12px' }}>
              <div className="form-group">
                <input
                  type="password"
                  placeholder="Enter Demo Password"
                  value={demoPassword}
                  onChange={(e) => setDemoPassword(e.target.value)}
                  disabled={demoLoading}
                  autoFocus
                  style={{ width: '100%' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || demoLoading}
                className="submit-button"
              >
                {demoLoading ? (
                  <span className="spinner"></span>
                ) : (
                  <>
                    <span>Submit Password</span>
                    <ArrowRight className="btn-arrow" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <button
              onClick={() => handleDemoLogin()}
              disabled={loading || demoLoading}
              className="sso-button"
              type="button"
              style={{ borderColor: 'var(--primary-glow)', backgroundColor: 'var(--bg-secondary)' }}
            >
              <KeyRound className="google-icon" style={{ color: 'var(--primary)', width: '18px', height: '18px' }} />
              <span>{t('login.continue_as_demo')}</span>
              <ArrowRight className="btn-arrow" />
            </button>
          )}
        </div>

        {/* <div className="card-footer">
          <p>{t('login.footer_notice')}</p>
        </div> */}
      </div>

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
  </div>
);
}
