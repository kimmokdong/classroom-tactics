# Classroom Tactics Refactor Progress

## Current Phase
- Phase: 10단계 콘텐츠 추가
- Status: 완료
- Next required model: 없음
- Next required reasoning: Medium

## Baseline
- Current test command: `npm.cmd test`
- Current build command: `npm.cmd run build`
- Current lint command: 없음 (`node --check`로 문법 검사)
- Existing failures: npm 감사 결과 high severity 취약점 1건, 기존 `scripts/test_items.mjs`는 실패를 종료 코드로 전달하지 않음
- Reproduction steps: `npm.cmd test`, `node scripts/test_items.mjs`, `npm.cmd run build`, `npm.cmd run simulate:balance`

## Completed Work

### 9-3단계 결과 해석 및 밸런스 조정
- 처형 9,999 피해 로그와 증강체별 비대응 난수 시드가 이상치 집계를 오염시킨 원인을 수정했다.
- 설명에 없는 과거 p12 초과회복 피해 코드를 삭제하고, 조건 미충족 무효 회귀 테스트를 추가했다.
- 체육·육상·과학·보건부의 급격한 단계 수치만 최소 조정하고 설명 수치를 함께 갱신했다.
- 최종 5,400전과 증강체 동일시드 1,440전을 실패 0건으로 완료했다.
- 상세 근거와 남은 위험을 `reports/balance/9-3-report.md`에 기록했다.

### 10단계 콘텐츠 추가
- 기존 증강체 계약과 `grant` 효과를 재사용한 silver 증강체 `s12 자율학습 간식`을 추가했다.
- 신규 콘텐츠 설명·효과·직렬화는 기존 `AUGMENTS` 데이터에서 함께 생성된다.
- 41개 증강체 계약 테스트, 빌드, 36전 축소 시뮬레이션을 통과했다.
- 최종 보고서를 `docs/classroom-tactics-final-report.md`에 기록했다.

### Phase 9-2 Balance Simulation Execution
- Ran 10,800 baseline battles across 20 deterministic seeds with zero failed battle cases.
- Ran 2,880 augment control battles across 20 deterministic seeds with zero failed battle cases.
- Recorded unit, composition, synergy, augment, stage-growth, and AI audit outliers in `reports/balance/9-2-report.md`.
- Recorded empty failed-seed lists and the separate 200-seed command timeout in `reports/balance/9-2-failed-seeds.json`.
### 1단계 P0 전투 엔진 버그
- 동시 전멸을 무승부로 판정
- 비정상 공속의 공격 쿨다운 정규화
- 방어 관통을 0~90%로 제한하고 육상부 누적값을 동일 규칙으로 처리
- 외톨이의 후드티 방어 보너스를 매 틱 누적하지 않고 재계산
- 골드 0을 50으로 치환하던 전투 엔진 인자 수정
- 전투 중 재시작을 공통 진입점에서 차단
- 기부 천사 임시 아이템 로직을 `SynergyManager` 한 곳으로 통합
- 시드 난수로 동일 입력 전투 로그 재현
- 렌더러 `stop()`에서 인터벌·프레임·종료 타이머·리스너 정리
- JSON import attribute를 추가해 Node 테스트와 Vite 빌드를 함께 지원

### 2단계 증강체 계약과 이벤트 구조
- 40개 증강체 전부에 희귀도, 발동 이벤트, 대상, 조건, 지속시간, 중첩 정책, 제거 정책, 직렬화 방식, 효과 데이터, UI 설명을 포함한 공통 계약 적용
- 증강체 ID별 `if` 체인을 효과 유형 기반 단일 실행 경로로 교체
- 앱별 `EventBus` 인스턴스로 전투 종료·라운드 시작 이벤트를 연결하고 구독 해제 지원
- 중복 획득을 적용 경로에서도 차단하고 지속 효과 제거 시 수치 복구
- 증강체 저장 형식을 ID 목록으로 고정하고 계약 데이터로 복원하는 함수 추가
- 설명과 효과가 달랐던 `s6`, `s10`, `s11`, `g4`, `g7`, `p1`, `p3`, `p4`, `p9`를 설명 기준으로 일치시킴
- `p4`의 라운드별 무료 새로고침 3회를 별도 카운터로 실제 구현
- `s10`의 승리 시 1/2코스트 70:30 확정 지급을 전투 종료 이벤트로 구현

### 3단계 핵심 회귀 테스트
- 상점 구매를 `ShopManager.buyUnit()`으로 분리해 DOM 없이 골드·상점·대기석의 원자적 갱신을 테스트
- 일반/무료 새로고침 비용과 레벨별 등장 확률표 검증
- 배치 인원 제한, 판매 환불·아이템 반환, 3개 합성의 장비·영구 성장치 처리 검증
- 전투 인스턴스가 입력 유닛의 중첩 상태를 공유하지 않도록 생성자에서 깊은 복제 적용
- 대상 사망 뒤 재탐색, 상태 이상 지속시간 만료, 기존 시드 재현성 검증
- 렌더링 애니메이션 없이 전투 종료 콜백을 대체해 승리·패배·게임 오버·보상·다음 라운드·상점 잠금 해제를 검증

### 4단계 저장 및 보상 소실 수정
- 버전 2 저장 봉투에 `runId`, `runSeed`, 저장 시각, 현재 단계, 보상 거래 ID 기록
- 5초 자동 저장, 브라우저 종료 전 저장, 상단 수동 저장 버튼 제공
- 복원 시 시작 아이템·상점·공용 풀의 중복 초기화 방지
- 전투 종료·증강체 선택·매점 보상을 실행 ID와 단계 기반 거래 ID로 한 번만 적용
- 미완료 거래는 적용 전 상태로 복구하고 완료 저장 실패 시 메모리 상태도 롤백
- 증강체를 ID로 저장하고 현재 계약 데이터로 복원
- 구버전 상태를 현재 기본값과 병합하고 부분 손상 필드는 기본값으로 복구
- 파싱 불가능하거나 미래 버전인 저장은 제거하고 새 게임으로 안전하게 시작
- 임시 전투 객체·버프·DPS 통계를 저장 대상에서 제외
- 만석으로 받지 못한 아이템·유닛은 `pendingRewards`에 보관 후 빈칸 발생 시 자동 적용
- 저장된 게임 오버 상태를 복원하고 새 게임 선택 시 저장 데이터 제거

### 5단계 보드 전투력 평가기
- 조절 가능한 `DEFAULT_BOARD_EVALUATION_WEIGHTS`와 순수 함수 `evaluateBoard()` 추가
- 유닛 스탯·가격, 별 등급, 실제 활성 시너지 효과, 역할 균형, 아이템 적합도, 앞·뒷줄 배치, 군중 제어·유틸리티, 합성 가능성, 전환 비용을 분리 점수화
- 탱커·딜러 부재, 비활성 시너지 기물, 역할 과잉 중복을 감점
- 2성 4코스트가 1성 5코스트보다 높을 수 있도록 가격 일변도 평가 방지
- 디버그 모드에서 유닛별·시너지별 세부 근거와 전체 점수 구성을 반환
- 플레이어·적 보드 방향에 맞춰 `frontRow`를 지정할 수 있게 함
- 기존 시너지 집계와 활성 단계 판정을 순수 함수로 추출해 게임·AI·시뮬레이터가 공유
- exact-match 시너지의 숫자/문자 키 불일치 수정
- 대표 5개 덱, 10개 매치업, 총 120전 비교 스크립트 추가
- 평가 점수 차이와 실제 승률의 피어슨 상관계수 `0.654` 확인

### 6단계 상대 덱 구성·성장 AI
- 약한 2명·보통 3명·강한 2명으로 구성된 7인 가상 로비와 리롤·템포·표준·빠른 레벨업 성향 추가
- 스테이지 완성 덱 JSON 로드를 제거하고, 6개 조합의 오프너·초반·중반·전환·최종 후보군을 실제 유닛 데이터에서 구성
- 상대마다 레벨·경험치·골드·체력·연승/연패·보드·대기석·아이템·상점 시드·조합 전환 상태를 영속화
- 레벨별 상점 확률을 사용해 유닛을 획득하고 구매·페어 보유·3개 합성·판매·이자·레벨업·리롤을 실제 골드 범위에서 처리
- 리롤형은 저코스트 핵심 기물을 우선 탐색하고 레벨을 늦추며, 빠른 레벨업형은 이자를 보존해 고레벨 상점을 먼저 여는 차이를 구현
- 핵심 기물이 부족하면 대체 시너지 기물을 보유하고, 보유 기물 적합도와 `pivotSkill`에 따라 지정된 대안 조합으로 전환
- 기존 `evaluateBoard()`를 재사용한 폭 8·깊이 2 빔 탐색으로 현재 보드/대기석의 추가·교체 후보를 비교
- `economySkill`·`pivotSkill`·`positioningSkill`·`riskTolerance`에 따라 아이템 오배치, 전환 지연, 지출 타이밍 차이를 제한적으로 허용
- 동일 실행 시드와 상대별 상점 커서로 성장 과정과 매칭 순서를 재현하고 최근 2명과 즉시 재대전하지 않게 함
- 플레이어 덱은 읽지 않고, 1라운드 지연된 최근 3전 결과만 최대 ±5%로 목표 강도에 반영
- 상대 이름·레벨·운영 성향을 기존 적 시너지 HUD에 노출
- 저장 버전을 3으로 올리고 가상 로비·상점 커서·전환 상태·최근 전투 결과를 검증 후 복원
- 대표 시드 기준 평균 전투력이 1라운드 `34.2` → 7라운드 `217.9` → 13라운드 `333.7` → 19라운드 `442.4` → 25라운드 `583.1` → 31라운드 `712.6`으로 성장함을 확인

### 7단계 AI 회귀 테스트
- `scripts/audit_opponent_ai.mjs`에 기본 200시드 감사 명령을 추가하고 `AI_SEEDS`, `AI_SEED`로 표본 수·실패 시드 재실행을 지원
- 동일 시드, 골드/보드/대기석 규칙, 유닛 ID·별 등급·유닛 인스턴스, 최근 상대 반복, 강도 분포, 운영 성향 차이를 매 라운드 검사
- 레벨별 4,000개 상점 슬롯 표본으로 등장 확률표를 검증하고 평균 전투력 단계 범위·라운드별 급상승·조합 전환을 감시
- 장비 재배치 후보에서 같은 완성 아이템을 이미 보유한 유닛을 제외해 중복 장착을 차단
- 50시드×31라운드 감사에서 실패 0: 평균 전투력 `35.1 → 683.3`, 평균 레벨 `1.0 → 8.36`

### 8단계 반응형 및 접근성
- 1200px·900px·560px 이하 레이아웃을 추가해 패널을 세로 재배치하고, 보드·대기석·상점은 각 전용 가로 스크롤 영역에서만 확장
- 키보드 포커스 링, 터치 최적화, `prefers-reduced-motion` 애니메이션 축소 규칙, 적 정보 라이브 영역을 추가
- 주요 모달에 `role="dialog"`, `aria-modal`, 제목 연결을 적용하고 전투 결과 모달의 초기 포커스·Tab 순환·Escape 닫힘·기존 포커스 복귀를 구현
- 실제 Chromium에서 1440×900, 900×820, 390×844를 확인했으며 문서 가로 오버플로는 모두 0

### 9-1단계 밸런스 시뮬레이션 설계
- 실제 `BattleEngine` 로그를 사용하는 `scripts/run_balance_experiment.mjs` 자동 전투 실행기 추가
- 6개 조합, 성장 3단계, 별 등급 통제군 3개, 배치 3종, 좌우 진영 교대, 기준 시드·반복 수·증강체 실험군을 조합하는 실험 행렬 정의
- 유닛별 가한/받은 피해, 회복, 생존 틱, 스킬 횟수, 가격 대비 기여도와 별 등급 효율 수집
- 조합·스테이지, 시너지·단계, 증강체, 아이템, 매치업, 약/보통/강 상대, 성장 곡선과 전투 시간·첫 사망 분포 집계
- 피해 로그의 누락된 공격자 식별자를 전투 엔진과 스킬 엔진에서 보완하고 시작 위치 스냅샷으로 이동 로그를 재생해 540전 미귀속 피해 0 확인
- 결과를 `reports/balance/balance-latest.json`과 `balance-latest.csv`로 저장
- 동일 전체 명령을 재실행해 JSON SHA-256이 일치함을 확인
- `BALANCE_REPETITIONS`, `BALANCE_SEED`, `BALANCE_COMPS`, `BALANCE_AUGMENTS`, `BALANCE_OUTPUT_DIR`로 9-2 대량 실험 범위를 제어
- 실험 구조·명령·집계 스키마·해석 원칙을 `docs/balance-simulation-design.md`에 기록

## Changed Files
- `docs/classroom-tactics-refactor-progress.md`
- `docs/balance-simulation-design.md`
- `index.html`
- `package.json`
- `package-lock.json`
- `js/battleEngine.js`
- `js/battle/SkillEngine.js`
- `js/battleRenderer.js`
- `js/ui/ModalManager.js`
- `js/ai/BoardEvaluator.js`
- `js/core/EventBus.js`
- `js/core/GameState.js`
- `js/data.js`
- `js/enemyAi.js`
- `js/main.js`
- `js/systems/AugmentManager.js`
- `js/systems/ItemManager.js`
- `js/systems/SaveManager.js`
- `js/systems/ShopManager.js`
- `js/systems/StageManager.js`
- `js/systems/SynergyManager.js`
- `js/systems/UnitManager.js`
- `scripts/evaluate_board_correlation.mjs`
- `scripts/audit_opponent_ai.mjs`
- `scripts/run_balance_experiment.mjs`
- `reports/balance/balance-latest.json`
- `reports/balance/balance-latest.csv`
- `style.css`
- `test/augment-contract.test.mjs`
- `test/balance-experiment.test.mjs`
- `test/board-evaluator.test.mjs`
- `test/core-regression.test.mjs`
- `test/opponent-growth.test.mjs`
- `test/p0-battle-regression.test.mjs`
- `test/save-recovery.test.mjs`

## Tests and Results
- `npm.cmd test`: 38개 통과, 실패 0
- `npm.cmd run evaluate:boards`: 120전 완료, 상관계수 0.654
- `node scripts/test_items.mjs`: 기존 5개 통과
- 전체 `js/**/*.js` `node --check`: 통과
- `npm.cmd run build`: Vite 8.0.14 성공
- 대표 31라운드 성장 시뮬레이션: 평균 레벨 `1.0 → 8.6`, 평균 2성 `0 → 4.3`, 평균 장착 아이템 `0 → 5.6`
- `AI_SEEDS=50 npm.cmd run audit:ai`: 50시드 감사 통과, 실패 0 (기본 명령은 200시드)
- Chromium 실제 화면 점검: 1440×900, 900×820, 390×844 문서 가로 오버플로 없음; 결과 모달 포커스·Tab·Escape·복귀 통과
- `npm.cmd run simulate:balance`: 540전 완료, 6개 조합·6개 프리셋·3개 배치·좌우 교대 결과 저장
- 밸런스 결과 집계: 유닛 72, 별 등급 통제 54, 조합 18, 시너지 21, 아이템 35, 매치업 90, 강도 3, 성장 단계 3개 그룹
- 전투 시간 중앙값 224틱·90백분위 345틱, 첫 사망 중앙값 62틱, 무승부 3전, 미귀속 피해 0
- 동일 전체 실험 JSON SHA-256 일치 확인

## Remaining Risks
- 전투 전체가 아직 큰 단일 틱 루프이며 장기적으로 세부 규칙 테스트가 더 필요함
- npm 감사 결과 high severity 취약점 1건
- 시너지 특화 프리즘 증강체의 전투 세부 효과는 기존 엔진의 ID 분기를 유지함
- 실제 브라우저에서 증강체 선택부터 전투 종료까지의 통합 흐름은 아직 자동화하지 않음
- 저장 공간 자체가 차단되거나 브라우저가 강제 종료되면 마지막 성공 저장 이후 변경은 복구할 수 없음
- 평가 상관계수는 소규모 대표 덱 기준이며 대량 메타 덱 데이터로 재보정 필요
- 시너지 효과 크기와 유틸리티 평가는 정적 휴리스틱이므로 복잡한 상호작용을 완전히 예측하지 못함
- 가상 상대끼리는 각자 독립 상점을 사용하므로 공용 기물 풀 경쟁까지는 모사하지 않음
- 구버전 후반 저장에서 가상 로비를 처음 생성하면 이전 라운드를 순차 재생해 잠시 지연될 수 있음
- 상대의 가상 승패·체력은 실제 7인 상호 전투가 아니라 성향별 확률 모델임
- 기본 200시드 감사는 약 6~7분이 걸리므로 일상 개발에서는 `AI_SEEDS`를 낮추고 배포 전 전체 감사를 실행하는 편이 적절함
- 결과 모달 외 도감·가이드·증강체 모달의 포커스 트랩은 기존 개별 이벤트 구조를 유지하므로, 향후 공통 모달 제어가 필요하면 통합할 수 있음
- 증강체 실험은 `BALANCE_AUGMENTS`로 기준군과 단독군을 만들지만, 전투 엔진 밖에서 경제·상점·보상에 작용하는 증강체는 별도 진행 시뮬레이션이 필요함
- 현재 540전은 실행기 검증용 1회 반복이며 통계적 밸런스 결론은 9-2 대량 실행 전까지 내리지 않음

## Next Action
- 9-2단계 대량 시뮬레이션 실행
- 다음 단계 필요 모델: GPT-5.6 Terra / Medium
- 모델 변경 후 재개 문구: `모델 변경 완료, 계속`
