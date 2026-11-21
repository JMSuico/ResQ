// [Layer: UserRoles/Features/Pages/CiviliansPanel/Shared]
// Responsibility: Role-scoped button adapter delegating to global @/Shared/Button
// with Stitch Cherry (#670626), Warm Ivory (#F7F1EA), and Soft Beige (#E9D9D0) claymorphic styling.
// Strictly 100% arrow functions (=>), ZERO 'any', and ZERO emojis.

import React from 'react';
import { Button, ButtonProps, ButtonVariant } from '@/Shared/Button';

const STITCH_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    '!bg-[#670626] hover:!bg-[#4A041A] active:!bg-[#4A041A] !text-[#F7F1EA] !border-[#670626] !shadow-[0_6px_18px_rgba(74,4,26,0.32)] focus-visible:!ring-[#670626]',
  danger:
    '!bg-[#670626] hover:!bg-[#4A041A] active:!bg-[#4A041A] !text-[#F7F1EA] !border-[#A83B4D]/60 !shadow-[0_8px_22px_rgba(103,6,38,0.38)] focus-visible:!ring-[#A83B4D]',
  secondary:
    '!bg-[#E9D9D0] hover:!bg-[#F7F1EA] active:!bg-[#E9D9D0] !text-[#670626] !border-[#670626]/25 !shadow-[0_4px_12px_rgba(74,4,26,0.12)] focus-visible:!ring-[#670626]',
  outline:
    '!bg-[#F7F1EA] hover:!bg-[#E9D9D0] active:!bg-[#E9D9D0] !text-[#670626] !border-[#670626]/30 !shadow-[0_4px_12px_rgba(74,4,26,0.12)] focus-visible:!ring-[#670626]',
  ghost:
    '!bg-transparent hover:!bg-[#670626]/10 !text-[#670626] !border-transparent focus-visible:!ring-[#670626]',
  'soft-blue':
    '!bg-[#E9D9D0] hover:!bg-[#F7F1EA] !text-[#670626] !border-[#A83B4D]/35 !shadow-sm focus-visible:!ring-[#670626]',
  'action-green':
    '!bg-[#670626] hover:!bg-[#4A041A] !text-[#F7F1EA] !border-[#670626] !shadow-[0_6px_18px_rgba(74,4,26,0.3)] focus-visible:!ring-[#670626]',
  success:
    '!bg-[#670626] hover:!bg-[#4A041A] !text-[#F7F1EA] !border-[#670626] !shadow-[0_6px_18px_rgba(74,4,26,0.3)] focus-visible:!ring-[#670626]',
  warning:
    '!bg-[#A83B4D] hover:!bg-[#670626] !text-[#F7F1EA] !border-[#A83B4D] !shadow-[0_6px_18px_rgba(168,59,77,0.3)] focus-visible:!ring-[#A83B4D]'
};

export const CivilianButton: React.FC<ButtonProps> = ({
  variant = 'primary',
  className = '',
  ...props
}) => (
  <Button
    variant={variant}
    {...props}
    className={`rounded-xl font-bold transition-all duration-200 focus-visible:!ring-offset-[#F7F1EA] ${STITCH_VARIANT_CLASSES[variant]} ${className}`}
  />
);

export default CivilianButton;
