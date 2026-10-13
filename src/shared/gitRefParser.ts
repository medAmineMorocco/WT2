import type { GitRemote } from './gitRemote';
import type { GitTagStatus } from './gitTag';

export interface ParsedBranchRef {
  type: 'branch';
  key: string;
  branchName: string;
  isHead: boolean;
  isLocal: boolean;
  isRemote: boolean;
  remotes: string[];
  remoteUrl: string;
}

export interface ParsedTagRef {
  type: 'tag';
  key: string;
  tagName: string;
  rawRef: string;
}

export interface ParsedStashRef {
  type: 'stash';
  key: string;
  stashName: string;
  rawRef: string;
}

export interface ParsedHeadRef {
  type: 'head';
  key: string;
  rawRef: string;
}

export type ParsedGitRefItem =
  | ParsedBranchRef
  | ParsedTagRef
  | ParsedStashRef
  | ParsedHeadRef;

export function parseGitLogRefs(
  value: string,
  remotes?: GitRemote[],
  tagStatuses?: Record<string, GitTagStatus>,
): ParsedGitRefItem[] {
  if (!value || !value.trim()) return [];

  const rawRefs = value
    .split(',')
    .map((ref) => ref.trim())
    .filter(Boolean);
  if (rawRefs.length === 0) return [];

  // Filter out symbolic remote HEADs (e.g. origin/HEAD)
  const filteredRefs = rawRefs.filter(
    (r) => !(r !== 'HEAD' && r.endsWith('/HEAD')),
  );
  if (filteredRefs.length === 0) return [];

  // Collect known remote names
  const knownRemoteNames = new Set<string>();
  for (const r of remotes || []) {
    if (r?.name) knownRemoteNames.add(r.name);
  }
  if (tagStatuses) {
    for (const status of Object.values(tagStatuses)) {
      for (const r of status.remotes || []) {
        if (r) knownRemoteNames.add(r);
      }
    }
  }
  for (const r of rawRefs) {
    if (r !== 'HEAD' && r.endsWith('/HEAD')) {
      const prefix = r.slice(0, -5).trim();
      if (prefix) knownRemoteNames.add(prefix);
    }
  }
  if (knownRemoteNames.size === 0) {
    knownRemoteNames.add('origin');
    knownRemoteNames.add('upstream');
  }

  const getRemoteUrl = (remoteName: string): string => {
    const match = remotes?.find((r) => r.name === remoteName);
    if (match?.fetchUrl) return match.fetchUrl;
    if (match?.pushUrl) return match.pushUrl;
    if (tagStatuses) {
      for (const status of Object.values(tagStatuses)) {
        if (status.remotes?.includes(remoteName) && status.remoteUrl) {
          return status.remoteUrl;
        }
      }
    }
    return '';
  };

  interface BranchAccumulator {
    branchName: string;
    isHead: boolean;
    isLocal: boolean;
    isRemote: boolean;
    remotes: string[];
    remoteUrl: string;
  }

  const branchMap = new Map<string, BranchAccumulator>();
  const branchOrder: string[] = [];
  const tagsList: { tagName: string; rawRef: string }[] = [];
  const stashesList: { stashName: string; rawRef: string }[] = [];
  let hasDetachedHead = false;

  for (const ref of filteredRefs) {
    if (ref.startsWith('tag:')) {
      tagsList.push({
        tagName: ref.replace(/^tag:\s*/, '').trim(),
        rawRef: ref,
      });
      continue;
    }

    if (ref.startsWith('stash') || ref.startsWith('refs/stash')) {
      let displayRef = ref;
      if (ref === 'refs/stash') {
        displayRef = 'stash@{0}';
      } else if (ref.startsWith('refs/stash')) {
        displayRef = ref.replace(/^refs\/stash/, 'stash');
      }
      stashesList.push({
        stashName: displayRef,
        rawRef: ref,
      });
      continue;
    }

    if (ref === 'HEAD') {
      hasDetachedHead = true;
      continue;
    }

    if (ref.startsWith('HEAD ->')) {
      const target = ref.replace(/^HEAD\s*->\s*/, '').trim();
      let matchedRemote: string | null = null;
      for (const rem of knownRemoteNames) {
        if (target.startsWith(`${rem}/`)) {
          matchedRemote = rem;
          break;
        }
      }

      let branchName = target;
      let isLocal = true;
      let isRemote = false;
      const remotesFound: string[] = [];
      if (matchedRemote) {
        branchName = target.slice(matchedRemote.length + 1);
        isRemote = true;
        remotesFound.push(matchedRemote);
      }

      const existing = branchMap.get(branchName);
      if (existing) {
        existing.isHead = true;
        existing.isLocal = true;
        if (isRemote && !existing.remotes.includes(matchedRemote!)) {
          existing.isRemote = true;
          existing.remotes.push(matchedRemote!);
          if (!existing.remoteUrl) {
            existing.remoteUrl = getRemoteUrl(matchedRemote!);
          }
        }
      } else {
        branchOrder.push(branchName);
        branchMap.set(branchName, {
          branchName,
          isHead: true,
          isLocal,
          isRemote,
          remotes: remotesFound,
          remoteUrl: remotesFound[0] ? getRemoteUrl(remotesFound[0]) : '',
        });
      }
      continue;
    }

    // Check if it matches a known remote tracking branch
    let matchedRemote: string | null = null;
    for (const rem of knownRemoteNames) {
      if (ref.startsWith(`${rem}/`)) {
        matchedRemote = rem;
        break;
      }
    }

    if (matchedRemote) {
      const branchName = ref.slice(matchedRemote.length + 1);
      const existing = branchMap.get(branchName);
      if (existing) {
        existing.isRemote = true;
        if (!existing.remotes.includes(matchedRemote)) {
          existing.remotes.push(matchedRemote);
        }
        if (!existing.remoteUrl) {
          existing.remoteUrl = getRemoteUrl(matchedRemote);
        }
      } else {
        branchOrder.push(branchName);
        branchMap.set(branchName, {
          branchName,
          isHead: false,
          isLocal: false,
          isRemote: true,
          remotes: [matchedRemote],
          remoteUrl: getRemoteUrl(matchedRemote),
        });
      }
      continue;
    }

    // Local branch
    const branchName = ref;
    const existing = branchMap.get(branchName);
    if (existing) {
      existing.isLocal = true;
    } else {
      branchOrder.push(branchName);
      branchMap.set(branchName, {
        branchName,
        isHead: false,
        isLocal: true,
        isRemote: false,
        remotes: [],
        remoteUrl: '',
      });
    }
  }

  const result: ParsedGitRefItem[] = [];

  if (hasDetachedHead) {
    result.push({ type: 'head', key: 'head-detached', rawRef: 'HEAD' });
  }

  // Sort branches: HEAD branch first, then local & remote branches, then others
  const sortedBranchNames = [...branchOrder].sort((a, b) => {
    const bA = branchMap.get(a)!;
    const bB = branchMap.get(b)!;
    if (bA.isHead && !bB.isHead) return -1;
    if (!bA.isHead && bB.isHead) return 1;
    if (bA.isLocal && bA.isRemote && !(bB.isLocal && bB.isRemote)) return -1;
    if (!(bA.isLocal && bA.isRemote) && bB.isLocal && bB.isRemote) return 1;
    return 0;
  });

  for (const bName of sortedBranchNames) {
    const bInfo = branchMap.get(bName);
    if (bInfo) {
      result.push({
        type: 'branch',
        key: `branch-${bName}`,
        ...bInfo,
      });
    }
  }

  for (const stash of stashesList) {
    result.push({
      type: 'stash',
      key: `stash-${stash.stashName}`,
      stashName: stash.stashName,
      rawRef: stash.rawRef,
    });
  }

  for (const tag of tagsList) {
    result.push({
      type: 'tag',
      key: `tag-${tag.tagName}`,
      tagName: tag.tagName,
      rawRef: tag.rawRef,
    });
  }

  return result;
}
