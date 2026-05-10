import { useState, useEffect } from 'react';

export type MicPermission = 'granted' | 'denied' | 'prompt';

export function useMicPermission() {
  const [micPermission, setMicPermission] = useState<MicPermission>('prompt');

  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then(status => {
        setMicPermission(status.state as MicPermission);
        status.onchange = () => setMicPermission(status.state as MicPermission);
      })
      .catch(() => {});
  }, []);

  async function requestMicPermission(): Promise<MicPermission> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicPermission('granted');
      return 'granted';
    } catch {
      setMicPermission('denied');
      return 'denied';
    }
  }

  return { micPermission, requestMicPermission };
}
