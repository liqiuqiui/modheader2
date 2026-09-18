export function createLatestTask(task: () => Promise<void>): () => void {
  let requested = false;
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      while (requested) {
        requested = false;
        await task();
      }
    } catch (error) {
      console.error(error);
    } finally {
      running = false;
      if (requested) void run();
    }
  };

  return () => {
    requested = true;
    void run();
  };
}

export function createDocumentMutationQueue() {
  let queue: Promise<void> = Promise.resolve();

  return function enqueueDocumentTask<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
