'use client';

import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...props }: InputProps) {
  return <input className={`rounded-lg border border-white/20 bg-transparent px-3 py-2 ${className}`} {...props} />;
}