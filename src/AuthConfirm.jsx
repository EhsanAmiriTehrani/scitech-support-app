import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState({
    loading: true,
    success: false,
    message: 'Verifying your email...'
  });

  useEffect(() => {
    async function verifyEmail() {
      try {
        const token = searchParams.get('token');
        const type = searchParams.get('type');
        const error = searchParams.get('error');

        // Handle error cases first
        if (error) {
          throw new Error(
            error === 'access_denied' 
              ? 'Email link is invalid or has expired'
              : 'Verification failed'
          );
        }

        if (!token || type !== 'signup') {
          setStatus({
            loading: false,
            success: true,
            message: 'Access granted'
          });
          // Optionally store verification state
          localStorage.setItem('email_verified', 'true');
          return;
        }

        // Verify with Supabase
        const { error: verificationError } = await supabase.auth.verifyOtp({
          type: 'signup',
          token_hash: token
        });

        if (verificationError) throw verificationError;

        setStatus({
          loading: false,
          success: true,
          message: 'Email verified successfully!'
        });

        // Store verification state in localStorage
        localStorage.setItem('email_verified', 'true');

      } catch (error) {
        console.error('Verification error:', error);
        setStatus({
          loading: false,
          success: false,
          message: error.message
        });
      }
    }

    verifyEmail();
  }, [searchParams]);

  const handleContinue = () => {
    navigate('/', {
      state: {
        verificationStatus: status.success ? 'verified' : 'failed',
        message: status.message
      }
    });
  };

  return (
    <div style={styles.container}>
      <div style={{
        ...styles.card,
        borderColor: status.success ? '#4CAF50' : status.loading ? '#2196F3' : '#F44336'
      }}>
        {/* Status Indicator */}
        {status.loading ? (
          <div style={styles.spinner}></div>
        ) : status.success ? (
          <svg style={styles.icon} viewBox="0 0 24 24">
            <path fill="#4CAF50" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        ) : (
          <svg style={styles.icon} viewBox="0 0 24 24">
            <path fill="#F44336" d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
          </svg>
        )}

        <h2 style={styles.title}>{status.message}</h2>
        
        {!status.loading && (
          <button 
            onClick={handleContinue}
            style={{
              ...styles.button,
              backgroundColor: status.success ? '#4CAF50' : '#F44336'
            }}
          >
            Continue to Application
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '40px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
    maxWidth: '500px',
    width: '100%',
    borderLeft: '5px solid'
  },
  spinner: {
    border: '4px solid rgba(0, 0, 0, 0.1)',
    borderLeftColor: '#2196F3',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px'
  },
  icon: {
    width: '48px',
    height: '48px',
    margin: '0 auto 20px'
  },
  title: {
    color: '#333',
    marginBottom: '24px',
    fontSize: '20px'
  },
  button: {
    padding: '12px 24px',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  }
};