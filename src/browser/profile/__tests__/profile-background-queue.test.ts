import { describe, expect, it, vi } from "vitest";
import { createDocumentMutationQueue, createLatestTask } from "../profile-background-queue";

describe("profile background queue", () => {
  it("serializes document mutations and continues after rejection", async () => {
    const queue = createDocumentMutationQueue();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const first = queue(async () => {
      events.push("first:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      events.push("first:end");
      return 1;
    });
    const second = queue(async () => {
      events.push("second");
      return 2;
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);
    releaseFirst();
    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
    expect(events).toEqual(["first:start", "first:end", "second"]);
  });

  it("coalesces notifications while a task is running", async () => {
    const releases: Array<() => void> = [];
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releases.push(resolve);
        }),
    );
    const schedule = createLatestTask(task);

    schedule();
    schedule();
    schedule();
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);

    releases.shift()?.();
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(2);
    releases.shift()?.();
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(2);
  });
});
