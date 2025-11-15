# 테스트 가이드

## 테스트 구조

### 단위 테스트 (Unit Tests)
- `StorageCreditPool.test.ts`: StorageCreditPool 컨트랙트의 개별 함수 테스트
- `PaymentContract.test.ts`: PaymentContract 컨트랙트의 개별 함수 테스트

### 통합 테스트 (Integration Tests)
- `integration.test.ts`: 전체 시나리오 기반 테스트

## 테스트 실행

### 모든 테스트 실행
```bash
npm test
```

### 단위 테스트만 실행
```bash
npm run test:unit
```

### 통합 테스트만 실행
```bash
npm run test:integration
```

### 커버리지 확인
```bash
npm run test:coverage
```

## 테스트 케이스

### StorageCreditPool 테스트
- ✅ 초기화 테스트 (성공/실패)
- ✅ deposit (충전) 테스트 (성공/실패)
- ✅ withdraw (인출) 테스트 (성공/실패)
- ✅ deductCredit (서버 차감) 테스트 (성공/실패)
- ✅ setPaymentToken (토큰 변경) 테스트 (성공/실패)
- ✅ 잔액 조회 테스트

### PaymentContract 테스트
- ✅ 초기화 테스트 (성공/실패)
- ✅ payDirect (직접 결제) 테스트 (성공/실패)
- ✅ payWithSignature (EIP-712 서명 결제) 테스트
  - ✅ 정상 결제
  - ❌ 만료된 타임스탬프
  - ❌ 잘못된 서명
  - ❌ 리플레이 공격 방지
- ✅ nonce 관리 테스트
- ✅ 해시 계산 테스트

### 통합 테스트 시나리오
1. **크레딧 충전 -> 크레딧 기반 다운로드 결제**
   - 크레딧 충전 → 크레딧 차감 → 잔액 확인
   - 여러 번 다운로드 시나리오
   - 크레딧 부족 시 실패 처리

2. **x402 프로토콜 - EIP-712 서명 기반 결제**
   - 전체 x402 결제 플로우
   - 여러 파일 결제
   - 리플레이 공격 방지

3. **하이브리드 결제 시스템**
   - 크레딧 → x402 전환
   - 크레딧 충전 → 사용 → 추가 충전

4. **보관료 자동 차감 시뮬레이션**
   - 여러 날 보관료 차감
   - 잔액 고갈 시 파일 잠금

5. **에러 핸들링 및 엣지 케이스**
   - 동시 사용자 처리
   - 정확한 금액 계산

