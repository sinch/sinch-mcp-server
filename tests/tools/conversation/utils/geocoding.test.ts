import axios from 'axios';
import { getLatitudeLongitudeFromAddress } from '../../../../src/tools/conversation/utils/geocoding';
import { logger } from '../../../../src/telemetry/logger';

jest.mock('axios');
jest.mock('../../../../src/telemetry/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

const mockAddress = 'Phare d\'Eckmühl';

const mockSuccessResponse = {
  data: {
    status: 'OK',
    results: [{
      formatted_address: 'Pl. du Maréchal Davout, 29760 Penmarch, France',
      geometry: {
        location: {
          lat: 47.7981899,
          lng: -4.372768499999999
        }
      }
    }]
  }
};

beforeEach(() => {
  process.env.GEOCODING_API_KEY = 'test-api-key';
  jest.clearAllMocks();
});

test('returns coordinates when API responds with OK', async () => {
  mockedAxios.get.mockResolvedValueOnce(mockSuccessResponse);

  const result = await getLatitudeLongitudeFromAddress(mockAddress);

  expect(result).toEqual({
    latitude: 47.7981899,
    longitude: -4.372768499999999,
    formattedAddress: 'Pl. du Maréchal Davout, 29760 Penmarch, France'
  });

  expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('geocode/json'), {
    params: { address: mockAddress, key: 'test-api-key' }
  });
});

test('returns fallback when API status is not OK', async () => {
  mockedAxios.get.mockResolvedValueOnce({ data: { results: [], status: 'ZERO_RESULTS' } });

  const result = await getLatitudeLongitudeFromAddress('nowhere');

  expect(result).toEqual({
    latitude: 0,
    longitude: 0,
    formattedAddress: 'Unknown'
  });

  expect(mockedLogger.error).toHaveBeenCalledWith(
    { status: 'ZERO_RESULTS' },
    'Geocoding failed',
  );
});

test('returns fallback when axios throws', async () => {
  mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

  const result = await getLatitudeLongitudeFromAddress('some address');

  expect(result).toEqual({
    latitude: 0,
    longitude: 0,
    formattedAddress: 'Unknown'
  });

  expect(mockedLogger.error).toHaveBeenCalledWith(
    { err: expect.any(Error) },
    'Geocoding request failed',
  );
});

test('includes GEOCODING_API_KEY in query params', async () => {
  mockedAxios.get.mockResolvedValueOnce(mockSuccessResponse);

  await getLatitudeLongitudeFromAddress(mockAddress);

  expect(mockedAxios.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    params: expect.objectContaining({
      key: 'test-api-key'
    })
  }));
});

test('returns fallback when GEOCODING_API_KEY is not set', async () => {
  delete process.env.GEOCODING_API_KEY;

  const mockError = new Error('API key missing');
  mockedAxios.get.mockRejectedValueOnce(mockError);

  const result = await getLatitudeLongitudeFromAddress(mockAddress);

  expect(result).toEqual({
    latitude: 0,
    longitude: 0,
    formattedAddress: 'Unknown'
  });

  expect(mockedAxios.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    params: expect.objectContaining({
      key: undefined
    })
  }));

  expect(mockedLogger.error).toHaveBeenCalledWith(
    { err: mockError },
    'Geocoding request failed',
  );
});
