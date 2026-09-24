import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isProfileCommandMessage,
  PROFILE_COMMAND_CHANNEL,
} from "../browser/profile/profile-command-protocol";
import type { ProfileCommand } from "../services/profile/profile-command";
import { reduceProfileCommand } from "../services/profile/reduce-profile-command";
import { createInitialProfileDocument } from "../types/profile/profile-document";
import { createProfile } from "../types/profile/profile-factory";
import { createProfileFilter, type FilterTarget } from "../types/profile/profile-filter";
import {
  FILTER_KINDS,
  type FilterKind,
  type Profile,
  type ProfileFilter,
} from "../types/profile/profile-model";
import { appStore } from "./app-store";

const PROFILE_ID = "profile-1";
const FILTER_ID = "filter-1";

// hoisted 的常量才能在 `vi.mock` 工厂里引用。
const mocks = vi.hoisted(() => ({
  CLIENT_ID: "client-test",
  enqueueProfileCommand: vi.fn(),
}));

vi.mock("../i18n", () => ({
  default: {
    getFixedT: () => (_key: string, options?: { number?: number; title?: string }) =>
      options?.title ?? `Profile ${options?.number ?? 1}`,
  },
}));

vi.mock("../browser/profile/profile-storage", () => ({
  readStoredProfileDocument: vi.fn(async () => undefined),
  watchStoredProfileDocument: vi.fn(() => () => undefined),
}));

vi.mock("../browser/profile/profile-command-client", () => ({
  enqueueProfileCommand: mocks.enqueueProfileCommand,
  PROFILE_COMMAND_CLIENT_ID: mocks.CLIENT_ID,
}));

function profileWithFilter(kind: FilterKind): Profile {
  return {
    ...createProfile({ id: PROFILE_ID, title: "Profile", backgroundColor: "#2563eb" }),
    filters: [createProfileFilter({ id: FILTER_ID, kind })],
  };
}

/** 让 store 直接处于「已有一个过滤器」的权威状态，省掉一整套初始化流程。 */
function seedStore(profile: Profile): void {
  mocks.enqueueProfileCommand.mockReset();
  mocks.enqueueProfileCommand.mockResolvedValue(
    createInitialProfileDocument(profile, mocks.CLIENT_ID, 1),
  );
  appStore.setState({
    profiles: [profile],
    selectedProfileId: profile.id,
    revision: 1,
    past: [],
    future: [],
    status: "ready",
    error: null,
  });
}

function commandMessage(command: unknown) {
  return { channel: PROFILE_COMMAND_CHANNEL, clientId: mocks.CLIENT_ID, command };
}

function appliedFilter(result: ReturnType<typeof reduceProfileCommand>): ProfileFilter {
  if (result.status !== "applied") {
    throw new Error(`expected an applied command, got ${result.status}`);
  }
  const filter = result.document.state.profiles[0].filters[0];
  if (!filter) throw new Error("expected the filter to survive the kind change");
  return filter;
}

const carriedIds = (command: ProfileCommand) =>
  command as { currentTabId?: number; groupId?: number; windowId?: number };

/**
 * 跨进程命令的契约测试。
 *
 * 命令经过 `browser.runtime.sendMessage` 发往后台时会先过 `isProfileCommandMessage`，
 * 校验失败的消息会被静默丢弃，UI 只会收到一句 "Invalid response from profile background"。
 * 生产侧（`normalizeFilterTarget`）与校验侧必须共用同一套「有效目标」定义，
 * 这张表负责把这条约定钉住：任何新增的、携带 `FilterTarget` 的命令都要在这里登记，
 * 否则真实来源里的哨兵值（未分组标签页的 `groupId = -1`）会再次让命令失效。
 */
describe("profile filter target command contract", () => {
  const sentinelTargets: Array<{
    label: string;
    target: FilterTarget;
    tabGroupValue: number | null;
  }> = [
    {
      label: "a tab that is not in any group",
      // TAB_GROUP_ID_NONE：`tabs.query()` 对未分组标签页返回的取值，也是最常见的取值。
      target: { currentTabId: 42, groupId: -1, windowId: 3 },
      tabGroupValue: null,
    },
    {
      label: "a tab inside a group",
      target: { currentTabId: 42, groupId: 7, windowId: 3 },
      tabGroupValue: 7,
    },
    {
      label: "an editor without an active tab",
      target: {},
      tabGroupValue: null,
    },
  ];

  beforeEach(() => {
    mocks.enqueueProfileCommand.mockReset();
  });

  for (const kind of FILTER_KINDS) {
    for (const { label, target, tabGroupValue } of sentinelTargets) {
      it(`delivers an applicable ${kind} change from ${label}`, async () => {
        // 初始类型必须与目标不同，否则命令会被当作 no-op 而不跨越进程。
        const initialKind: FilterKind = kind === "urlPattern" ? "urlRegex" : "urlPattern";
        const profile = profileWithFilter(initialKind);
        seedStore(profile);

        await expect(
          appStore.getState().changeFilterKind(PROFILE_ID, FILTER_ID, kind, target),
        ).resolves.toBe(true);

        expect(mocks.enqueueProfileCommand).toHaveBeenCalledTimes(1);
        const command = mocks.enqueueProfileCommand.mock.calls[0][0] as ProfileCommand;

        // 跨进程载荷必须能被后台接受。
        expect(isProfileCommandMessage(commandMessage(command))).toBe(true);

        // 无效目标 id（-1 / 非整数）不得出现在载荷里，否则校验会直接拒绝整条命令。
        for (const [key, value] of Object.entries({
          currentTabId: target.currentTabId,
          groupId: target.groupId,
          windowId: target.windowId,
        })) {
          const expected = value === undefined || value < 0 ? undefined : value;
          expect(carriedIds(command)[key as keyof ReturnType<typeof carriedIds>]).toBe(expected);
        }

        // 闭环：命令不仅合法，还能被 reducer 接受并落到目标类型上。
        const filter = appliedFilter(
          reduceProfileCommand(
            createInitialProfileDocument(profile, mocks.CLIENT_ID, 1),
            command,
            mocks.CLIENT_ID,
          ),
        );
        expect(filter).toMatchObject({ id: FILTER_ID, kind });
        if (kind === "tabGroup") expect(filter.value).toBe(tabGroupValue);
      });
    }
  }
});
