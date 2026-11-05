'use client';
import { useState } from 'react';
import clsx from 'clsx';

export default function Shared() {
  const [message, setMessage] = useState('Ready');

  return (
    <section className={clsx('fixture', { ready: message === 'Ready' })}>
      <h1>BritePulse compatibility fixture</h1>
      <p>{message}</p>
      <button onClick={async () => setMessage((await import('fixture-variant')).describe())}>
        Load details
      </button>
      <a href="/other">Other page</a>
    </section>
  );
}
