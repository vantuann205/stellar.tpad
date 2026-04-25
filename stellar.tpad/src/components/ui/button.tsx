'use client';

import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className = '', ...props }: ButtonProps) {
  return <button className={`rounded-lg px-4 py-2 font-medium ${className}`} {...props} />;
}