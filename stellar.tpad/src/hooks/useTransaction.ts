'use client';

import { useState } from 'react';

export function useTransaction() {
  const [pending, setPending] = useState(false);
  return { pending, setPending };
}