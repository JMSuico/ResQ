// [Layer: UserRoles/Features/Pages/RespondersPanel/Shared]
// Responsibility: Role-scoped modal adapter delegating to global @/Shared/DefaultFloatingModalCard.
// DO NOT duplicate modal DOM tree implementations.

import React from 'react';
import { DefaultFloatingModalCard, ModalProps } from '@/Shared/DefaultFloatingModalCard';

export const ResponderModalCard: React.FC<ModalProps> = (props) => (
  <DefaultFloatingModalCard {...props} />
);
