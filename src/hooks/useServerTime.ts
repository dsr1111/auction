import { useState, useEffect, useCallback } from 'react';

interface ServerTimeResponse {
  serverTime: string;
  timestamp: number;
}

export const useServerTime = () => {
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  const syncServerTime = useCallback(async () => {
    try {
      const response = await fetch('/api/time');
      if (!response.ok) {
        throw new Error('Failed to fetch server time');
      }
      
      const data: ServerTimeResponse = await response.json();
      const clientTime = Date.now();
      const serverTime = new Date(data.serverTime).getTime();
      
      // 서버 시간과 클라이언트 시간의 차이를 계산
      const offset = serverTime - clientTime;
      setServerTimeOffset(offset);
      setLastSyncTime(clientTime);
      setIsInitialized(true);
      
      return offset;
    } catch (error) {
      console.error('Failed to sync server time:', error);
      // 실패 시 클라이언트 시간 사용
      setServerTimeOffset(0);
      setIsInitialized(true);
      return 0;
    }
  }, []);

  const getCurrentServerTime = useCallback(() => {
    if (!isInitialized) {
      return new Date();
    }
    return new Date(Date.now() + serverTimeOffset);
  }, [isInitialized, serverTimeOffset]);

  const getTimeUntil = useCallback((targetTime: string | Date) => {
    if (!isInitialized) {
      return null;
    }
    
    const now = getCurrentServerTime().getTime();
    const target = new Date(targetTime).getTime();
    return target - now;
  }, [isInitialized, getCurrentServerTime]);

  // 초기 동기화
  useEffect(() => {
    syncServerTime();
  }, [syncServerTime]);

  // 정기적인 동기화 (5분마다)
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSinceLastSync = Date.now() - lastSyncTime;
      if (timeSinceLastSync > 5 * 60 * 1000) { // 5분
        syncServerTime();
      }
    }, 60000); // 1분마다 체크

    return () => clearInterval(interval);
  }, [syncServerTime, lastSyncTime]);

  return {
    getCurrentServerTime,
    getTimeUntil,
    isInitialized,
    syncServerTime
  };
};





