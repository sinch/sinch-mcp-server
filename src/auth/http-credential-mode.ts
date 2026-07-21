export type HttpCredentialSource = 'env' | 'request-header';

let httpCredentialSource: HttpCredentialSource | undefined;

export const setHttpCredentialSource = (source: HttpCredentialSource): void => {
  httpCredentialSource = source;
};

export const getHttpCredentialSource = (): HttpCredentialSource | undefined => {
  return httpCredentialSource;
};

export const clearHttpCredentialSourceForTests = (): void => {
  httpCredentialSource = undefined;
};
