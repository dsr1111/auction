// WebSocket 메시지 전송 유틸리티
export const sendWebSocketMessage = (message: any) => {
  return new Promise<void>((resolve, reject) => {
    try {
      const ws = new WebSocket('ws://localhost:3001');
      
      ws.onopen = () => {
        console.log('📤 WebSocket 메시지 전송 중:', message);
        ws.send(JSON.stringify(message));
        ws.close();
        resolve();
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket 메시지 전송 실패:', error);
        reject(error);
      };
      
      // 5초 타임아웃
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          reject(new Error('WebSocket 연결 타임아웃'));
        }
      }, 5000);
      
    } catch (error) {
      console.error('❌ WebSocket 연결 실패:', error);
      reject(error);
    }
  });
};

// 아이템 업데이트 알림 전송
export const notifyItemUpdate = (action: 'bid' | 'added' | 'deleted', itemId?: number) => {
  return sendWebSocketMessage({
    type: 'item_updated',
    action,
    itemId,
    timestamp: Date.now()
  });
};
