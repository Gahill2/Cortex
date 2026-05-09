import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        await register({ email, password, fullName, organizationName });
      } else {
        await login(email, password);
      }
      navigate("/");
    } catch {
      setError("Authentication failed. Check credentials and try again.");
    }
  };

  return (
    <div className="auth-page">
      <h1>{isRegister ? "Create account" : "Sign in"}</h1>
      <form onSubmit={onSubmit}>
        {isRegister && (
          <>
            <label>
              Full name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label>
              Organization
              <input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
            </label>
          </>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">{isRegister ? "Create account" : "Sign in"}</button>
      </form>
      <button className="link-btn" onClick={() => setIsRegister((v) => !v)}>
        {isRegister ? "Already have an account? Sign in" : "No account? Register"}
      </button>
    </div>
  );
};
