export const calculateHaversineDistance = (latitude1, longitude1, latitude2, longitude2) => {
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(latitude2 - latitude1);
  const deltaLongitude = toRadians(longitude2 - longitude1);
  const value = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2)) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};
