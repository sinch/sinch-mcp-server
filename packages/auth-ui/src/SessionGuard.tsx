import { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

interface SessionGuardProps {
    children: (props: { sessionId: string; disabled: boolean }) => ReactNode;
}

export default function SessionGuard({ children }: SessionGuardProps) {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const isMissing = !sessionId;

  return (
    <>
      {isMissing && (
        <p className="session-warning">
                    ⚠️ Missing <code>sessionId</code>. Authentication is disabled.
        </p>
      )}
      {children({ sessionId: sessionId || '', disabled: isMissing })}
    </>
  );
}
