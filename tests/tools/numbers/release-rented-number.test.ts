import { releaseRentedNumberHandler } from '../../../src/tools/numbers/release-rented-number';
import { PromptResponse } from '../../../src/types';
import * as numbersServiceHelper from '../../../src/tools/numbers/utils/numbers-service-helper';
import { mockEnv, resetMockEnv } from '../../helpers/mock-env';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

const mockNumbersService = {
  release: jest.fn(),
};

describe('releaseRentedNumberHandler', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(numbersServiceHelper, 'getNumbersService').mockReturnValue(mockNumbersService as never);
    jest.clearAllMocks();
    resetMockEnv();
    mockEnv.PROJECT_ID = 'test-project';
    mockEnv.KEY_ID = 'test-key-id';
    mockEnv.KEY_SECRET = 'test-secret';
  });

  it('returns a prompt response with released number data', async () => {
    mockNumbersService.release.mockResolvedValue({
      phoneNumber: '+12015555555',
      projectId: 'test-project',
    });

    const result = await releaseRentedNumberHandler({
      phoneNumber: '+12015555555',
    });

    expect(mockNumbersService.release).toHaveBeenCalledWith({
      phoneNumber: '+12015555555',
    });
    expect(result.role).toBe('assistant');
    const expectedResponse = JSON.stringify({
      success: true,
      data: {
        phoneNumber: '+12015555555',
        projectId: 'test-project',
      },
    });
    expect(result.content[0].text).toEqual(expectedResponse);
  });

  it('returns error when release fails', async () => {
    mockNumbersService.release.mockRejectedValue(new Error('Not found'));

    const result = await releaseRentedNumberHandler({
      phoneNumber: '+12015555555',
    });

    const expectedResponse = JSON.stringify({
      success: false,
      error: "Failed to release number '+12015555555': Not found",
    });
    expect(result).toEqual(new PromptResponse(expectedResponse).promptResponse);
  });

  it('returns prompt response when credentials are missing', async () => {
    jest.restoreAllMocks();
    resetMockEnv();

    mockEnv.PROJECT_ID = undefined;
    mockEnv.KEY_ID = undefined;
    mockEnv.KEY_SECRET = undefined;

    const result = await releaseRentedNumberHandler({
      phoneNumber: '+12015555555',
    });

    expect(result.content[0].text).toContain('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
    expect(mockNumbersService.release).not.toHaveBeenCalled();
  });
});
