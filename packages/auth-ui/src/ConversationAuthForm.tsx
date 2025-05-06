import React, { useState } from 'react';
import './App.css';
import { AuthFormProps } from './main';

export default function ConversationAuthForm({ sessionId, disabled }: AuthFormProps) {
  const [projectId, setProjectId] = useState('');
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    try {
      // Fetch JWT through our proxy server to avoid CORS issues
      const authResponse = await fetch('http://localhost:4399/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId, keySecret })
      });

      const jwt = await authResponse.json();

      // Callback to MCP server with all the necessary information
      await fetch('http://localhost:4399/callback/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, projectId, token: jwt })
      });
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      alert('Authentication failed.');
    }
  };

  if (submitted) {
    return <h2>Authentication successful. You can close this tab.</h2>;
  }

  return (
    <div className="container">
      <div className="form-box">
        <img src="/sinch.jpg" alt="Company Logo" className="logo"/>
        <h2>Authenticate with your credentials</h2>
        <form onSubmit={handleSubmit}>
          <input
            placeholder="Project ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
          />
          <input
            placeholder="Key ID"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            required
          />
          <input
            placeholder="Key Secret"
            type="password"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            required
          />
          <button type="submit" disabled={disabled}>Submit</button>
        </form>
      </div>
    </div>
  );
}
