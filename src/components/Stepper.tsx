import React from 'react';
import { Check } from 'lucide-react';

export type StepState = 'done' | 'active' | 'todo';

/** The three-step flow shown above the workspace: choose → convert → use the result. */
export const Stepper: React.FC<{ steps: Array<{ label: string; state: StepState }> }> = ({ steps }) => (
  <ol className="stepper" aria-label="Ablauf">
    {steps.map((step, i) => (
      <li key={step.label} className={`step step-${step.state}`} aria-current={step.state === 'active' ? 'step' : undefined}>
        <span className="step-marker">{step.state === 'done' ? <Check size={12} aria-hidden="true" /> : i + 1}</span>
        <span>{step.label}</span>
      </li>
    ))}
  </ol>
);
