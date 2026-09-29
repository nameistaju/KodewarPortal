import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { unwrap } from '../api/helpers';
import { calculateHaversineDistance } from '../utils/location';

const EmployeeTrackingContext = createContext(null);

export const EmployeeTrackingProvider = ({ enabled, children }) => {
  const [coords, setCoords] = useState(null);
  const [loadingCoords, setLoadingCoords] = useState(Boolean(enabled));
  const [gpsError, setGpsError] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [officeLocation, setOfficeLocation] = useState(null);
  const [officeError, setOfficeError] = useState(null);

  const refreshAttendance = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await api.get('/attendance/status');
      setAttendance(unwrap(response)?.status?.attendance || null);
    } catch {
      // Ignore background status refresh error
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    api.get('/attendance/settings')
      .then((response) => {
        setOfficeLocation(unwrap(response)?.setting || null);
        setOfficeError(null);
      })
      .catch(() => {
        setOfficeLocation(null);
        setOfficeError('Office location settings are unavailable');
      });
    refreshAttendance();

    const handleAttendanceChanged = (event) => {
      if (event.detail?.attendance) setAttendance(event.detail.attendance);
      else refreshAttendance();
    };
    window.addEventListener('attendance:changed', handleAttendanceChanged);
    return () => {
      window.removeEventListener('attendance:changed', handleAttendanceChanged);
    };
  }, [enabled, refreshAttendance]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!navigator.geolocation) {
      setGpsError('GPS unavailable');
      setLoadingCoords(false);
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setLoadingCoords(false);
        setGpsError(null);
      },
      (error) => {
        setLoadingCoords(false);
        const message = error.code === error.PERMISSION_DENIED ? 'GPS permission denied' : 'GPS unavailable';
        setGpsError(message);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  const distance = coords && officeLocation
    ? calculateHaversineDistance(coords.latitude, coords.longitude, officeLocation.officeLatitude, officeLocation.officeLongitude)
    : null;

  return (
    <EmployeeTrackingContext.Provider value={{
      coords,
      accuracy: coords?.accuracy ?? null,
      loadingCoords,
      gpsError,
      distance,
      isInside: distance !== null && distance <= (officeLocation?.allowedRadiusMeters || 100),
      officeRadius: officeLocation?.allowedRadiusMeters ?? 100,
      officeError,
      attendance,
      refreshAttendance
    }}>
      {children}
    </EmployeeTrackingContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useEmployeeTracking = () => {
  const value = useContext(EmployeeTrackingContext);
  if (!value) throw new Error('useEmployeeTracking must be used inside EmployeeTrackingProvider');
  return value;
};
