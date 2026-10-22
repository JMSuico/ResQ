// [Layer: UserRoles/Features/Pages/AdminsPanel/Shared]
// Responsibility: Role-scoped modal card adapter delegating to global @/Shared/DefaultFloatingModalCard.
// DO NOT break z-index stacking order for emergency command modals.

import React from 'react';
import { DefaultFloatingModalCard, ModalProps } from '@/Shared/DefaultFloatingModalCard';

export const AdminModalCard: React.FC<ModalProps> = (props) => (
  <DefaultFloatingModalCard {...props} />
);
