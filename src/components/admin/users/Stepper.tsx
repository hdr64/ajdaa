/**
 * Stepper for the user creation wizard.
 * Shows 3 numbered steps with click-to-go-back (not forward past invalid).
 * RTL-aware: Next points left in RTL.
 */
import React from 'react';
import { Check } from 'lucide-react';

import { useAdminT } from '../../../i18n/admin/useAdminT';

export type WizardStep = 1 | 2 | 3;

interface StepperProps {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  onStepClick: (step: WizardStep) => void;
  disabledSteps?: Set<WizardStep>;
  step3Label?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  completedSteps,
  onStepClick,
  disabledSteps = new Set(),
  step3Label,
}) => {
  const { t } = useAdminT();
  const steps: WizardStep[] = [1, 2, 3];
  const stepLabels: Record<WizardStep, string> = {
    1: t('users.step1'),
    2: t('users.step2'),
    3: step3Label || t('users.step3'),
  };

  return (
    <nav
      aria-label={t('users.stepperAria')}
      className="flex items-center justify-center gap-2 sm:gap-4 px-4 py-3 border-b border-muted-border/30"
    >
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(step);
        const isCurrent = step === currentStep;
        const isDisabled = disabledSteps.has(step);
        const isClickable = isCompleted || (isCurrent && !isDisabled);
        const showConnector = index < steps.length - 1;

        return (
          <React.Fragment key={step}>
            <button
              type="button"
              onClick={() => onStepClick(step)}
              disabled={!isClickable}
              aria-current={isCurrent ? 'step' : undefined}
              aria-disabled={!isClickable}
              className={`
                relative flex flex-col items-center gap-1.5 transition-all
                ${isCurrent ? 'text-accent' : 'text-neutral-text/50'}
                ${isCompleted ? 'text-emerald-500' : ''}
                ${!isClickable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:text-heading'}
              `}
            >
              <div
                className={`
                  relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 transition-all
                  ${isCompleted
                    ? 'bg-emerald-500 border-emerald-500 text-canvas'
                    : isCurrent
                    ? 'border-accent bg-surface text-accent'
                    : 'border-muted-border/40 bg-surface text-neutral-text/50'}
                `}
                aria-hidden="true"
              >
                {isCompleted ? <Check className="w-4.5 h-4.5" /> : <span className="text-xs sm:text-sm font-black">{step}</span>}
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                {stepLabels[step]}
              </span>
            </button>
            {showConnector && (
              <div
                className={`
                  hidden sm:block w-16 h-0.5 shrink-0 self-center mx-1 transition-colors
                  ${completedSteps.has(steps[index + 1]) || (isCompleted && index < steps.length - 1)
                    ? 'bg-emerald-500'
                    : 'bg-muted-border/30'}
                `}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};