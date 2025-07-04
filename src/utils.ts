import { PromptResponse } from './types';
import { USER_AGENT } from './user-agent';

export const isPromptResponse = (x: any): x is PromptResponse => {
  return x instanceof PromptResponse;
}

export const matchesAnyTag= (tags: string[], filteringTags: string[]): boolean => {
  if (!filteringTags || filteringTags.length === 0) {
    return true;
  }

  const normalizedTags = tags.map(tag => tag.toLowerCase());
  const normalizedFilteringTags = filteringTags.map(tag => tag.toLowerCase());

  return normalizedTags.some(tag => normalizedFilteringTags.includes(tag));
}

export const formatUserAgent = (toolName: string, projectId: string): string => {
  return USER_AGENT.replace('{toolName}', toolName).replace('{projectId}', projectId);
}
