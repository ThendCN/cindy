/**
 * ProjectOverviewRoute —— /cc-agent/project/:projectKey 项目概览页
 * ---------------------------------------------------------------------------
 * 规则正本:docs/product-rules/project-overview.md。
 *   - 归属与侧边栏项目行一致:同一份 useProjectGroups(含置顶),只认本机项目。
 *   - 分列与灯语与侧边栏同源(groupProjectOverviewColumns / dotToneOf)。
 *   - 只读订阅:侧边栏是系统通知与提醒清除的唯一 owner,本页不调用
 *     useSessionRunningStatus,也不读侧边栏内部的 urgency context ——
 *     定时任务失败未读在这里按同一索引自行推导。
 */

import { useMemo, useSyncExternalStore } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSessionListActivityAt } from '@cindy/maker-shared/session-activity';
import { CINDY_MAKE_ENABLED, isCindyMakeSource } from '@cindy/maker-shared/cindy-make-feature';
import { WINDOW_DRAG_STYLE } from '@/components/layout/windowDrag';
import { useCCSessions } from '@/hooks/useCCSessions';
import { deriveRunningSet } from '@/hooks/useSessionRunningStatus';
import type { Session } from '@/lib/ccAgent.types';
import { makerChatStore } from '@/lib/makerChatStore';
import { cn } from '@/lib/utils';
import { useSessionAttentionSnapshot } from '@/lib/sessionAttentionStore';
import { useProjectAliases } from '../hooks/useProjectAliases';
import { useProjectGroups } from '../hooks/useProjectGroups';
import { usePublishedAutomationScheduleSessionIndex } from '../hooks/useAutomationScheduleSessionIndex';
import { useSessionDisplayRunningState } from '../hooks/useSessionDisplayRunningState';
import { formatSidebarTime } from '../lib/formatSidebarTime';
import {
  mergeOrcaLeadNotifications,
  useOrcaLeadWorkerAttention,
  useSessionAttentionKindsWithOrcaLeads,
} from '../lib/orcaLeadWorkerAttention';
import { groupProjectOverviewColumns, type ProjectOverviewColumn } from '../lib/projectOverviewColumns';
import { getSessionDisplayTitle } from '../lib/sessionDisplayTitle';
import { dotToneOf, type SessionLampContext } from '../lib/sessionLampAggregation';
import { SessionStatusIcon } from '../sidebar/SessionStatusIcon';

const COLUMN_ORDER: readonly ProjectOverviewColumn[] = ['running', 'waiting', 'recent', 'archived'];

/** 与侧边栏 CCAgentSidebarUpper 同口径的灯语上下文(本机部分),全部只读订阅。 */
function useOverviewLamp(sessions: readonly Session[]): SessionLampContext {
  const statusMap = useSyncExternalStore(
    makerChatStore.subscribeAll,
    makerChatStore.getRunningSnapshot,
    makerChatStore.getRunningSnapshot,
  );
  const runningSessionIds = useMemo(() => deriveRunningSet(statusMap), [statusMap]);
  const { displayRunningSessionIds } = useSessionDisplayRunningState(sessions, runningSessionIds);
  const rawNotifications = useSessionAttentionSnapshot();
  const orcaLeadAttention = useOrcaLeadWorkerAttention();
  const attentionKinds = useSessionAttentionKindsWithOrcaLeads();
  const scheduleIndex = usePublishedAutomationScheduleSessionIndex();
  return useMemo(() => {
    const notifications = new Set(mergeOrcaLeadNotifications(rawNotifications, orcaLeadAttention));
    const urgentSessionIds = new Set<string>();
    for (const [sessionId, info] of scheduleIndex) {
      if (info.hasUnreadRun) notifications.add(sessionId);
      if (info.hasUnreadFailedRun) urgentSessionIds.add(sessionId);
    }
    return { runningSessionIds: displayRunningSessionIds, notifications, attentionKinds, urgentSessionIds };
  }, [displayRunningSessionIds, rawNotifications, orcaLeadAttention, attentionKinds, scheduleIndex]);
}

export function ProjectOverviewRoute() {
  const { projectKey = '' } = useParams();
  const { t } = useTranslation();
  const { sessions: allSessions } = useCCSessions({ includeArchived: 'all' });
  const sessions = useMemo(
    () => (CINDY_MAKE_ENABLED ? allSessions : allSessions.filter((s) => !isCindyMakeSource(s.source))),
    [allSessions],
  );
  const { aliases } = useProjectAliases();
  const groups = useProjectGroups(sessions, aliases, true, undefined, window.electronAPI.platform);
  const project = groups.projects.find((p) => p.scope === 'local' && p.projectKey === projectKey);
  const lamp = useOverviewLamp(sessions);
  const columns = useMemo(() => groupProjectOverviewColumns(project?.sessions ?? [], lamp), [project, lamp]);

  return (
    <div className="app-wallpaper-surface flex h-full w-full flex-col bg-[hsl(var(--content-area))]">
      <header
        className="flex min-h-[68px] shrink-0 items-center gap-3 border-b border-[var(--cmd-palette-border)] px-6 py-4"
        style={WINDOW_DRAG_STYLE}
      >
        <LayoutDashboard size={18} strokeWidth={1.75} className="shrink-0 text-[var(--settings-section-desc)]" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="truncate text-lg font-medium leading-none text-[var(--msg-assistant-text)]">
            {project?.displayName ?? t('ccAgent.projectOverview.title')}
          </h1>
          {project && (
            <span className="truncate text-xs leading-none text-[var(--cmd-palette-item-meta)]">
              {t('ccAgent.projectOverview.meta', { path: project.workingDir, count: project.sessions.length })}
            </span>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {project ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMN_ORDER.map((column) => (
              <section key={column} className="flex min-w-0 flex-col gap-2">
                <h2 className="flex items-center gap-2 px-1 text-[13px] font-medium text-[var(--msg-assistant-text)]">
                  {t(`ccAgent.projectOverview.columns.${column}`)}
                  <span className="text-xs font-normal text-[var(--cmd-palette-item-meta)]">
                    {columns[column].length}
                  </span>
                </h2>
                {columns[column].length === 0 ? (
                  <p className="px-1 text-xs text-[var(--cmd-palette-item-meta)]">
                    {t('ccAgent.projectOverview.emptyColumn')}
                  </p>
                ) : (
                  columns[column].map((session) => (
                    <TaskCard
                      key={session.id}
                      session={session}
                      running={lamp.runningSessionIds.has(session.id)}
                      tone={dotToneOf(session.id, lamp.notifications, lamp.attentionKinds, lamp.urgentSessionIds)}
                    />
                  ))
                )}
              </section>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--cmd-palette-item-meta)]">{t('ccAgent.projectOverview.notFound')}</p>
        )}
      </div>
    </div>
  );
}

function TaskCard({
  session,
  running,
  tone,
}: {
  session: Session;
  running: boolean;
  tone: ReturnType<typeof dotToneOf>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const archived = session.status === 'archived';
  return (
    <button
      type="button"
      onClick={() => navigate(`/cc-agent/${session.id}`)}
      className={cn(
        'flex w-full min-w-0 flex-col gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 py-2.5 text-left',
        'hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-soft)]',
        archived && 'border-dashed opacity-70',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <SessionStatusIcon
          session={session}
          isRunning={running}
          isAttached={false}
          hasAttentionNotification={tone != null}
          isActive={false}
          attentionToneOverride={tone ?? undefined}
        />
        <span className="truncate text-[13px] font-medium text-[var(--msg-assistant-text)]">
          {getSessionDisplayTitle(session, t('ccAgent.common.unnamedSession'), t)}
        </span>
      </span>
      <span className="pl-5 text-xs text-[var(--cmd-palette-item-meta)]">
        {formatSidebarTime(getSessionListActivityAt(session), t)}
      </span>
    </button>
  );
}
