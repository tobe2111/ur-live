/**
 * 사용자 탈퇴 서비스
 * 
 * 탈퇴 시 처리:
 * 1. Firebase Authentication 사용자 삭제
 * 2. 데이터베이스의 모든 사용자 데이터 삭제
 * 3. 관련 주문/결제/리뷰 등 익명화 처리
 * 4. 탈퇴 기록 저장 (30일간 재가입 제한)
 */

export interface DeleteAccountRequest {
  userId: string;
  reason?: string; // 선택적: 탈퇴 사유
}

export interface DeleteAccountResponse {
  success: boolean;
  message: string;
  deletedAt: string;
}

/**
 * 사용자 계정 탈퇴 처리
 */
export async function deleteUserAccount(
  request: DeleteAccountRequest
): Promise<DeleteAccountResponse> {
  const { userId } = request;

  try {
    console.log('[DeleteAccount] 탈퇴 처리 시작:', userId);

    // TODO: 실제 구현 시 아래 로직 추가
    // 1. Firebase Admin SDK로 사용자 삭제
    // await admin.auth().deleteUser(userId);

    // 2. 데이터베이스에서 사용자 데이터 삭제 또는 익명화
    // await db.delete(users).where(eq(users.id, userId));

    // 3. 관련 데이터 처리
    // - 주문 내역: 익명화 (user_id = 'deleted_user')
    // - 리뷰: 익명화 또는 삭제
    // - 찜목록/장바구니: 삭제
    // - 포인트/쿠폰: 삭제

    // 4. 탈퇴 기록 저장 (30일간 재가입 제한용)
    // await db.insert(deletedAccounts).values({
    //   userId,
    //   email: user.email,
    //   deletedAt: new Date(),
    //   reregisterAvailableAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    // });

    // 임시: 3초 딜레이로 실제 처리하는 것처럼 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const deletedAt = new Date().toISOString();

    console.log('[DeleteAccount] 탈퇴 처리 완료:', userId, deletedAt);

    return {
      success: true,
      message: '회원 탈퇴가 완료되었습니다.',
      deletedAt,
    };
  } catch (error) {
    console.error('[DeleteAccount] 탈퇴 처리 실패:', error);
    throw new Error('회원 탈퇴 처리 중 오류가 발생했습니다.');
  }
}

/**
 * 재가입 제한 확인
 */
export async function checkReregistrationRestriction(
  email: string
): Promise<{ restricted: boolean; availableAt?: string }> {
  // TODO: 실제 구현 시 데이터베이스에서 확인
  // const deletedAccount = await db
  //   .select()
  //   .from(deletedAccounts)
  //   .where(eq(deletedAccounts.email, email))
  //   .limit(1);

  // if (deletedAccount.length > 0) {
  //   const availableAt = deletedAccount[0].reregisterAvailableAt;
  //   if (new Date() < new Date(availableAt)) {
  //     return {
  //       restricted: true,
  //       availableAt: availableAt.toISOString(),
  //     };
  //   }
  // }

  return {
    restricted: false,
  };
}
