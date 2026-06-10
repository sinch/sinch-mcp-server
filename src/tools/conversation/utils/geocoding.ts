import axios from 'axios';
import { logger } from '../../../telemetry/logger';

interface GeocodingAddress {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export const getLatitudeLongitudeFromAddress = async (address: string): Promise<GeocodingAddress> => {
  const fallbackCoordinates: GeocodingAddress = {
    latitude: 0,
    longitude: 0,
    formattedAddress: 'Unknown'
  };
  try {
    const url = 'https://maps.googleapis.com/maps/api/geocode/json';
    const queryParams = {
      address,
      key: process.env.GEOCODING_API_KEY
    };

    const response = await axios.get(url, {
      params: queryParams
    });
    const data = response.data;

    if (data.status === 'OK') {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: data.results[0].formatted_address
      };
    } else {
      logger.error({ status: data.status }, 'Geocoding failed');
      return fallbackCoordinates;
    }
  } catch (error) {
    logger.error({ err: error }, 'Geocoding request failed');
    return fallbackCoordinates;
  }
};
