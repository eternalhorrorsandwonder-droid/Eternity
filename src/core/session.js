/** Prevent overlapping asynchronous session changes from replacing each other. */
export function createSessionGuard(onBusyChange = () => {}) {
  let busy = false;
  return async operation => {
    if (busy) throw new Error('Another journey operation is still in progress. Please wait.');
    busy = true;
    try {
      onBusyChange(true);
      return await operation();
    } finally {
      busy = false;
      onBusyChange(false);
    }
  };
}
