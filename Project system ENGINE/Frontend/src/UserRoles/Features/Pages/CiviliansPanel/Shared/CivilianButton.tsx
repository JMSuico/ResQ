// [Layer: UserRoles/Features/Pages/CiviliansPanel/Shared]
// Responsibility: Role-scoped button adapter delegating to global @/Shared/Button with civilian accessibility styling.
// DO NOT break button variant accessibility contracts.

import React from 'react';
import { Button, ButtonProps } from '@/Shared/Button';

export const CivilianButton: React.FC<ButtonProps> = (props) => (
  <Button {...props} className={`shadow-emerald-950/40 ${props.className || ''}`} />
);
