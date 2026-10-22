// [Layer: UserRoles/Features/Pages/AdminsPanel/Shared]
// Responsibility: Role-scoped button adapter delegating to global @/Shared/Button with command styling.
// DO NOT duplicate global button primitives; wrap and style for LDRRMO admin scope.

import React from 'react';
import { Button, ButtonProps } from '@/Shared/Button';

export const AdminButton: React.FC<ButtonProps> = (props) => (
  <Button {...props} className={`shadow-rose-950/40 ${props.className || ''}`} />
);
