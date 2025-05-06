import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ConversationAuthForm from './ConversationAuthForm';
import SessionGuard from './SessionGuard';
import VerificationAuthForm from './VerificationAuthForm';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/auth/conversation" element={<SessionGuard>
          {({ sessionId, disabled }) => (
            <ConversationAuthForm sessionId={sessionId} disabled={disabled} />
          )}
        </SessionGuard>} />
        <Route path="/auth/verification" element={<SessionGuard>
          {({ sessionId, disabled }) => (
            <VerificationAuthForm sessionId={sessionId} disabled={disabled} />
          )}
        </SessionGuard>} />
        <Route path="*" element={<div>Select an authentication method.</div>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

export interface AuthFormProps {
    sessionId: string;
    disabled: boolean;
}
