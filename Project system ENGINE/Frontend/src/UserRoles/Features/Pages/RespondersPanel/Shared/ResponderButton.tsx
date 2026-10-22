// [Layer: UserRoles/Features/Pages/RespondersPanel/Shared]
// Responsibility: Role-scoped button adapter delegating to global @/Shared/Button with tactical responder styling.
// DO NOT break button variant accessibility contracts.

import React from 'react';
import { Button, ButtonProps } from '@/Shared/Button';

export const ResponderButton: React.FC<ButtonProps> = (props) => (
  <Button {...props} className={`shadow-sky-950/40 ${props.className || ''}`} />
);
