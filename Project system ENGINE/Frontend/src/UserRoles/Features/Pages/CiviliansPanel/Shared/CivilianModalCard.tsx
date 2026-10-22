// [Layer: UserRoles/Features/Pages/CiviliansPanel/Shared]
// Responsibility: Role-scoped modal card adapter delegating to global @/Shared/DefaultFloatingModalCard.
// DO NOT duplicate modal DOM tree implementations.

import React from 'react';
import { DefaultFloatingModalCard, ModalProps } from '@/Shared/DefaultFloatingModalCard';

export const CivilianModalCard: React.FC<ModalProps> = (props) => (
  <DefaultFloatingModalCard {...props} />
);
