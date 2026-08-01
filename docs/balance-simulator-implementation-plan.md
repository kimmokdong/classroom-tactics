# 밸런스 시뮬레이터 구현 계획

> 작성일: 2026-07-13  
> 현재 단계: 단계 8 — 전체 최종 감사 완료  
> 상태: 감사 문제 발견, 단계 9 수정 대기

## 1. 목표

이 계획의 최종 목표는 실제 게임과 동일한 전투 계약을 사용하는 완성 덱 전용 밸런스 시뮬레이터를 만드는 것이다. 경제·상점·리롤·레벨업을 포함한 전체 런 시뮬레이터는 이번 범위에 포함하지 않는다.

최종 시스템은 다음 조건을 만족해야 한다.

- 실게임, 적 AI, 표준 덱 시뮬레이터가 같은 유닛 생성·별 등급·아이템·시너지·전투 준비 경로를 사용한다.
- 표준 덱의 단일 원본은 balance/standard-decks.json이며, Markdown은 이 JSON에서 생성한다.
- baseline6/capped9 및 core7/final8/core8/final9 전략군을 구분한다.
- standard/mirrored/spread 3×3 배치와 좌우 교대를 지원한다.
- smoke/quick/standard/deep 실행 프로필을 제공한다.
- 승리, 패배, 동시 전멸 무승부, 시간 초과, 실행 실패를 구분한다.
- 결과를 실행별로 보존하고 동일 입력 재현, 변경 전후 비교, 실패 케이스 단독 재실행이 가능하다.
- 사용자 실행 경로는 npm 명령과 run-simulation 스킬 하나로 수렴한다.

## 2. 단계 0 범위와 비범위

### 이번 단계에서 수행한 일

- .cursorrules와 현재 시뮬레이션 스킬 지침 확인
- 코드 지식 그래프 전체 재색인 후 주요 호출 경로와 중복 구현 감사
- BattleEngine, SkillEngine, SynergyManager의 실제 입력 계약 확인
- 플레이어 구매·합성, 증강체 즉시 진화, 적 AI 생성, 아이템 장착 경로 확인
- 기존 시뮬레이터 A와 B, 표준 덱 Markdown, 테스트, npm 명령, 결과 파일 방식 확인
- 공용 전투 준비 API와 단계별 변경 파일·테스트·회귀 위험 확정

### 이번 단계에서 하지 않은 일

- 전투·게임·시뮬레이터 프로덕션 코드 수정
- 밸런스 수치 변경
- 표준 덱 JSON 작성 또는 기존 Markdown 덮어쓰기
- 시뮬레이션 실행 및 결과 파일 생성
- npm 스크립트나 Codex 스킬 수정
- 비어 있는 .git 저장소 초기화 또는 복구

## 3. 감사 기준선

| 항목 | 확인 결과 |
|---|---|
| 코드 지식 그래프 | 전체 재색인 완료, 2,002개 노드와 4,111개 엣지 |
| 전체 테스트 | npm.cmd test, 41개 통과·0개 실패 |
| 핵심 전투 회귀 묶음 | P0/Core/Balance/Opponent 21개 통과·0개 실패 |
| 표준 덱 원본 | docs/standard_decks.md 한 개, 총 68개 |
| JSON SSOT | 없음 |
| 공식 덱 실행 명령 | simulate:decks, simulate:compare 모두 없음 |
| Git 상태 | .git 디렉터리는 있으나 내부가 비어 있어 HEAD·상태·diff 확인 불가 |

Git 메타데이터가 없으므로 이번 단계의 Codex 작업은 파일 시스템 시각을 기준으로 허용된 두 문서만 수정했는지 확인한다. 작업 시작 전에 존재하던 사용자 변경 여부와 저장소 전체 diff는 검증할 수 없다. 단계 6의 manifest는 Git 복구 전까지 commit과 dirty 값을 null로 기록하고 경고를 남기며, 영향 분석은 보수적으로 전체 재실행해야 한다.

## 4. 현재 실제 전투 경로

현재 실게임의 주 경로는 다음과 같다.

    ShopManager / UnitManager / AugmentManager
                         ┐
    enemyAi.cloneUnit    ├─ 각 경로가 유닛·별 등급을 별도로 생성
                         ┘
                StageManager.handleBattleStart
                           ↓
          SynergyManager.applySynergyStats
                           ↓
                   BattleEngine.run
                           ↓
                  SkillEngine.execute
                           ↓
                 전투 로그와 최종 보드

BattleEngine은 원본 유닛을 만드는 계층이 아니다. 이미 별 등급과 영구 상태가 반영되고 시너지·아이템용 combat 데이터가 준비된 24칸 보드를 입력으로 받는 실행기다. 따라서 단계 1의 공통화 경계는 BattleEngine과 SkillEngine을 합치는 것이 아니라 그 앞의 “유닛 생성 및 전투 준비”다.

### 핵심 계약

| 영역 | 실제 코드 | 현재 계약 |
|---|---|---|
| 전투 시작 | js/systems/StageManager.js의 handleBattleStart | 양측 시너지·아이템 준비, 적 추가 보정, BattleEngine 생성 |
| 전투 준비 | js/systems/SynergyManager.js의 applySynergyStats | 보드 복제, 영구 성장, 전역 버프, 시너지, 아이템, combat 초기화 |
| 실행기 | js/battleEngine.js의 constructor/run | 24칸 양측 보드를 방어적으로 복제하고 seed 기반 전투 실행 |
| 스킬 | js/battle/SkillEngine.js의 execute | unit.star와 engine.random을 사용 |
| 플레이어 생성 | js/systems/ShopManager.js의 buyUnit | 상점 템플릿 복제, star=1, items=[] |
| 플레이어 합성 | js/systems/UnitManager.js의 checkForUpgrade | 같은 ID·같은 별 3개를 합쳐 HP×1.8, AD×1.5 |
| 즉시 진화 | js/systems/AugmentManager.js의 executeEffect | 대상 유닛에 별과 HP/AD 배율을 직접 적용 |
| 적 생성 | js/enemyAi.js의 cloneUnit/createOwnedUnit | 기본 별 배율 뒤 3성 저코스트 AI 전용 보정 혼합 |
| 아이템 장착 | js/systems/ItemManager.js의 giveItemToUnit | ID 저장·조합·도둑의 장갑 굴림, 최대 3개 |

BattleEngine의 입력 방어용 structuredClone은 중복 제거 대상이 아니다. 전투 중 변이가 원본 상태로 역류하지 않게 하는 안전장치이므로 유지한다.

## 5. 중복 구현과 불일치

### 5.1 유닛 생성과 별 등급

실게임 기준 별 등급 공식은 한 단계 오를 때마다 HP를 1.8배, AD를 1.5배로 순차 반올림하며 AP·방어력·마법 저항력은 기본 별 공식에서 바꾸지 않는 것이다.

| 위치 | 함수/영역 | 현재 구현 | 판정 |
|---|---|---|---|
| js/systems/UnitManager.js | checkForUpgrade | HP×1.8, AD×1.5 | 현재 플레이어 기준 |
| js/systems/AugmentManager.js | executeEffect의 upgrade-random | 별·HP·AD 직접 변경 | 공통 함수로 이관 필요 |
| js/enemyAi.js | cloneUnit | 기본 공식 + 3성 저코스트 HP/방어/마저 보정 | 기본 공식과 AI 보정 분리 필요 |
| run_simulation_v2.js | buildCombatBoard | HP와 AD 모두 1.8 누적, star 대신 starLevel | 실게임과 불일치 |
| scripts/run_balance_experiment.mjs | scaledUnit | HP×1.8, AD×1.5를 재구현 | 수치는 같지만 중복 |
| run_simulation.js | AgentBot.checkCombine | 티어별 HP·AD/AP 배율 | 비공식 레거시, 실게임과 불일치 |
| js/sandbox.js | 별 선택 처리 | UNIT_POOL에서 HP/AD 재계산 | 지원 UI라 공통화 필요 |
| 여러 평가 스크립트 | 보드 생성 | HP/AD/AP 직접 배율 | 공식 실행 경로와 분리 또는 후속 정리 |

추가 적 보정도 두 곳에 나뉘어 있다.

- js/enemyAi.js: 3성 저코스트 유닛에 HP·방어력·마법 저항력 추가
- js/systems/StageManager.js: 월드 5 이상 적에게 HP×1.15, 방어력·마법 저항력 +15

이 수치는 기본 별 등급 공식이 아니다. 공용 생성 후 명시적인 AI modifier로 적용해야 하며, 표준 덱 대 덱 시뮬레이션의 기본값은 modifier 없음이어야 한다.

### 5.2 아이템

| 위치 | 현재 역할 | 문제 |
|---|---|---|
| ItemManager.giveItemToUnit | 장착, 조합, 최대 개수, 도둑의 장갑 | 잘못된 item ID를 명시적으로 거부하지 못하고 일부 난수가 Math.random에 고정 |
| SynergyManager.applySynergyStats | 정적 스탯과 전투 효과 반영 | 미등록 ID는 조용히 건너뛰며, 같은 효과 여러 개를 boolean으로 축약 |
| run_simulation_v2.js | 무작위 선택과 일부 스탯·효과 직접 적용 | 실제 ItemManager/SynergyManager 계약과 다름, 비시드 |
| run_balance_experiment.mjs | itemCount만큼 ID 직접 선택 | 선택 로직 중복, 진영 교대 시 같은 덱의 아이템 불변 보장 없음 |
| StageManager 전투 후 처리 | 도둑의 장갑 재굴림 | Math.random 사용으로 전체 런 재현 불가 |

BattleEngine 일부 효과는 itemEffects 값을 개수로 취급하지만 SynergyManager는 이를 boolean으로 저장한다. 중복 아이템 효과가 한 개로 축약되는 현행은 계약상 이상 징후다. 다만 이를 즉시 개수로 바꾸면 실제 전투 피해·회복·소환량이 바뀐다. 단계 1에서는 먼저 현행 결과를 특성화 테스트로 고정하고 공통 경로 전환 전후의 동작을 같게 유지한다. 개수 의미로 고칠지는 공식 기준선 생성 전에 별도 변경으로 판단한다.

### 5.3 시너지와 전투 준비

SynergyManager.applySynergyStats는 현재 가장 재사용 가치가 높은 공통 경로다. 다만 다음 책임이 한 isEnemy 플래그에 묶여 있다.

- 보드의 진영
- 플레이어 전용 globalBuffs 적용 여부
- 기부 아이템 같은 유닛 소유 효과 적용 여부

단계 1의 API에서는 teamRole과 applyPlayerOnlyBonuses를 분리한다. 그러나 현행 기부 효과가 player 역할에만 적용되는 동작은 우선 그대로 보존한다. 표준 덱 실행기는 좌우 교대로 이 비대칭을 상쇄한다. 기부 효과를 양쪽 소유 팀에 적용하는 변경은 적 전력을 바꾸므로 공통화와 한 번에 섞지 않는다.

또한 SynergyManager가 combat.startMana를 기록한 뒤 stats.mana에도 더하고, BattleEngine이 다시 combat.startMana를 합산한다. 시작 마나가 이중 적용되는 현행도 이상 징후지만, 바로 고치면 첫 스킬 타이밍과 전체 로그가 바뀐다. 단계 1에서는 현행 로그를 고정하고 중복 적용을 보존한다.

위 세 항목은 “데이터 수치 수정”이 아니어도 실제 전투 결과와 밸런스 기준선을 바꾸는 행동 변경이다. 공용 계약 추출과 분리해 판단하며, 수정한다면 각각 독립 테스트와 전후 비교를 갖는 별도 변경으로 처리한다.

### 5.4 보드·복제·배치

| 경로 | 구현 |
|---|---|
| 실게임 | 실제 board를 SynergyManager가 복제하고 BattleEngine이 다시 방어적으로 복제 |
| 적 AI | enemyAi.arrangeBoard |
| 시뮬레이터 A | buildCombatBoard에서 JSON 복제와 자체 행 배치 |
| 시뮬레이터 B | arrangeUnits에서 3개 패턴 적용 |

시뮬레이터 A는 양쪽을 같은 행 규칙으로 배치해 BattleEngine의 적 좌표 변환 뒤 공간 비대칭이 커진다. B도 3×3 전체 조합이 아니라 양쪽에 같은 pattern 하나만 적용한다. 공통 준비 API는 24칸 검증과 복제까지만 담당하고, 3×3 배치 조합과 mirror/swap case 생성은 단계 4 실행기의 책임으로 둔다.

### 5.5 난수

재사용할 기반은 js/battleEngine.js의 createSeededRandom과 BattleEngine.random이다. SkillEngine도 engine.random을 사용한다.

현재 위험은 다음과 같다.

- 시뮬레이터 A는 아이템과 전투 모두 비시드다.
- 시뮬레이터 B는 플레이어와 적 시너지에 한 난수 함수를 순차 공유한다.
- B는 player/enemy 및 swap 문자열을 보드 seed에 넣어 동일 덱의 아이템이 진영에 따라 달라질 수 있다.
- ItemManager와 StageManager의 도둑의 장갑 경로에 Math.random이 남아 있다.
- 화면 효과용 Math.random은 전투 결과와 무관하므로 공통화 범위에서 제외한다.

공용 준비 API는 양쪽 난수 공급자를 따로 받는다. 실게임은 기존 순서를 보존해야 할 때 같은 순차 공급자를 전달할 수 있고, 표준 덱 실행기는 덱 ID·체크포인트·아이템 세트·반복 번호에서 파생한 진영 독립 seed를 전달한다.

## 6. 기존 시뮬레이터 판정

### 시뮬레이터 A: run_simulation_v2.js

현재 공식 기반으로 사용할 수 없다.

- docs/standard_decks.md를 이름 기반으로 직접 파싱한다.
- 실제 star 대신 starLevel을 쓴다.
- 3성까지 HP와 AD 모두 1.8배씩 올린다.
- SynergyManager를 사용하지 않고 아이템 일부만 직접 반영한다.
- Math.random과 seed 없는 BattleEngine을 사용한다.
- player가 이기지 않은 모든 결과를 B 승리로 처리해 무승부와 시간 초과가 왜곡된다.
- 진영 교대가 없고 simulation_report_v2.md를 매번 덮어쓴다.

단계 1에서는 유닛 생성과 준비만 공용 API로 우회시켜 수치 중복을 제거한다. JSON SSOT, 공정한 case suite, 판정, 저장 방식이 완성되는 단계 4 전까지는 레거시 상태를 유지하며 삭제하지 않는다.

### 시뮬레이터 B: scripts/run_balance_experiment.mjs

BattleEngine, createSeededRandom, SynergyManager, ITEMS, 일부 집계 코드는 재사용할 수 있다. 그러나 완성 덱 실행기는 아니다.

- scaledUnit이 별 배율과 아이템 선택을 다시 구현한다.
- COMPOSITION_PATHS는 완성 덱이 아니라 적 AI가 상점에서 찾는 유닛 후보 범위다.
- 모든 유닛에 같은 star와 itemCount를 일괄 적용한다.
- 양쪽에 같은 pattern만 적용한다.
- 진영 교대 시 덱별 아이템 불변 계약이 없다.
- draw를 양 팀 패배처럼 집계한다.
- 결과를 balance-latest.json/csv에 덮어쓴다.

단계 1에서 공용 준비 경로의 첫 검증 소비자로 사용하되, 단계 4에서 표준 덱 JSON 기반 실행기로 교체한다. collectBattleMetrics 중 실제 로그에서 안전하게 읽을 수 있는 부분만 단계 5에서 재사용한다.

### 기타 실행 파일

run_simulation.js, scripts/run_synergy_sim.mjs, scripts/sim_23_decks.mjs, scripts/simulate_balance.js, 시너지 평가 스크립트는 현재 package.json과 run-simulation 스킬이 가리키는 정식 완성 덱 경로가 아니다. 단계 1에서 무리하게 모두 개조하지 않는다.

대신 다음 원칙을 적용한다.

- 단계 1의 완료 기준은 실게임, AI, 샌드박스, 시뮬레이터 A/B의 공용 계약 사용이다.
- 기타 실행 파일은 공식 결과를 생성하지 않는 legacy/noncanonical 목록으로 명시한다.
- 단계 7에서 새 명령과 스킬 전환이 끝난 뒤 참조 여부를 확인해 공용 API로 옮기거나 제거한다.
- 프로덕션·공식 시뮬레이터에 직접 HP/AD 별 배율을 남기지 않는다.

## 7. 표준 덱 데이터 감사

docs/standard_decks.md에는 Lv7 14개, Lv8 18개, Lv9 18개, Lv10 18개로 총 68개 덱이 있다.

확인 결과:

- 모든 유닛 이름이 현재 UNIT_POOL에 존재한다.
- 각 덱의 유닛 수가 표기 레벨과 맞고 덱 내부 중복 유닛이 없다.
- 메인 탱커·메인 딜러·서브 역할이 출전 유닛과 맞는다.
- 선언 시너지는 단순 보유 수가 아니라 활성 단계 기준으로 68개 모두 현재 SYNERGIES와 맞는다.

그러나 최종 전략군 규칙에는 그대로 맞지 않는다.

- Lv7 14개 중 서로 다른 3코 메인 탱커와 3코 메인 딜러 조건을 만족하는 덱은 현재 0개이며 별 정보도 없다.
- Lv8 18개 중 13개가 5코스트 유닛을 포함해 기본 core8 규칙과 충돌한다.
- Lv10 18개는 최종 core7/final8/core8/final9 체계에서 재분류하거나 제외해야 한다.
- “방송부 7” 두 항목은 동일 유닛·동일 역할이라 중복 제거 후보이다.
- “급식부 7” 두 항목은 유닛은 같지만 서브 딜러가 달라 제목만으로 합치면 안 되며 variant ID가 필요하다.

js/meta_decks.json과 js/meta_decks_lvl9.json은 unit ID, star, gridIndex 이관 참고 자료로 사용할 수 있지만 역할, 고정 아이템, 체크포인트가 없어 SSOT로 바로 승격하지 않는다.

## 8. 단계 1 목표 공용 전투 계약

### 위치

새 파일 하나인 js/battle/combatPreparation.js에 클래스 계층 없이 순수 함수 중심으로 둔다. 기존 BattleEngine과 SynergyManager를 재사용하며 새 외부 의존성을 추가하지 않는다.

### 공개 API

    createUnitInstance(template, {
      star = 1,
      itemIds = [],
      catalog = ITEMS,
      random,
      instanceId,
      teamRole = 'neutral'
    })

    promoteUnitToStar(unit, targetStar)

    equipUnitItems(unit, itemIds, {
      catalog = ITEMS,
      random
    })

    prepareBattle({
      player: {
        board,
        teamRole: 'player',
        applyPlayerOnlyBonuses: true,
        random
      },
      opponent: {
        board,
        teamRole: 'opponent',
        applyPlayerOnlyBonuses: false
      },
      applySynergyStats,
      getSynergies = getSynergyData,
      random
    })

### 책임

createUnitInstance:

- 템플릿을 structuredClone한다.
- id는 유닛 종류 ID로 유지하고 instanceId는 별도 필드로 보존한다.
- star는 1~3만 허용하고 starLevel은 새로 만들지 않는다.
- itemIds를 직접 대입하지 않고 반드시 equipUnitItems를 호출한다. 따라서 미등록 ID나 4개 이상 장착을 우회할 수 없다.
- catalog는 기본 ITEMS를 사용하며 테스트·도구에서 다른 카탈로그를 주입할 수 있다.
- permGrowth 같은 영구 필드는 템플릿 복제로 보존한다. 도둑의 장갑 지속 목록은 장착 helper가 생성·검증한다.
- target star까지 순차 승급 함수를 호출한다.
- 입력 원본을 바꾸지 않는다.

promoteUnitToStar:

- 현재 별부터 목표 별까지 한 단계씩 HP×1.8, AD×1.5 후 Math.round한다.
- AP·방어력·마법 저항력은 기본 별 공식에서 바꾸지 않는다.
- permGrowth나 AI 전용 보정을 별 배율에 섞지 않는다.
- 기존 유닛을 직접 바꾸지 않고 새 인스턴스를 반환한다.

equipUnitItems:

- 현재 ITEMS에 존재하는 ID만 받는다.
- 0~3개를 허용하고 4개 이상 또는 미등록 ID는 설명 가능한 오류로 거부한다.
- 전투 스탯은 이 단계에서 미리 더하지 않고 ID와 필요한 지속 상태만 저장한다.
- 도둑의 장갑 등 무작위 선택은 전달된 random만 사용하고 결과를 저장한다.
- 이 함수는 전달받은 유닛에 최종 장착 목록을 검증·적용하는 작은 helper다. ItemManager의 인벤토리 소비, 기본 아이템 조합, 초과 아이템 반환, 슬롯/UI 처리는 대체하지 않는다.

prepareBattle:

- 양측 입력이 정확히 24칸인지 검증하고 원본 불변 복제본을 만든다.
- 양측 활성 시너지를 실제 getSynergyData로 계산한다.
- SynergyManager의 실게임 로직을 각 팀에 정확히 한 번 적용한다.
- 각 팀 context에 teamRole, applyPlayerOnlyBonuses, random을 명시해 진영과 플레이어 전용 전역 버프를 호출 계약에서 분리한다.
- SynergyManager의 기존 applySynergyStats(board, synergies, isEnemy, random) 호출자는 깨지지 않게 유지한다. 필요하면 context 기반 새 entry를 추가하되 내부 구현은 공유한다.
- 시작 마나, itemEffects boolean, player 역할 전용 기부 효과는 단계 1에서 현행 의미를 보존한다.
- BattleEngine의 augment, gold, seed는 기존 StageManager·시뮬레이터 호출자가 계속 소유한다.
- 배치 생성, 경제, 상점, 합성 재료 소비, AI 의사결정은 담당하지 않는다.

반환 형태:

    {
      playerBoard,
      enemyBoard,
      playerSynergies,
      enemySynergies
    }

instanceId는 단계 1에서 입력되면 보존하는 호환 필드로 시작한다. 전역 난수나 숨은 카운터로 자동 생성하지 않는다. 단계 5에서 로그 원천 식별자를 정규화할 때 게임 저장 데이터와 함께 필수화 여부를 결정한다.

### AI modifier 경계

다음 항목은 공용 prepareBattle 인자로 합치지 않고 js/enemyAi.js 또는 StageManager의 명시적인 함수로 남긴다.

- 3성 저코스트 AI 보너스: 공용 기본 별 승급 직후, SynergyManager 적용 전에 실행
- 월드 5 이상 적 보너스: SynergyManager 적용 뒤, BattleEngine 생성 전에 실행
- 난이도에 따른 경제·상점·배치 결정

두 보정은 적용 시점이 다르므로 하나의 enemyModifier 후처리로 합치지 않는다. 표준 덱 대 덱 실행기는 둘 다 호출하지 않는다. 이로써 “별 등급 자체가 다르다”와 “AI 난이도 보정이 붙었다”를 테스트에서 분리하면서 현행 배율 적용 순서를 보존한다.

## 9. 단계 1 정확한 변경 범위

### 새 파일

- js/battle/combatPreparation.js
- test/combat-preparation.test.mjs

### 수정할 실게임 파일

- js/systems/ShopManager.js: 1성 구매 인스턴스를 공용 생성기로 생성
- js/systems/UnitManager.js: 합성 정책은 유지하고 별 승급 계산만 공용 함수 사용
- js/systems/AugmentManager.js: upgrade-random의 직접 HP/AD 배율 제거
- js/systems/ItemManager.js: 인벤토리·조합 오케스트레이션은 유지하고 최종 ID 검증·장착 helper와 주입 RNG 사용
- js/systems/SaveManager.js: 저장 데이터의 미등록 item ID를 공용 strict 경계 전에 명시적으로 복구하고 경고
- js/systems/SynergyManager.js: 기존 시그니처 호환을 유지하며 context 기반 공용 진입점만 추가
- js/systems/StageManager.js: 양측 준비를 prepareBattle로 위임하되 두 AI 보정의 기존 전후 순서 유지
- js/enemyAi.js: 기본 생성·별 승급은 공용화하고 3성 저코스트 보정은 시너지 전에 별도 적용
- js/sandbox.js: 별 선택과 전투 준비를 공용 함수로 전환

### 수정할 테스트 파일

- test/save-recovery.test.mjs: 저장된 미등록 item ID 복구와 정상 저장 데이터 유지

### 수정할 시뮬레이터 파일

- run_simulation_v2.js: buildCombatBoard의 직접 별·아이템·시너지 준비 제거
- scripts/run_balance_experiment.mjs: scaledUnit과 applySynergies를 공용 경로로 교체

### 변경하지 않을 것

- 전투 수치와 유닛·아이템·시너지 원본 데이터
- 플레이어 합성 시 어느 복사본의 아이템을 보존할지에 대한 현행 정책
- 적 AI 합성의 초과 아이템 반환 정책
- BattleEngine 전체와 로그 형식
- 시작 마나 이중 적용, itemEffects boolean, player 역할 전용 기부 효과의 현행 결과
- 표준 덱 Markdown과 balance JSON
- npm 명령과 run-simulation 스킬
- 비공식 레거시 실행 파일

### 단계 1 완료 조건

- 1·2·3성 HP/AD/AP와 순차 반올림이 정확하다.
- 플레이어, AI 기본 생성, 시뮬레이터 생성 결과가 동일하다.
- 3성 저코스트 보정은 시너지 전, 월드 5 보정은 시너지 후에 적용되며 공용화 전 준비 보드와 같다.
- createUnitInstance와 equipUnitItems 모두에서 0·1·3개 아이템이 정상이고 4개·미등록 ID 우회가 실패한다.
- ItemManager의 기본 아이템 조합, 인벤토리 소비, 3슬롯 실패 시 상태 불변, 도둑의 장갑 단독·혼합·재굴림 동작이 유지된다.
- 저장 데이터의 미등록 item ID는 게임 전투 중 crash가 아니라 SaveManager의 명시적인 복구 정책으로 처리된다.
- 같은 seed에서 기부, 정의의 손길, 도둑의 장갑 결과가 같다.
- teamRole과 applyPlayerOnlyBonuses가 API에서 분리되고 기존 player/opponent 결과는 그대로다.
- 시작 마나 이중 적용, itemEffects boolean, player 역할 전용 기부 효과를 포함한 준비 보드와 동일 seed 전체 로그가 공용화 전후 일치한다.
- 준비 전·후 시너지 스냅샷과 실 StageManager 경로가 일치한다.
- 실게임, 샌드박스, 시뮬레이터 A/B에 새 starLevel 사용과 직접 HP/AD 별 배율이 없다.
- npm.cmd test 전체가 통과한다.

## 10. 단계별 구현 로드맵

### 단계 1 — 공용 전투 계약 통합

목표: 위 공용 API를 만들고 실게임·AI·샌드박스·시뮬레이터 A/B가 사용하게 한다.

구현 순서는 먼저 기존 StageManager 준비 보드와 동일 seed 전체 로그를 golden으로 고정한 뒤, 동작을 바꾸지 않는 공통 함수 추출을 수행한다. 그 다음 플레이어·AI·시뮬레이터 소비자를 하나씩 전환한다. 공통화 중 발견된 시작 마나·중복 효과·기부 비대칭은 이 단계에서 함께 수정하지 않는다.

검증: test/combat-preparation.test.mjs와 기존 전체 회귀 테스트.

종료 시 다음 단계 문서만 갱신하고 밸런스 데이터는 바꾸지 않는다.

### 단계 2 — JSON Schema 기반과 소형 샘플

생성:

- balance/standard-decks.json
- balance/standard-decks.schema.json
- balance/simulation-profiles.json
- balance/target-bands.json
- scripts/balance-simulator/validate-standard-decks.mjs
- scripts/balance-simulator/generate-standard-decks-md.mjs
- test/standard-decks.test.mjs

원칙:

- schemaVersion과 stable deck ID를 둔다.
- 최상위에는 primaryCheckpoint와 stable checkpoint ID 목록을 둔다.
- checkpoint는 phase와 boardLevel을 가지며 deck은 checkpointId로 참조한다.
- deck은 strategyGroup, units, fixedItems, roles, expectedSynergies, tags, notes를 가진다.
- unit은 unitId, star, items, position을 가진다.
- 샘플 데이터만으로 schema·validator·Markdown 생성기를 먼저 검증한다.
- Node에 JSON Schema 검증기가 없으므로 직접 표준 검증기를 재구현하지 않는다. 실제 schema 검증이 필요할 때 Ajv 한 개만 개발 의존성으로 추가한다.
- 기존 68개 Markdown은 단계 3 이관 전까지 덮어쓰지 않는다.

simulation-profiles.json은 smoke/quick/standard/deep의 반복 수, 사용할 배치, 좌우 교대, 출력 상세 수준을 데이터로 관리한다. 정확한 반복 수는 단계 2에서 smoke 성능 측정 후 확정한다.

완료 기록(2026-07-17): Ajv 기반 Schema 검증, 실제 unit/item ID·역할·활성 시너지 대조, strategyGroup/phase/boardLevel 규칙, primaryCheckpoint 및 중복 checkpoint ID 검증을 구현했다. 6레벨과 7레벨 대표 샘플 2개로 JSON→Markdown 파일 생성까지 검증했으며, 기존 68개 Markdown은 단계 3 전수 감사 전까지 보존한다.

### 단계 3 — 표준 덱 전수 이관과 전략군 정비

- 기존 68개를 유지, 수정, variant 분리, 중복 제거, 재분류, 제외로 각각 판정한다.
- 이름을 unitId로 변환하고 checkpoint·star·position·고정 아이템·역할을 채운다.
- baseline6/capped9 및 core7/final8/core8/final9 규칙을 validator로 검사한다.
- core7은 서로 다른 3코 메인 탱커와 3코 메인 딜러 조건을 데이터로 검증한다.
- core8의 5코스트 금지 등 전략군 제약을 명시한다.
- JSON 검증을 통과한 뒤에만 docs/standard_decks.md를 자동 생성본으로 교체한다.
- 제목 기반 자동 중복 제거를 금지하고 stable ID와 variant ID를 사용한다.

완료 기록(2026-07-17): 레거시 68개를 전수 감사해 일부 수정 9개, 전략군 재분류 17개, 제외 26개, 신규 설계 필요 16개로 판정했다. 유효 성장 경로와 고밸류 덱 38개만 활성화했으며, `reroll_core7` 6개, `reroll_final8` 6개, `standard_core8` 6개, `standard_final9` 6개, `highvalue_final9` 14개가 Schema와 전략군 검증을 통과한다. 10레벨 18개와 완전 중복·규칙 미충족 덱은 억지 이관하지 않았다. `docs/standard_decks.md`는 검증된 JSON 자동 생성본으로 교체했고 일회성 Markdown 이관 코드는 제거했다.

### 단계 4 — 표준 덱 실행기와 공정한 case suite

생성:

- scripts/balance-simulator/run-standard-decks.mjs
- scripts/balance-simulator/create-case-suite.mjs
- scripts/balance-simulator/run-battle-case.mjs
- test/standard-deck-runner.test.mjs

기능:

- JSON 덱만 읽고 Markdown을 런타임 파싱하지 않는다.
- standard/mirrored/spread의 3×3 조합을 생성한다.
- 양 덱의 진영을 교대한다.
- 동일 덱의 별·아이템·배치는 진영이 바뀌어도 유지한다.
- case ID를 deckA/deckB/checkpoint/placement/side/repetition으로 안정적으로 만든다.
- seed를 case ID와 덱 ID에서 파생해 케이스 단독 재실행을 보장한다.
- smoke/quick/standard/deep 프로필을 CLI로 선택한다.
- 실패 케이스가 전체 실행을 중단시키지 않되 실패로 별도 집계한다.

기존 B의 안전한 전투 실행·집계 일부는 재사용하고 COMPOSITION_PATHS 및 일괄 star/itemCount 설계는 재사용하지 않는다.

### 단계 5 — 종료 판정, 로그, 통계

BattleEngine의 최종 end 로그에 endReason을 추가해 다음을 구분한다.

- decisive: 한쪽 생존
- simultaneous-draw: 동시 전멸
- max-time: 제한 시간 종료
- failure: 실행 예외 또는 잘못된 입력

tick 599 도중 전멸했는데 마지막 생존 판정 없이 timeout draw로 떨어지는 경계도 별도 회귀 테스트로 고정한 뒤 수정한다.

로그는 기존 렌더러 필드를 유지하면서 다음 식별자를 추가한다.

- sourceInstanceId
- sourceUnitId
- sourceType
- targetInstanceId
- team

집계는 최소한 다음을 제공한다.

- scoreRate: 승=1, 무승부=0.5, 패=0
- decisiveWinRate: 무승부와 실패를 제외한 승률
- simultaneousDrawRate, maxTimeRate, failureRate
- 평균 전투 시간과 생존 유닛·HP
- 역할별 피해·회복·탱킹·처치
- 별 등급 필요 장수와 티어를 반영한 투자 비용
- Wilson 신뢰구간

### 단계 6 — 실행 저장, 비교, 캐시

실행별 기본 구조:

    reports/balance/runs/<runId>/
      manifest.json
      cases.ndjson
      summary.json
      report.md
      failures.json
      comparison.json

생성:

- scripts/balance-simulator/write-results.mjs
- scripts/balance-simulator/compare-runs.mjs
- scripts/balance-simulator/impact-analysis.mjs

원칙:

- manifest에 schema/profile/target band 버전, 입력 파일 hash, seed 규칙, 코드 commit·dirty 상태를 기록한다.
- Git을 읽지 못하면 null과 경고를 기록하고 캐시 재사용과 부분 영향 분석을 금지한다.
- case 입력 hash가 같을 때만 캐시를 재사용한다.
- 변경 영향이 불명확하면 전체 실행한다.
- 대규모 실행은 battle 전체 배열을 메모리에 쌓지 않고 NDJSON 스트리밍과 온라인 집계를 사용한다.
- latest는 과거 실행을 덮어쓰지 않는 작은 포인터/요약 파일로만 유지한다.
- 비교 결과의 canonical 원본은 JSON이며 Markdown은 표시용이다.

### 단계 7 — 한 명령 실행과 스킬 전환

package.json에 다음 명령을 추가한다.

- npm run simulate:decks
- npm run simulate:decks -- --profile smoke
- npm run simulate:decks -- --profile quick
- npm run simulate:decks -- --profile standard
- npm run simulate:decks -- --profile deep
- npm run simulate:compare -- --base <runId> --candidate <runId>

.agents/skills/run-simulation/SKILL.md를 새 명령과 새 report 경로로 전환한다. 이 파일은 현재 run_simulation_v2.js와 simulation_report_v2.md에 고정돼 있으므로 단계 7 전에는 수정하지 않는다.

.cursorrules의 존재하지 않는 run_meta_sim.mjs 지침과 스킬의 Top N·표 범위 충돌도 같은 단계에서 정리한다.

### 단계 8 — 최종 감사

코드 수정 없이 다음을 검증하고 감사 문서만 작성한다.

- 동일 입력·동일 seed의 결과 hash 일치
- 변경 없는 두 실행 비교 결과 0
- 단일 밸런스 수치 변경 시 영향 덱·케이스 감지
- 수치 복원 후 원래 결과 재현
- 실패 case 단독 재실행
- 전체 테스트와 smoke/quick 실행
- 실게임·AI·시뮬레이터의 공용 계약 사용 여부
- 공식 경로에 Markdown 런타임 파서와 직접 별 배율이 없는지

### 단계 9 — 감사에서 발견된 문제만 수정

단계 8에서 재현된 실제 문제만 최소 변경한다. 새 기능이나 추측성 리팩터링은 추가하지 않는다.

## 11. 테스트 계획

| 단계 | 필수 테스트 |
|---|---|
| 1 | 별 1/2/3성, 순차 반올림, player/AI/sim parity, AI 보정 전후 순서, item 0/1/3/invalid·검증 우회, 조합·인벤토리·3슬롯, 저장 복구, seed 재현, 시너지 전후, 기존 시작 마나·itemEffects·기부 동작 golden, 원본 불변 |
| 2 | schema 유효/무효 fixture, ID 중복, 존재하지 않는 unit/item, role/position/checkpoint, JSON→Markdown 안정성 |
| 3 | 68개 이관 대조, 전략군 규칙, 중복/variant 판정, 생성 Markdown snapshot |
| 4 | 3×3 case 수, 좌우 교대, 진영 독립 item seed, stable case ID, 단독 재실행, 프로필 필터 |
| 5 | 다섯 outcome, tick 경계, 로그 source/target, scoreRate/decisiveWinRate, 신뢰구간 |
| 6 | hash/cache hit·miss, Git 없음 fallback, run 보존, 동일 실행 비교, 변경 영향 |
| 7 | npm CLI smoke, 잘못된 인자, 스킬 report 경로 |
| 8 | 전체 회귀, 결정론, 무변경 비교, 변경·복원 시나리오 |

## 12. 주요 회귀 위험과 방어선

1. 별 배율 반올림 순서  
   3성을 pow 한 번으로 계산하지 않고 현행처럼 단계별 Math.round를 테스트한다.

2. 영구 상태 유실  
   UnitManager 합성 때 items, permGrowth, thievesItems와 저장되는 사용자 상태를 fixture로 고정한다.

3. AI 체급 변화  
   기본 별 결과와 두 AI 보정 결과를 별도 snapshot으로 둔다. 저코스트 보정은 시너지 전, 월드 5 보정은 시너지 후라는 순서를 바꾸지 않는다.

4. 시너지 적용 순서 변화  
   별→영구 성장→전역 버프/시너지→아이템→maxHp 정리 순서를 실제 게임과 비교한다.

5. 난수 소비 순서 변화  
   기존 실게임 seed 로그 회귀와 새 진영 독립 simulator seed 테스트를 함께 둔다.

6. 아이템 동작 변화  
   신규 생성·시뮬레이터 입력은 unknown item을 strict reject한다. 기존 저장 데이터는 SaveManager에서 경고와 함께 복구해 전투 중 crash를 막는다. ItemManager의 조합·인벤토리·슬롯 처리에는 순수 helper만 삽입한다.

7. 진영 의미 혼합  
   teamRole과 applyPlayerOnlyBonuses를 팀별 context로 분리한다. 두 AI 보정은 prepareBattle 인자가 아니라 기존 전후 위치의 명시 함수로 유지한다. 현행 player 역할 전용 기부 결과는 단계 1에서 바꾸지 않는다.

8. 전투 후 영구 성장 반영 실패  
   originalBoardIdx와 preBattlePlayerBoard를 보존하고 기존 전투 후 갱신 테스트를 유지한다.

9. 로그 호환성  
   단계 5의 새 필드는 추가 방식으로 넣고 기존 renderer 필드를 삭제하지 않는다.

10. 대규모 실행 메모리  
    단계 6에서 NDJSON 스트리밍과 온라인 집계를 사용하고 deep 프로필 전에 quick으로 측정한다.

## 13. 단계 0 결론

현재 가장 큰 문제는 BattleEngine 자체가 아니라 그 앞의 유닛 생성·별 등급·아이템·시너지 준비가 경로마다 다르다는 점이다. 따라서 첫 구현은 공용 전투 준비 모듈 하나와 그 소비자 전환에 한정한다.

표준 덱 JSON, 새 실행기, 로그·통계, 저장·비교, npm·스킬 전환은 각각 검증 가능한 후속 단계로 분리한다. 단계 1에서는 밸런스 데이터와 전투 알고리즘을 바꾸지 않고 실제 게임과 시뮬레이터의 입력 계약부터 같게 만든다.

## 14. 단계 1 완료 기록

2026-07-15에 js/battle/combatPreparation.js와 test/combat-preparation.test.mjs를 추가하고 실게임·AI·샌드박스·시뮬레이터 A/B 소비자를 공용 경로로 전환했다.

- createUnitInstance, promoteUnitToStar, equipUnitItems, prepareBattle 네 공개 책임을 구현했다.
- 3성 저코스트 AI 보정과 월드 5 이상 적 보정을 각각 시너지 전·후의 명시 함수로 분리했다.
- SaveManager가 미등록 아이템 ID만 제거하고 나머지 저장 상태를 보존하게 했다.
- 시작 마나 이중 적용, itemEffects boolean, player 역할 전용 기부는 계획대로 보존했다.
- 전체 npm 테스트는 기준선 41개에서 47개로 늘었고 모두 통과했다.
- 전체 그래프 재색인 결과는 2,095개 노드와 4,005개 엣지다.
- run_simulation_v2.js와 scripts/run_balance_experiment.mjs에서 직접 1.8·1.5 별 배율과 starLevel 사용은 0건이다.

다음 구현 단계는 단계 2 — JSON Schema 기반과 소형 샘플이다. 기존 68개 덱의 전수 이관은 단계 3까지 시작하지 않는다.

## 15. 단계 4 완료 기록

2026-07-17에 표준 덱 JSON 전용 case suite와 전투 실행기, CLI를 추가했다.

- 내부 151개, 동레벨 교차 120개, 최종 오픈 325개로 총 596개 대진을 리그별로 분리했다.
- 세 배치의 3×3 조합, 좌우 교대, 반복 번호를 조합한 안정적인 10요소 case ID를 구현했다.
- 좌우 방향을 제외한 논리 case에서 덱·아이템 seed를 파생해 진영 교대 후 구성이 바뀌지 않게 했다.
- 전체 case ID 기반 전투 seed, 실패 격리, `--case` 단독 재실행을 구현했다.
- Smoke 596건은 596건 모두 성공했으며 단계 4 전용 테스트 7개와 전체 테스트 64개가 모두 통과했다.
- BattleEngine 종료 사유, 로그 식별자, 통계 판정은 계획대로 단계 5에 남겼다.

다음 구현 단계는 단계 5 — 전투 로그·통계·판정이다. 현재 모델과 추론 수준을 유지한다.

## 16. 단계 5 완료 기록

2026-07-17에 전투 종료 사유·로그 귀속·리그 통계·통제 실험 판정을 추가했다.

- `BattleEngine`이 승패, 동시 전멸, 최대 시간을 분리하고 마지막 허용 tick의 처치를 승패로 다시 확인한다.
- 공격·피해·스킬·회복·보호막·군중 제어 로그에 source/target instance·unit ID, team, sourceType을 추가했다.
- case별 유닛 피해·탱킹·회복·보호막·처치 관여·첫 스킬·CC·생존과 귀속 불명 피해 진단을 구현했다.
- 정상 완료 scoreRate, decisiveWinRate, Wilson 95% 신뢰구간, 최대 시간·실패율, 평균 생존·전투 시간을 분리 집계한다.
- 리그별 덱·매치업·유닛 성급 통계, 극단 상성, 배치 민감도, 투자 비용과 역할별 원시 지표를 구현했다.
- 내부 리그만 목표 밴드 판정을 수행하고 교차 리그는 `context-only`, 유닛 통계는 `association-only`로 표시한다.
- 동일 코스트·공유 역할 유닛 교체와 대응 case 기반 시너지 실험 판정을 구현했다.
- 단계 5 전용 테스트 8개와 전체 테스트 72개가 모두 통과했다.
- 실제 Smoke 596건은 596건 모두 성공했고 승패 573건, 최대 시간 23건, 귀속 불명 피해율 0%였다.

다음 구현 단계는 단계 6 — 결과 저장·비교·영향 범위 캐시다. GPT-5.6 Terra, 추론 수준 높음으로 진행한다.

## 17. 단계 6 완료 기록

2026-07-17에 실행 artifact 저장, baseline·paired 비교, hash 기반 보수 캐시 판정을 추가했다.

- 고유 run 디렉터리에 manifest, 두 입력 snapshot, canonical JSON, 실패 JSON, battle NDJSON, 집계 JSON·CSV, Markdown report를 저장한다.
- canonical JSON은 시간·절대 경로를 제외해 같은 전투 결과에서 같은 SHA-256을 만든다.
- manifest에 프로필, seed suite, Node, Git fallback, 전투·데이터·아이템·시너지 hash, 성공·실패 수, cache 판단을 기록한다.
- baseline과 latest 포인터를 분리하고 같은 case ID를 대응해 scoreRate 변화·신뢰구간·승패 전환·덱/매치업/유닛 diff를 생성한다.
- 전투 기반 source hash가 달라지면 순수 수치 A/B 비교가 아니라는 경고를 남긴다.
- Git 메타데이터가 없는 환경에서는 안전을 위해 캐시를 재사용하지 않고 전체 실행한다.
- 실제 Smoke 596건을 `20260717111058002-91e48cd2` run으로 저장하고 기준선으로 지정했다.
- 단계 6 전용 테스트 1개와 전체 테스트 73개가 모두 통과했다.

다음 구현 단계는 단계 7 — 한 명령 실행과 스킬 연결이다. 현재 GPT-5.6 Terra, 추론 수준 높음을 그대로 사용한다.

## 18. 단계 7 완료 기록

2026-07-17에 표준 덱 실행·저장·비교의 npm 명령과 `시뮬 돌려` 스킬 경로를 연결했다.

- `npm run simulate:decks`는 Quick 기본 실행, 프로필/단일 case/baseline 지정, artifact 저장, 동일 조건 baseline 비교를 지원한다.
- `npm run simulate:compare -- --base <runId> --candidate <runId>`는 기존 run 두 개의 대응 case 비교를 독립 실행한다.
- 실패 case마다 재현 명령을 출력하고 새 run report·comparison report 위치를 반환한다.
- `.cursorrules`와 `.agents/skills/run-simulation/SKILL.md`를 새 standard deck artifact 경로로 전환했다.
- 실제 npm Smoke는 596건 모두 성공했고, 기준선과의 대응 비교 573건은 변화 0이었다.
- 단계 7 전용 테스트 1개와 전체 테스트 74개가 모두 통과했다.

다음 구현 단계는 단계 8 — 프로젝트 전체 최종 감사다. GPT-5.6 Sol / Ultra로 모델을 변경한 뒤 시작한다.

## 19. 단계 8 완료 기록

2026-07-17에 프로덕션 코드를 수정하지 않고 전체 엔진·입력·실행·통계·저장·캐시·CLI를 감사했다.

- 동일 direct case 두 실행과 기존 full Smoke 두 실행의 canonical hash가 각각 일치했다.
- 단일 유닛 AP 변경 시 `js/data.js` 영향과 unit diff가 감지됐고, 원복 후 파일 hash와 원래 canonical hash가 복원됐다.
- 실패 case의 ID·seed 보존과 단독 재실행, 전체 테스트 74개, Vite 빌드, 실제 Quick 10,728전을 검증했다.
- P0 0건, P1 8건, P2 7건, P3 2건을 `reports/balance/final-audit.md`에 기록했다.
- 주요 P1은 시작 마나 이중 적용, 창체 진영 편향, 27개 고정 아이템 역배치, 표본 계약·기본 흐름 이탈, 필수 집계 누락, 대규모 실행 메모리, 캐시 오판, 비교 조건 미검증이다.
- 단계 8 원칙에 따라 발견한 프로덕션 문제를 바로 수정하지 않았다.

다음 구현 단계는 단계 9 — 최종 감사 문제 수정이다. GPT-5.6 Sol / Max로 전환한 뒤 감사 문서에 기록된 문제만 최소 변경한다.

## 20. 단계 9 완료 기록

2026-07-17에 단계 8 감사의 P1 8건, P2 7건, P3 2건을 모두 수정하고 필수 회귀·실행 검증을 완료했다.

- 시작 마나 단일 적용, 창체·경제부 팀별 계산, item effect 개수와 동적 item metric을 복구했다.
- 딜러 아이템 27건을 계수에 맞게 고치고 총량·아키타입 경고·예외 사유·legacy 양방향 검증을 추가했다.
- 프로필을 Smoke 3,576 / Quick 42,912 / Standard 128,736 / Deep 343,296 case로 복구했다.
- 기본 명령의 Smoke→Quick→의심 상성 Standard 흐름, 온라인 집계, NDJSON·canonical ledger 스트리밍을 구현했다.
- 실제 시너지·아이템·성장 12경로, 목표 밴드 경고, 95% 구간을 artifact와 보고서에 저장한다.
- 캐시 전이 소스·Git 상태, 비교 호환성·강제 옵션, 원자 저장·canonical 재검증, 스킬 reportPath를 보완했다.
- 전체 테스트 82개와 Vite 빌드가 통과했다.
- Smoke 두 run 3,576/0의 canonical hash가 일치했고 paired delta와 flip이 0이었다.
- Quick 42,912/0 run `20260717133258695-bcfa07b7`을 새 기준선으로 지정했다.

상세 결과는 `reports/balance/stage9-completion.md`에 기록했다.
