import 'server-only';

/**
 * 정정 신청을 보고 처리(승인·삭제)할 수 있는 사람인지 확인합니다.
 * - 환경변수 CORRECTION_APPROVER_IDS (디스코드 사용자 ID, 쉼표로 구분)에 있는 사람만 가능
 * - 환경변수가 비어 있으면 예전처럼 관리자 전원 (로컬 개발 등)
 */
export function isCorrectionApprover(userId: string | null | undefined, isAdmin: boolean | undefined): boolean {
  const ids = (process.env.CORRECTION_APPROVER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0) return isAdmin === true;
  return !!userId && ids.includes(userId);
}
