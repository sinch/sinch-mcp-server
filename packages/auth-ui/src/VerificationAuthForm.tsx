import React, { useState } from 'react';
import './App.css';
import { AuthFormProps } from './main';

export default function VerificationAuthForm({ sessionId, disabled }: AuthFormProps) {
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    try {
      // Callback to MCP server with all the necessary information
      await fetch('http://localhost:4399/callback/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, appId, appSecret })
      });
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      alert('Couldn\'t send the authentication credentials to the MCP server.');
    }
  };

  if (submitted) {
    return <h2>Authentication successful. You can close this tab.</h2>;
  }

  return (
    <div className="container">
      <div className="form-box">
        <img src="/sinch.jpg" alt="Company Logo" className="logo"/>
        <h2>Authenticate with your Verification App credentials</h2>
        <form onSubmit={handleSubmit}>
          <input
            placeholder="App ID"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            required
          />
          <input
            placeholder="App Secret"
            type="password"
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            required
          />
          <button type="submit" disabled={disabled}>Submit</button>
        </form>
      </div>
    </div>
  );
}
