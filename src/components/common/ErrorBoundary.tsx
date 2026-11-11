import { Component, type ContextType, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { reportClientError } from '../../services/api';
import { CmsContext } from '../../context/cmsContextDef';

interface ErrorBoundaryProps {
  children: ReactNode;
  language?: 'ar' | 'en';
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render errors below it so one broken component does not blank the
 * whole site. Reports the message and component stack only, never user data.
 * The boundary does not reset itself; the Reload button does a full reload.
 *
 * Inside the admin's live-preview iframe it also guards against unsaved drafts:
 * a draft that crashes the page is rejected (saved content is shown again, the
 * admin is told) and the crash is not reported as a site error.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static contextType = CmsContext;
  declare context: ContextType<typeof CmsContext>;

  state: ErrorBoundaryState = { hasError: false };

  /** Draft epoch at the time of the last preview crash; a newer epoch means retry. */
  private caughtEpoch = 0;

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const { preview } = this.context;
    if (preview.active) {
      this.caughtEpoch = preview.epoch;
      if (preview.hasDrafts) preview.rejectDrafts();
      return;
    }
    reportClientError(error.message, { componentStack: info.componentStack });
  }

  componentDidUpdate() {
    const { preview } = this.context;
    if (this.state.hasError && preview.active && preview.epoch !== this.caughtEpoch) {
      // Reacts to external (context) state, not derivable in render without a side effect.
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isAr = (this.props.language ?? 'ar') === 'ar';
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center p-8 bg-canvas">
        <div role="alert" className="bg-surface border border-muted-border rounded-2xl p-6 max-w-md w-full text-center shadow-lg">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" aria-hidden="true" />
          <h2 className="text-heading text-xl mb-2">
            {isAr ? 'حدث خطأ غير متوقع' : 'Something went wrong'}
          </h2>
          <p className="text-neutral-text/60 mb-6">
            {isAr ? 'يرجى إعادة تحميل الصفحة.' : 'Please reload the page.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {isAr ? 'إعادة تحميل' : 'Reload'}
          </button>
        </div>
      </div>
    );
  }
}
