// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ProjectNode,
  type ProjectNodeProps,
} from '../features/cc-agent/sidebar/sections/ProjectNode';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/ui/tooltip', () => ({
  Tip: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../features/cc-agent/sidebar/SessionEntryList', () => ({ SessionEntryList: () => null }));

afterEach(cleanup);

function props(): ProjectNodeProps {
  return {
    project: {
      projectKey: 'local:demo',
      displayName: 'Demo project',
      workingDir: '/demo',
      scope: 'local',
      sessions: [],
      remoteHostId: null,
      deviceLinkDeviceId: null,
      deviceLinkDeviceName: null,
      deviceLinkConnectionStatus: null,
      segments: 1,
      latestActivityAt: '2026-09-10T00:00:00Z',
    },
    statusFilter: 'active',
    isCollapsed: true,
    parentSectionCollapsed: false,
    runningSessionIds: new Set(),
    attachedSessionIds: new Set(),
    notifications: new Set(),
    scheduleSessionIndex: new Map(),
    disableSessionCollapse: false,
    isProjectPinned: false,
    onToggle: vi.fn(),
    onToggleProjectPin: vi.fn(),
    onRenameProject: vi.fn(),
    onRemoveFromSidebar: vi.fn(),
    onSessionClick: vi.fn(),
    onAction: vi.fn(),
    onRename: vi.fn(),
    onTogglePin: vi.fn(),
    onMoveSession: vi.fn(),
    projectOptions: [],
    onScheduleAction: vi.fn(),
    onCreateInProject: vi.fn(),
    onOpenConversationSearch: vi.fn(),
    onOpenInExplorer: vi.fn(),
    onLinkCodexProject: vi.fn(),
    linkingCodexProject: false,
    onBrowseFiles: vi.fn(),
    onOpenOverview: vi.fn(),
    onArchiveAll: vi.fn(),
  };
}

describe('project lamp after upstream sidebar merge', () => {
  it('keeps one unread indicator in the trailing slot while a sibling task runs', () => {
    const { container } = render(
      <ProjectNode
        {...props()}
        collapsedAttentionTone="done"
        lamp={{ running: true, dotTone: 'done' }}
      />,
    );
    const header = container.querySelector('[data-project-header]')!;
    const slot = header.querySelector('.group\\/slot')!;
    const titleGroup = header.querySelector('.flex-1')!;
    expect(slot.querySelectorAll('.rounded-full').length).toBe(1);
    expect(titleGroup.querySelectorAll('.rounded-full').length).toBe(0);
    expect(header.querySelector('.session-status-breathing')).not.toBeNull();
  });

  it.each([null, 'done', 'error'] as const)(
    'shows awaiting ahead of %s unless an error needs attention',
    (collapsedAttentionTone) => {
      const { container } = render(
        <ProjectNode
          {...props()}
          collapsedAttentionTone={collapsedAttentionTone}
          lamp={{ running: false, dotTone: 'awaiting' }}
        />,
      );
      const header = container.querySelector('[data-project-header]')!;
      const tone = collapsedAttentionTone === 'error' ? 'error' : 'awaiting';
      expect(header.querySelector(`[data-sidebar-right-status="${tone}"]`)).not.toBeNull();
      expect(header.querySelectorAll('.rounded-full')).toHaveLength(1);
    },
  );

  it.each(['error', 'awaiting', 'done'] as const)('leaves expanded project %s attention and running state to its child rows', (dotTone) => {
    const { container } = render(
      <ProjectNode
        {...props()}
        isCollapsed={false}
        collapsedAttentionTone="error"
        lamp={{ running: true, dotTone }}
      />,
    );
    const header = container.querySelector('[data-project-header]')!;
    expect(header.querySelectorAll('.rounded-full').length).toBe(0);
    expect(header.querySelector('.session-status-breathing')).toBeNull();
  });
});

/*
 * 测试价值
 * - 生产入口与可观察结果:ProjectNode 项目行;「更多」菜单里「项目概览」的位置、显隐与点击结果。
 * - 规则依据:docs/product-rules/project-overview.md §1(入口在「更多」菜单浏览一组第一项、「搜索」之前;
 *   远程不显示;点击只打开概览、不折叠)。PR #7523 评审讨论(#7544)把入口从独立按钮收进菜单,
 *   悬停按钮组保持「更多 + 新建」两个,本机与远程项目一致。
 * - 现有覆盖缺口:本文件只覆盖灯语,没有覆盖项目菜单。
 * - 最小失败输入:本机项目打开菜单并点击概览;scope=remote 的项目打开菜单。
 * - tier:unit(jsdom),与本文件同一组件入口。
 */
describe('project overview entry', () => {
  const OVERVIEW = 'ccAgent.sidebar.projectAction.overview';
  const SEARCH = 'ccAgent.sidebar.projectAction.search';
  const openMenu = (view: ReturnType<typeof render>) => {
    fireEvent.click(view.getByLabelText('ccAgent.common.moreActions'));
    return [...document.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent);
  };

  it('sits right before Search in the More menu and opens the overview without toggling', () => {
    const p = props();
    const view = render(<ProjectNode {...p} />);
    expect(view.queryByLabelText(OVERVIEW)).toBeNull();
    const items = openMenu(view);
    expect(items.indexOf(OVERVIEW)).toBe(items.indexOf(SEARCH) - 1);
    fireEvent.click(view.getByText(OVERVIEW));
    expect(p.onOpenOverview).toHaveBeenCalledWith(p.project);
    expect(p.onToggle).not.toHaveBeenCalled();
  });

  it('is absent from the menu of remote projects', () => {
    const p = props();
    const view = render(
      <ProjectNode {...p} project={{ ...p.project, projectKey: 'remote:host:/demo', scope: 'remote', remoteHostId: 'host' }} />,
    );
    const items = openMenu(view);
    expect(items).toContain(SEARCH);
    expect(items).not.toContain(OVERVIEW);
  });
});
