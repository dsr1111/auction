export type CorrectionValues = {
  bidAmount: number;
  bidQuantity: number;
  bidderNickname: string;
};

export function validateCorrectionValues(values: CorrectionValues): string | null {
  if (!Number.isSafeInteger(values.bidAmount) || values.bidAmount <= 0 ||
      values.bidAmount > 2_000_000_000 || values.bidAmount % 10_000 !== 0) {
    return '입찰 가격은 10,000bit 단위의 20억 이하 정수여야 합니다.';
  }
  if (!Number.isSafeInteger(values.bidQuantity) || values.bidQuantity <= 0 ||
      values.bidQuantity > 2_147_483_647) {
    return '입찰 수량은 1 이상의 정수로 입력해주세요.';
  }
  if (!values.bidderNickname.trim() || values.bidderNickname.trim().length > 100) {
    return '입찰자 닉네임은 1~100자로 입력해주세요.';
  }
  return null;
}
