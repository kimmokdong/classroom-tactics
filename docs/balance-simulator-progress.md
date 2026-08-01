# 밸런스 시뮬레이터 진행 현황

> 마지막 갱신: 2026-07-17

## 현재 상태

- 마지막 완료 단계: 단계 9 — 최종 감사 문제 수정
- 작업 상태: 구현·회귀·실제 Smoke·Quick 완료
- 최종 완료 상태: 완료
- 완료 보고: `reports/balance/stage9-completion.md`
- 현재 기준선: `20260717133258695-bcfa07b7`

## 단계 9 완료 결론

- 단계 8 감사의 P1 8건, P2 7건, P3 2건을 모두 수정했다.
- 시작 마나, 양 진영 창체·경제부, 고정 딜러 아이템 27건과 검증 계약을 복구했다.
- 필수 프로필 표본 수, 자동 실행 흐름, 시너지·아이템·성장 집계, 목표 밴드 경고를 구현했다.
- 대규모 실행을 온라인 집계·NDJSON·canonical ledger 스트리밍으로 전환했다.
- 비교·캐시·원자 저장·canonical 재검증·실행 스킬 경로를 보완했다.
- 전체 테스트 82/82와 Vite 프로덕션 빌드가 통과했다.
- 상세 감사 이력은 `reports/balance/final-audit.md`, 해결 결과는 `reports/balance/stage9-completion.md`에 있다.

## 단계 7 당시 완료 결과(역사 기록)

- `npm run simulate:decks`가 입력 검증·fingerprint 판단·표준 덱 실행·artifact 저장·동일 조건 baseline 비교를 한 번에 수행한다.
- 당시 기본 프로필은 Quick이었으며 `--profile smoke|quick|standard|deep`, `--case`, `--baseline`, `--set-baseline`을 제공했다.
- 실패 case는 JSON 출력에 재현 명령 `npm run simulate:decks -- --case "<case ID>"`을 포함한다.
- `npm run simulate:compare -- --base <runId> --candidate <runId>`로 대응 case 비교를 독립 실행한다.
- `.cursorrules`와 `.agents/skills/run-simulation`에서 레거시 `run_simulation_v2.js`·고정 결과 파일 경로를 제거했다.
- `시뮬 돌려` 스킬은 Quick 실행 후 latest run report·comparison report·실패 재현 명령을 근거로 요약한다.

## 실제 실행 기준선

- run ID: `20260717133258695-bcfa07b7`
- canonical SHA-256: `1276ebf77323e2601efe6c29a9c6a868b15736ef1e14a194cd2134382e4aaa6e`
- Quick: 42,912개 성공, 0개 실패
- 실행 시간: 211.7초
- artifact: 45.79 MiB
- baseline: `reports/balance/baselines/current.json`
- 상세 report: `reports/balance/runs/20260717133258695-bcfa07b7/report.md`

## 판정 계약

- `scoreRate = (승리 + 동시 전멸 무승부 × 0.5) / 정상 완료 전투`
- `decisiveWinRate = 승리 / (승리 + 패배)`
- 최대 시간과 실행 실패는 두 비율의 분모에서 제외하고 별도 비율로 표시한다.
- 극단 상성은 Standard 기준 매치업 표본 90개 이상에서만 확정하고 그 전에는 후보로 표시한다.
- 배치별 scoreRate 범위가 20%p 이상이면 배치 민감도 경고를 표시한다.
- 서로 다른 리그의 결과는 50% 기준 과대·과소 성능 판정에 섞지 않는다.

## 리그 대진

총 596개다.

- 전략군 내부: 151개
  - `reroll_core7`: 15개
  - `reroll_final8`: 15개
  - `standard_core8`: 15개
  - `standard_final9`: 15개
  - `highvalue_final9`: 91개
- 같은 레벨 교차: 120개
  - 8레벨 `reroll_final8` vs `standard_core8`: 36개
  - 9레벨 `standard_final9` vs `highvalue_final9`: 84개
- 최종 오픈: 최종 보드 26개의 풀리그 325개

최종 오픈은 별도 체급 확인 리그이므로 내부·동레벨 교차 리그와 같은 덱 대진이 있어도 리그 ID를 분리해 유지한다.

## 프로필별 case 수

현재 표준 덱 38개, 고유 매치업 596개 기준이다.

- Smoke: 3,576개 — 동일 배치 3종 × 1회 × 좌우 교대
- Quick: 42,912개 — 3×3 배치 × 4회 × 좌우 교대
- Standard: 128,736개 — 3×3 배치 × 12회 × 좌우 교대
- Deep: 343,296개 — 3×3 배치 × 32회 × 좌우 교대

CLI:

```text
npm run simulate:decks
npm run simulate:decks -- --profile smoke
npm run simulate:decks -- --profile standard
npm run simulate:decks -- --case "<case ID>"
npm run simulate:compare -- --base <runId> --candidate <runId>
```

기본 `simulate:decks`는 입력 검증과 영향 분석 후 Smoke, 전체 Quick, 의심 상성 Standard 확대를 순서대로 실행한다. 특정 프로필만 필요하면 `--profile`을 지정한다. 비교 조건이 다르면 기본 거부하며 필요한 경우에만 `simulate:compare ... --force`를 사용한다.

## 검증 결과

- 전체 `npm.cmd test`: 82개 통과, 0개 실패
- `npm.cmd run build`: 성공, 33 modules transformed
- 실제 Smoke 두 run: 각각 3,576개 성공, 0개 실패
- Smoke canonical hash 동일, 전체 case 교집합 3,576, pairedDelta 0, 승→패·패→승 0/0
- 실제 Quick: 42,912개 성공, 0개 실패
- Quick 집계: 덱 96, 매치업 596, 유닛 340, 시너지 218, 아이템 180, 성장 12
- canonical 변조 탐지, 원자 저장, Deep 스트림, 비교 강제 옵션, 실패 case 재현 테스트 통과

## 변경 파일

- `js/battleEngine.js`
- `js/systems/SynergyManager.js`
- `balance/standard-decks.json`
- `balance/standard-decks.schema.json`
- `balance/simulation-profiles.json`
- `scripts/balance-simulator/aggregate-battle-results.mjs`
- `scripts/balance-simulator/run-standard-decks.mjs`
- `scripts/balance-simulator/simulate-decks.mjs`
- `scripts/balance-simulator/compare-runs.mjs`
- `scripts/balance-simulator/impact-analysis.mjs`
- `scripts/balance-simulator/write-results.mjs`
- `scripts/balance-simulator/validate-standard-decks.mjs`
- `.agents/skills/run-simulation/SKILL.md`
- 관련 테스트·표준 덱 문서·단계 9 완료 보고

## 후속 작업 경계

단계 9 기술 범위는 완료됐다. Quick가 관측한 다음 항목은 별도 밸런스 조정에서 다룬다.

- 내부 리그 과·저성능 후보 33개
- 극단 상성 후보 261개
- 최대 시간 종료 972건
- 목표 밴드 경고의 우선순위별 실제 수치 조정

이 값들은 현재 신뢰 가능한 새 기준선의 관측 결과이며 시뮬레이터 구현 결함으로 처리하지 않는다.
