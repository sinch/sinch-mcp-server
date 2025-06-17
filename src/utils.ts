import { PromptResponse } from './types';

export const isPromptResponse = (x: any): x is PromptResponse => {
  return x instanceof PromptResponse;
}

export const hasMatchingTag= (tags: string[], filteringTags: string[]): boolean => {
  if (!filteringTags || filteringTags.length === 0) {
    return true;
  }

  const normalizedTags = tags.map(tag => tag.toLowerCase());
  const normalizedFilteringTags = filteringTags.map(tag => tag.toLowerCase());

  return normalizedTags.some(tag => normalizedFilteringTags.includes(tag));
}
