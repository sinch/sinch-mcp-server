import { PromptResponse } from './types';

export const isPromptResponse = (x: any): x is PromptResponse => {
  return x instanceof PromptResponse;
}
