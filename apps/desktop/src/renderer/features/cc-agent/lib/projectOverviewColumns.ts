/**
 * projectOverviewColumns — 项目概览页的任务分列
 * ---------------------------------------------------------------------------
 * 规则正本:docs/product-rules/project-overview.md §2。判定顺序:
 *   进行中 → 已归档 → 等你处理 → 最近。
 * 「等你处理」沿用 sessionLampAggregation 的 dotToneOf,保证同一任务在概览页与
 * 侧边栏显示同一状态(未读集合之外不计,定时任务失败提升为出错)。
 */

import type { Session } from '@/lib/ccAgent.types';
import { dotToneOf, type SessionLampContext } from './sessionLampAggregation';

export type ProjectOverviewColumn = 'running' | 'waiting' | 'recent' | 'archived';

function columnOf(session: Pick<Session, 'id' | 'status'>, lamp: SessionLampContext): ProjectOverviewColumn {
  if (lamp.runningSessionIds.has(session.id)) return 'running';
  if (session.status === 'archived') return 'archived';
  const tone = dotToneOf(session.id, lamp.notifications, lamp.attentionKinds, lamp.urgentSessionIds);
  return tone === 'awaiting' || tone === 'error' ? 'waiting' : 'recent';
}

/** 按列分组;列内保持传入顺序(ProjectNode.sessions 已按状态、最近活动排好)。 */
export function groupProjectOverviewColumns<T extends Pick<Session, 'id' | 'status'>>(
  sessions: readonly T[],
  lamp: SessionLampContext,
): Record<ProjectOverviewColumn, T[]> {
  const columns: Record<ProjectOverviewColumn, T[]> = { running: [], waiting: [], recent: [], archived: [] };
  for (const session of sessions) columns[columnOf(session, lamp)].push(session);
  return columns;
}
