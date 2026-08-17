import { PromptResponse } from './types';
import { USER_AGENT } from './user-agent';

export const isPromptResponse = (x: any): x is PromptResponse => {
  return x instanceof PromptResponse;
};

export const matchesAnyTag = (tags: string[], filteringTags: string[]): boolean => {
  if (!filteringTags || filteringTags.length === 0) {
    return true;
  }

  const normalizedTags = tags.map((tag) => tag.toLowerCase());
  const normalizedFilteringTags = new Set(filteringTags.map((tag) => tag.toLowerCase()));

  return normalizedTags.some((tag) => normalizedFilteringTags.has(tag));
};

export const formatUserAgent = (toolName: string, userId: string): string => {
  return USER_AGENT.replace('{toolName}', toolName).replace('{userId}', userId);
};

/**
 * Extracts a single value from an HTTP header: takes the first value when the
 * header is repeated, trims it, and returns undefined when missing or empty.
 */
export const extractHeaderValue = (headerValue: string | string[] | undefined): string | undefined => {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};
