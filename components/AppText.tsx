'use client';

import React from 'react';
import { Text } from '@react-three/drei';

/**
 * Local font (Be Vietnam Pro Bold, OFL) bundled in /public/fonts.
 * Passing an explicit font stops troika-three-text from fetching fallback
 * fonts from a CDN, which used to suspend the whole scene (black screen).
 */
export const APP_FONT = '/fonts/BeVietnamPro-Bold.ttf';

// Only glyphs that exist in the bundled font. Anything else (emoji, symbols)
// would make troika try to download a fallback font from the internet.
const SUPPORTED =
  /[^ -~ -ćĊ-ēĖ-ěĞ-ġĦ-īĮ-ıĹ-ĺĽ-ľŁ-ńŇ-ňŌ-ōŐ-ŕŘ-śŞ-ūŮ-žƠ-ơƯ-ưǦ-ǧẠ-ỹ–-—‘-’“-”…₫]/gu;

export function safeText(input: React.ReactNode): string {
  const s = React.Children.toArray(input)
    .filter((c) => typeof c === 'string' || typeof c === 'number')
    .join('');
  return s.normalize('NFC').replace(/₂/g, '2').replace(/★/g, '*').replace(SUPPORTED, '').replace(/\s+/g, ' ').trim();
}

type TextProps = React.ComponentProps<typeof Text>;

export function AppText({ children, ...props }: TextProps) {
  const text = safeText(children);
  if (!text) return null;
  return (
    <Text font={APP_FONT} {...props}>
      {text}
    </Text>
  );
}
