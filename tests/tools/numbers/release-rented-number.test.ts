import { releaseRentedNumberHandler } from '../../../src/tools/numbers/release-rented-number';
import { PromptResponse } from '../../../src/types';
import { getNumbersService } from '../../../src/tools/numbers/utils/numbers-service-helper';

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

jest.mock('../../../src/tools/numbers/utils/numbers-service-helper');

const mockNumbersService = {
  release: jest.fn(),
};
(getNumbersService as jest.Mock).mockReturnValue(mockNumbersService);

describe('releaseRentedNumberHandler', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.PROJECT_ID = 'test-project';
    process.env.KEY_ID = 'test-key-id';
    process.env.KEY_SECRET = 'test-secret';
    (getNumbersService as jest.Mock).mockReturnValue(mockNumbersService);
  });

  afterAll(() => {
    process.env = OLD_ENV;
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
    (getNumbersService as jest.Mock).mockReturnValue(
      new PromptResponse(
        JSON.stringify({
          success: false,
          error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.',
        })
      )
    );

    const result = await releaseRentedNumberHandler({
      phoneNumber: '+12015555555',
    });

    const expectedResponse = JSON.stringify({
      success: false,
      error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.',
    });
    expect(result).toEqual(new PromptResponse(expectedResponse).promptResponse);
    expect(mockNumbersService.release).not.toHaveBeenCalled();
  });
});
