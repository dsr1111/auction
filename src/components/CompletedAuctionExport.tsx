"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import ExcelJS from 'exceljs';

type CompletedAuctionItem = {
  id: number;
  name: string; // base_equipment_name 대신 name
  price: string; // number 대신 string
  current_bid: string; // number | null 대신 string
  end_time: string;
  created_at: string;
  last_bidder_nickname?: string; // 추가
  quantity?: number; // 추가
  remaining_quantity?: number; // 추가
  bid_history: Array<{
    id: number;
    bid_amount: number;
    bid_quantity: number;
    bidder_nickname: string;
    bidder_discord_id: string | null;
    bidder_discord_name: string | null;
    created_at: string;
  }>;
  winning_bids: Array<{ // 낙찰 정보 추가
    id: number;
    bid_amount: number;
    bid_quantity: number;
    bidder_nickname: string;
    bidder_discord_id: string | null;
    bidder_discord_name: string | null;
    created_at: string;
    quantity_used: number; // 실제 사용된 수량
  }>;
};

const CompletedAuctionExport = () => {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 관리자 권한 확인
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  if (!isAdmin) {
    return null; // 관리자가 아니면 컴포넌트를 렌더링하지 않음
  }

  const exportToExcel = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('엑셀 다운로드 시작');
      
      // 마감된 아이템 정보 가져오기
      const response = await fetch('/api/auction/completed');
      console.log('API 응답:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 에러 응답:', errorText);
        throw new Error(`마감된 아이템 정보를 가져오는데 실패했습니다. (${response.status}: ${response.statusText})`);
      }

      const responseData = await response.json();
      console.log('API 응답 데이터:', responseData);
      
      const { data: completedItems, message, sourceTable } = responseData;

      if (!completedItems || completedItems.length === 0) {
        alert(message || '마감된 아이템이 없습니다.');
        return;
      }

      console.log(`${completedItems.length}개의 아이템을 엑셀로 변환 중... (테이블: ${sourceTable})`);

      // 1) 낙찰자별 그룹화 준비
      type RowByBidder = {
        bidderNickname: string;
        bidderDiscordName: string;
        itemName: string;
        quantity: number;
        unitWithFee: number;
        totalWithFee: number;
        totalWithoutFee: number;
      };

      const bidderToRows = new Map<string, RowByBidder[]>();
      const bidderToTotalWithFee = new Map<string, number>();
      const bidderToTotalWithoutFee = new Map<string, number>();

      completedItems.forEach((item: CompletedAuctionItem) => {
        if (!item.winning_bids || item.winning_bids.length === 0) {
          return; // 낙찰자별 보기에서는 낙찰 없는 아이템은 제외
        }
        item.winning_bids.forEach((wb) => {
          const unitWithFee = Math.round(wb.bid_amount * 1.1);
          const totalWithFee = unitWithFee * wb.quantity_used;
          const totalWithoutFee = wb.bid_amount * wb.quantity_used;
          const bidderNickname = wb.bidder_nickname || '';
          const bidderDiscordName = wb.bidder_discord_name || '';
          const key = `${bidderNickname}||${bidderDiscordName}`;

          const list = bidderToRows.get(key) || [];
          list.push({
            bidderNickname,
            bidderDiscordName,
            itemName: item.name,
            quantity: wb.quantity_used,
            unitWithFee,
            totalWithFee,
            totalWithoutFee,
          });
          bidderToRows.set(key, list);
          bidderToTotalWithFee.set(key, (bidderToTotalWithFee.get(key) || 0) + totalWithFee);
          bidderToTotalWithoutFee.set(key, (bidderToTotalWithoutFee.get(key) || 0) + totalWithoutFee);
        });
      });

      // 2) 낙찰자 이름으로 정렬, 각 낙찰자 블록별로 표 생성 + 소계
      const sortedKeys = Array.from(bidderToRows.keys()).sort((a, b) => {
        const [aName] = a.split('||');
        const [bName] = b.split('||');
        return aName.localeCompare(bName, 'ko');
      });

      const excelData: Array<{
        '입찰자': string;
        '아이템명': string;
        '갯수': number | string;
        '개당 입찰가(10%포함)': string;
        '총 입찰가(10%포함)': string;
        '총 입찰가(수수료 제외)': string;
      }> = [];
      const bidderBlocks: Array<{ startIndex: number; itemCount: number }> = [];

      let grandTotalWithFee = 0;
      let grandTotalWithoutFee = 0;

      sortedKeys.forEach((key) => {
        const [bidderNickname, bidderDiscordName] = key.split('||');
        const rows = bidderToRows.get(key) || [];
        const subtotalWithFee = bidderToTotalWithFee.get(key) || 0;
        const subtotalWithoutFee = bidderToTotalWithoutFee.get(key) || 0;
        grandTotalWithFee += subtotalWithFee;
        grandTotalWithoutFee += subtotalWithoutFee;

        // 아이템 행 (아이템명, 수량, 단가, 총액) 추가
        const bidderDisplay = bidderDiscordName ? `${bidderNickname} (${bidderDiscordName})` : bidderNickname;
        const startIndex = excelData.length; // 현재 낙찰자 블록 시작 인덱스
        let itemCount = 0;
        rows
          .sort((r1, r2) => r1.itemName.localeCompare(r2.itemName, 'ko'))
          .forEach((r, idx) => {
            itemCount += 1;
            excelData.push({
              '입찰자': idx === 0 ? bidderDisplay : '',
              '아이템명': r.itemName,
              '갯수': r.quantity,
              '개당 입찰가(10%포함)': r.unitWithFee.toLocaleString(),
              '총 입찰가(10%포함)': r.totalWithFee.toLocaleString(),
              '총 입찰가(수수료 제외)': r.totalWithoutFee.toLocaleString(),
            });
          });

        // 낙찰자 블록 메타 저장 (물품 행 수 만큼 병합용)
        bidderBlocks.push({ startIndex, itemCount });

        // 소계 행 (아이템 목록 아래쪽)
        excelData.push({
          '입찰자': '',
          '아이템명': '합계',
          '갯수': '',
          '개당 입찰가(10%포함)': '',
          '총 입찰가(10%포함)': subtotalWithFee.toLocaleString(),
          '총 입찰가(수수료 제외)': subtotalWithoutFee.toLocaleString(),
        });

        // 낙찰자 블록 구분 빈 줄
        excelData.push({
          '입찰자': '',
          '아이템명': '',
          '갯수': '',
          '개당 입찰가(10%포함)': '',
          '총 입찰가(10%포함)': '',
          '총 입찰가(수수료 제외)': '',
        });
      });

      // 마지막 빈 줄 제거
      if (excelData.length > 0) {
        excelData.pop();
      }

      // 3) 전체 합계 행 추가
      excelData.push({
        '입찰자': '',
        '아이템명': '전체 합계',
        '갯수': '',
        '개당 입찰가(10%포함)': '',
        '총 입찰가(10%포함)': grandTotalWithFee.toLocaleString(),
        '총 입찰가(수수료 제외)': grandTotalWithoutFee.toLocaleString(),
      });

      console.log('엑셀 데이터 준비 완료(행 수):', excelData.length);

      // 워크북/워크시트 생성 (exceljs)
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('낙찰자별 내역');

      // 컬럼 정의
      worksheet.columns = [
        { header: '입찰자', key: 'bidder', width: 28 },
        { header: '아이템명', key: 'item', width: 28 },
        { header: '갯수', key: 'qty', width: 10 },
        { header: '개당 입찰가(10%포함)', key: 'unitWithFee', width: 18 },
        { header: '총 입찰가(10%포함)', key: 'totalWithFee', width: 18 },
        { header: '총 입찰가(수수료 제외)', key: 'totalWithoutFee', width: 20 },
      ];

      // 헤더 스타일
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // 데이터 입력 + 기본 테두리/정렬
      excelData.forEach((r) => {
        const row = worksheet.addRow({
          bidder: r['입찰자'],
          item: r['아이템명'],
          qty: r['갯수'],
          unitWithFee: r['개당 입찰가(10%포함)'],
          totalWithFee: r['총 입찰가(10%포함)'],
          totalWithoutFee: r['총 입찰가(수수료 제외)'],
        });
        row.eachCell((cell) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

      // 입찰자 셀 병합 (물품 행 수만큼)
      const dataStartRow = 2; // 헤더 다음부터 데이터 시작
      bidderBlocks.forEach(({ startIndex, itemCount }) => {
        if (itemCount <= 0) return;
        const startRow = dataStartRow + startIndex;
        // 합계 행까지 포함하여 병합 (아이템 행 수 + 1)
        const endRow = startRow + itemCount; 
        if (endRow > startRow) {
          worksheet.mergeCells(startRow, 1, endRow, 1);
        }
      });

      // 소계/전체 합계 강조 (행 내용 기준으로 처리)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const itemCell = row.getCell(2); // 아이템명
        const value = String(itemCell.value ?? '');
        const isSubtotal = value === '합계';
        const isGrandTotal = value === '전체 합계';
        if (!isSubtotal && !isGrandTotal) return;
        const fillColor = isGrandTotal ? 'FFF9D966' : 'FFE7E6E6';
        row.eachCell((cell) => {
          cell.font = { ...(cell.font || {}), bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
      });

      // 파일명 생성 (현재 날짜 포함)
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const fileName = `낙찰내역_${dateStr}.xlsx`;

      console.log('엑셀 파일 다운로드 시작:', fileName);

      // 브라우저에서 파일 저장
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('엑셀 다운로드 완료');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error('엑셀 다운로드 에러:', err);
      setError(errorMessage);
      alert(`엑셀 다운로드에 실패했습니다: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-blue-800 font-medium">낙찰 내역 다운로드</span>
        </div>
        <button
          onClick={exportToExcel}
          disabled={isLoading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-full transition-colors duration-200 flex items-center space-x-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>처리 중...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>엑셀 다운로드</span>
            </>
          )}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default CompletedAuctionExport;
