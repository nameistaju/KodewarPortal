const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export const calculateDistanceMeters = (pointA, pointB) => {
  const lat1 = toRadians(pointA.latitude);
  const lat2 = toRadians(pointB.latitude);
  const deltaLat = toRadians(pointB.latitude - pointA.latitude);
  const deltaLng = toRadians(pointB.longitude - pointA.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
};

export const isInsideRadius = (employeeLocation, officeLocation, allowedRadiusMeters) => {
  const distanceFromOfficeMeters = calculateDistanceMeters(employeeLocation, officeLocation);

  return {
    isInside: distanceFromOfficeMeters <= allowedRadiusMeters,
    distanceFromOfficeMeters
  };
};
