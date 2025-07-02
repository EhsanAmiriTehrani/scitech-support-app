import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for password reset hash in URL
    const accessToken = searchParams.get('access_token');
    if (!accessToken) {
      setError('Invalid password reset link');
    }
  }, [searchParams]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (success) {
    return (
      <div>
        <h2>Password Updated Successfully!</h2>
        <p>You will be redirected to the homepage shortly.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Reset Password</h2>
      {error && <p style={{color: 'red'}}>{error}</p>}
      <form onSubmit={handleResetPassword}>
        <div>
          <label>New Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Confirm Password:</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Reset Password</button>
      </form>
    </div>
  );
}