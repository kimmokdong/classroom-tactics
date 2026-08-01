---
name: run-simulation
description: 표준 덱 밸런스 시뮬레이터를 실행하고 고유 run artifact의 결과를 요약합니다. 사용자가 "시뮬 돌려"라고 하면 발동합니다.
---

# Run Simulation Skill

## Trigger

사용자가 "시뮬 돌려", "시뮬레이션 실행해 줘", "시뮬레이터 돌려"라고 요청할 때 사용한다.

## Instructions

1. 워크스페이스 루트에서 `npm run simulate:decks`를 실행해 Smoke → Quick → 의심 상성 Standard 확대 흐름을 수행한다. 빠른 오류 확인만 필요하면 `--profile smoke`을 사용한다.
2. 명령 출력의 `runId`, `reportPath`, `comparisonPath`, `failures`를 확인한다.
3. 명령 출력의 `reportPath`가 가리키는 보고서를 읽고, 필요하면 `comparisonPath`의 보고서도 읽는다. 출력 경로가 없을 때만 `reports/balance/latest.json`을 대체 경로로 사용한다.
4. 사용자에게 전략군별 상·하위 덱, 과성능 후보, 극단 상성, 최대 시간·실패·미귀속 피해 경고, 비교 결과를 간결히 보고한다.
5. 실패 case가 있으면 `npm run simulate:decks -- --case "<case ID>"` 재현 명령을 함께 제시한다.

레거시 `run_simulation_v2.js`, `simulation_report_v2.md`, 고정 latest 결과 파일은 표준 덱 밸런스 평가에 사용하지 않는다.
