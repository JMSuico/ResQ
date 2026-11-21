// [Layer: UserRoles/Features/Pages/CiviliansPanel/Shared]
// Responsibility: Role-scoped modal card adapter delegating to global @/Shared/DefaultFloatingModalCard
// with Stitch Warm Ivory (#F7F1EA), Soft Beige (#E9D9D0), and Cherry (#670626) claymorphic styling.
// Strictly 100% arrow functions (=>), ZERO 'any', and ZERO emojis.

import React from 'react';
import { DefaultFloatingModalCard, ModalProps } from '@/Shared/DefaultFloatingModalCard';

export const CivilianModalCard: React.FC<ModalProps> = ({ className = '', ...props }) => (
  <DefaultFloatingModalCard
    {...props}
    className={`clay-surface !bg-[#F7F1EA] !text-[#670626] !border-[#670626]/20 !shadow-[0_24px_60px_-12px_rgba(74,4,26,0.55),inset_0_1px_0_rgba(255,255,255,0.85)] [&>div:first-child]:!bg-[#E9D9D0] [&>div:first-child]:!border-[#670626]/15 [&>div:first-child_h3]:!text-[#670626] [&>div:first-child_h3>span:first-child]:!bg-[#A83B4D] [&>div:first-child_p]:!text-[#A83B4D] [&>div:first-child_button]:!text-[#670626] [&>div:first-child_button:hover]:!bg-[#670626]/10 [&>div:last-child]:!border-[#670626]/15 ${className}`}
  />
);

export default CivilianModalCard;
