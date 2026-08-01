# Classroom Tactics 밸런스 시뮬레이션 설계

## 실행 명령

기본 설계 검증은 6개 조합, 성장 3단계, 별 등급 통제군 3개, 배치 3종, 좌우 교대 조합으로 540전을 실행한다.

```powershell
npm.cmd run simulate:balance
```

9-2 대량 실행에서는 반복 수와 시드를 명시한다.

```powershell
$env:BALANCE_REPETITIONS='20'
$env:BALANCE_SEED='balance-bulk-v1'
npm.cmd run simulate:balance
```

필요한 조합이나 증강체만 비교할 수 있다. `BALANCE_AUGMENTS`는 기준군과 각 증강체 단독군을 만든다.

```powershell
$env:BALANCE_COMPS='discipline,athletics,broadcast'
$env:BALANCE_AUGMENTS='p12,p13,p15'
$env:BALANCE_OUTPUT_DIR='reports/balance/bulk-v1'
npm.cmd run simulate:balance
```

## 실험 단위

전투 하나의 식별자는 다음 요소를 모두 포함한다.

```text
기준 시드
× 조합 A/B
× 성장 또는 별 등급 프리셋
× 배치 패턴
× 증강체 기준군/실험군
× 반복 번호
× 좌우 진영 교대
```

- 조합: `discipline`, `athletics`, `broadcast`, `science`, `welfare`, `economy`
- 성장 프리셋: 2-1 약함, 4-1 보통, 6-1 강함
- 별 등급 통제군: 같은 4-1 조합·레벨·아이템에서 별 등급만 1/2/3성으로 변경
- 배치: 표준, 좌우 반전, 분산
- 진영: 동일 조건을 플레이어/적 진영에 한 번씩 배치

## 수집 지표

원시 전투마다 시드, 승자, 전투 틱, 첫 사망 틱, 양 팀 생존 수, 조합·성장 단계·배치·증강체·시너지 정보를 저장한다.

유닛 단위로 다음을 수집한다.

- 가한 피해량과 받은 피해량
- 회복량
- 생존 틱
- 스킬 발동 횟수
- 별 등급, 가격, 장착 아이템
- 전투 기여도: `가한 피해 + 받은 피해×0.35 + 회복×0.5`
- 가격 대비 기여도: `전투 기여도 ÷ 유닛 가격`
- 소스가 확정되지 않은 스킬 피해량 `unattributedDamage`

## 집계 구조

JSON의 `aggregates` 아래에 다음 집계를 저장한다.

- `units`: 유닛 ID와 별 등급별 평균 지표
- `starControlled`, `starEfficiency`: 동일 조건의 별 등급 효율
- `compositions`: 조합과 스테이지별 승률·생존 수
- `synergies`, `synergyLevelEfficiency`: 시너지 단계별 승률과 생존 수
- `augments`: 기준군과 증강체별 승률
- `items`: 장착 아이템 보유 유닛의 전투 지표
- `matchups`: 조합 대 조합의 극단 상성
- `strengthTiers`: 약함·보통·강함 상대 결과
- `growth`: 2-1·4-1·6-1 성장 체감 곡선
- `distributions`: 전투 시간과 첫 사망 시간의 중앙값·90백분위·극값

## 결과 파일

- 원시 전투와 전체 집계: `reports/balance/balance-latest.json`
- 표 계산용 집계: `reports/balance/balance-latest.csv`

동일 코드·환경·명령·시드는 같은 JSON SHA-256을 생성한다. 실패나 이상치는 JSON의 `seed`를 `BALANCE_SEED`와 조합해 재현한다.

## 해석 원칙

- 성장 프리셋은 플레이어 성장 체감용이며 여러 변수가 함께 변하므로 인과 효과로 해석하지 않는다.
- 별 등급 효과는 `starControlled` 통제군만 사용한다.
- 좌우 교대 결과를 합쳐 진영 편향을 줄인다.
- 평균 승률과 함께 매치업·전투 시간·첫 사망·생존 수를 확인한다.
- `unattributedDamage`가 큰 실험은 유닛별 피해 순위를 확정하지 않는다.
- 9-2에서는 데이터 수집 오류만 수정하고 밸런스 수치는 변경하지 않는다.
