/**
 * projectOverviewColumns — 项目概览页任务分列
 * ---------------------------------------------------------------------------
 * 测试价值
 * - 生产入口与可观察结果:groupProjectOverviewColumns;任务出现在概览页哪一列。
 * - 规则依据:docs/product-rules/project-overview.md §2(判定顺序、与侧边栏灯语同源)。
 * - 现有覆盖缺口:新功能;sessionLampAggregation.test 只覆盖灯语本身,不覆盖分列优先级。
 * - 最小失败输入:运行中的已归档任务、不在未读集合里的 awaiting、定时任务失败未读。
 * - tier:unit,纯函数,无外部资源。
 */

import { describe, expect, it } from 'vitest';

import type { AttentionKind } from '@/lib/sessionAttentionStore';
import type { Session } from '@/lib/ccAgent.types';
import { groupProjectOverviewColumns, type ProjectOverviewColumn } from '../projectOverviewColumns';

const lamp = (over: {
  running?: string[];
  notifications?: string[];
  kinds?: Record<string, AttentionKind>;
  urgent?: string[];
}) => ({
  runningSessionIds: new Set(over.running ?? []),
  notifications: new Set(over.notifications ?? []),
  attentionKinds: new Map(Object.entries(over.kinds ?? {})),
  urgentSessionIds: new Set(over.urgent ?? []),
});

const task = (id: string, status: Session['status'] = 'active') => ({ id, status });

describe('groupProjectOverviewColumns', () => {
  it.each<[string, ReturnType<typeof task>, ReturnType<typeof lamp>, ProjectOverviewColumn]>([
    ['运行中 + 等待确认 → 进行中', task('a'), lamp({ running: ['a'], notifications: ['a'], kinds: { a: 'awaiting' } }), 'running'],
    ['已归档但正在运行 → 进行中(运行优先于归档)', task('a', 'archived'), lamp({ running: ['a'] }), 'running'],
    ['已归档 + 出错未读 → 已归档(归档优先于提醒)', task('a', 'archived'), lamp({ notifications: ['a'], kinds: { a: 'error' } }), 'archived'],
    ['等待确认未读 → 等你处理', task('a'), lamp({ notifications: ['a'], kinds: { a: 'awaiting' } }), 'waiting'],
    ['出错未读 → 等你处理', task('a'), lamp({ notifications: ['a'], kinds: { a: 'error' } }), 'waiting'],
    ['定时任务失败未读(urgent)→ 等你处理', task('a'), lamp({ notifications: ['a'], urgent: ['a'] }), 'waiting'],
    ['awaiting 不在未读集合 → 最近(与侧边栏一致,不点灯)', task('a'), lamp({ kinds: { a: 'awaiting' } }), 'recent'],
    ['完成未读 → 最近', task('a'), lamp({ notifications: ['a'], kinds: { a: 'done' } }), 'recent'],
  ])('%s', (_name, session, context, expected) => {
    expect(groupProjectOverviewColumns([session], context)[expected]).toEqual([session]);
  });

  it('列内保持传入顺序', () => {
    const sessions = [task('new'), task('busy'), task('old'), task('gone', 'archived')];
    expect(groupProjectOverviewColumns(sessions, lamp({ running: ['busy'] }))).toEqual({
      running: [sessions[1]],
      waiting: [],
      recent: [sessions[0], sessions[2]],
      archived: [sessions[3]],
    });
  });
});
