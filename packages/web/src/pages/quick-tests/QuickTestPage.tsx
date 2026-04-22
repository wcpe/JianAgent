import { Navigate } from 'react-router-dom';

/**
 * QuickTestPage now redirects to the unified validation center.
 * The validation center provides quick validation, template validation,
 * and post-ops validation in a single page.
 */
export function QuickTestPage() {
  return <Navigate to="/validation?mode=quick" replace />;
}
