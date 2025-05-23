import axios from 'axios';

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

    console.error(JSON.stringify(queryParams, null, 2));

    const response = await axios.get(url, {
      params: queryParams
    });
    const data = response.data;

    console.log(JSON.stringify(data, null, 2));

    if (data.status === 'OK') {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: data.results[0].formatted_address
      };
    } else {
      console.error('Geocoding failed:', data.status, data.error_message);
      return fallbackCoordinates;
    }
  } catch (error) {
    console.error('Request failed:', error);
    return fallbackCoordinates;
  }
};
