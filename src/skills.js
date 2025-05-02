// src/skills.js
import * as THREE from "three"; // 나중에 스킬이 더 복잡해지면 THREE 필요할 수 있음

// --- 스킬 상수 ---
// *** 시간 멈춤 이벤트 상수 ***
const TIME_FREEZE_CHANCE = 0.005; // 프레임당 시간 멈춤 발동 확률
const TIME_FREEZE_MIN_DURATION = 2.0; // 최소 멈춤 시간 (초)
const TIME_FREEZE_MAX_DURATION = 3.0; // 최대 멈춤 시간 (초)
// *** 밀치기(Knock Back) 이벤트 상수 ***
const KNOCK_BACK_CHANCE = 0.05; // 밀치기 발동 확률
const KNOCK_BACK_MIN_TARGETS = 1; // 최소 밀칠 대상 수
const KNOCK_BACK_MAX_TARGETS = 3; // 최대 밀칠 대상 수
const KNOCK_BACK_MIN_DISTANCE = 2; // 최소 밀치는 거리
const KNOCK_BACK_MAX_DISTANCE = 3; // 최대 밀치는 거리
const KNOCK_BACK_NOTIFICATION_DURATION = 2.5; // 밀치기 알림 표시 시간 (초)
// *** 1등->꼴등 (First to Last) 이벤트 상수 ***
const FIRST_TO_LAST_CHANCE = 0.001; // 매우 낮은 확률 (조정 가능)
const FIRST_TO_LAST_NOTIFICATION_DURATION = 3.0; // 알림 표시 시간 (조금 더 길게)
const FIRST_TO_LAST_PLACEMENT_OFFSET = 1.0; // 꼴등 뒤 얼마나 떨어뜨릴지
// *** 속도 증가 (Speed Boost) 이벤트 상수 ***
const SPEED_BOOST_CHANCE = 0.025; // 속도 증가 발동 확률
const SPEED_BOOST_MIN_DURATION = 1.5; // 최소 지속 시간
const SPEED_BOOST_MAX_DURATION = 3.0; // 최대 지속 시간
export const SPEED_BOOST_FACTOR = 1.6; // << App.js에서 사용하기 위해 export >> 속도 증가 배율 (1.6 = 60% 증가)
const SPEED_BOOST_NOTIFICATION_DURATION = 2.0; // 속도 증가 알림 표시 시간

// --- 경주 상수 (체크에 필요) ---
const RACE_DISTANCE = 200; // skills.js도 경주 거리를 알아야 함

/**
 * 경주 애니메이션 프레임 동안 무작위 스킬 이벤트 확인 및 실행을 처리합니다.
 * @param {number} elapsedTime - 경주의 총 경과 시간.
 * @param {Array} currentRacers - 레이서 객체 배열 (변경 가능).
 * @param {object} skillRefs - 스킬 상태를 보유하는 Refs.
 * @param {object} skillSetters - 상태 설정 함수에 대한 Refs.
 * @param {boolean} isRaceFinished - 경주 종료 여부 플래그.
 */
export function handleSkillEvents(
  elapsedTime,
  currentRacers,
  skillRefs,
  skillSetters,
  isRaceFinished
) {
  // 레이서 배열이 없거나 비어있으면 아무것도 하지 않음
  if (!currentRacers || currentRacers.length === 0) return;

  // 쉽게 접근하기 위해 refs와 setters를 구조 분해 할당
  const {
    timeFreezerIdRef,
    freezeStartTimeRef,
    freezeDurationRef,
    knockBackStartTimeRef,
    knockBackDurationRef,
    firstToLastStartTimeRef,
    firstToLastDurationRef,
    speedBoosterIdRef,
    boostEndTimeRef,
    boostNotifyStartTimeRef,
    boostNotifyDurationRef, // << 부스트 Refs 추가
  } = skillRefs;

  const {
    isTimeFrozenSetterRef,
    freezeInfoSetterRef,
    isKnockBackActiveSetterRef,
    knockBackInfoSetterRef,
    isFirstToLastActiveSetterRef,
    firstToLastInfoSetterRef,
    isSpeedBoostActiveSetterRef,
    speedBoostInfoSetterRef, // << 부스트 Setters 추가
  } = skillSetters;

  // refs에서 현재 상태 가져오기
  const currentIsTimeFrozen = timeFreezerIdRef.current !== null; // 시간 멈춤 활성 여부
  const currentIsKnockBackActive = knockBackStartTimeRef.current !== null; // 밀치기 알림 활성 여부
  const currentIsFirstToLastActive = firstToLastStartTimeRef.current !== null; // 1등->꼴등 알림 활성 여부
  const currentIsSpeedBoostActive = boostNotifyStartTimeRef.current !== null; // 부스트 알림 활성 여부

  // --- 이벤트 타이머 확인 ---
  // 1. 시간 멈춤 해제 체크
  if (currentIsTimeFrozen && freezeStartTimeRef.current !== null) {
    if (elapsedTime - freezeStartTimeRef.current >= freezeDurationRef.current) {
      isTimeFrozenSetterRef.current(false);
      freezeInfoSetterRef.current({
        freezerName: null,
        duration: 0,
        message: "",
      });
      timeFreezerIdRef.current = null;
      freezeStartTimeRef.current = null;
      freezeDurationRef.current = 0;
    }
  }
  // 2. 밀치기 알림 해제 체크
  if (currentIsKnockBackActive && knockBackStartTimeRef.current !== null) {
    if (
      elapsedTime - knockBackStartTimeRef.current >=
      knockBackDurationRef.current
    ) {
      isKnockBackActiveSetterRef.current(false);
      knockBackInfoSetterRef.current({ actorName: null, message: "" });
      knockBackStartTimeRef.current = null;
    }
  }
  // 3. 1등->꼴등 알림 해제 체크
  if (currentIsFirstToLastActive && firstToLastStartTimeRef.current !== null) {
    if (
      elapsedTime - firstToLastStartTimeRef.current >=
      firstToLastDurationRef.current
    ) {
      isFirstToLastActiveSetterRef.current(false);
      firstToLastInfoSetterRef.current({ victimName: null, message: "" });
      firstToLastStartTimeRef.current = null;
    }
  }
  // 4. << 부스트 알림 해제 체크 >>
  if (currentIsSpeedBoostActive && boostNotifyStartTimeRef.current !== null) {
    if (
      elapsedTime - boostNotifyStartTimeRef.current >=
      boostNotifyDurationRef.current
    ) {
      isSpeedBoostActiveSetterRef.current(false);
      speedBoostInfoSetterRef.current({ boosterName: null, message: "" });
      boostNotifyStartTimeRef.current = null;
    }
  }

  // 5. << 부스트 효과 해제 체크 >> (알림과 별개로 실제 효과 종료)
  if (speedBoosterIdRef.current !== null && boostEndTimeRef.current !== null) {
    if (elapsedTime >= boostEndTimeRef.current) {
      // console.log(`스킬 모듈: ${currentRacers.find(r => r.id === speedBoosterIdRef.current)?.name} 부스트 종료`);
      speedBoosterIdRef.current = null; // 효과 종료 표시 (App.js에서 isBoosting 플래그 업데이트에 사용)
      boostEndTimeRef.current = null;
    }
  }

  // --- 무작위 이벤트 발동 확인 ---
  // 다른 이벤트 알림이 활성 상태가 아닐 때만 발동 가능
  const canTriggerEvent =
    !currentIsTimeFrozen &&
    !currentIsKnockBackActive &&
    !currentIsFirstToLastActive &&
    !currentIsSpeedBoostActive && // 부스트 알림 없을 때
    !isRaceFinished &&
    currentRacers.length > 0;

  if (canTriggerEvent) {
    const randomEventValue = Math.random(); // 0과 1 사이의 무작위 값 생성
    // 현재 경주 중인(아직 도착하지 않은) 레이서만 필터링
    const racingRacers = currentRacers.filter(
      (r) => r.mesh.position.z < RACE_DISTANCE
    );

    // 스킬 발동 조건 확인 (일부 스킬은 최소 2명 필요)
    if (racingRacers.length >= 1) {
      // 부스트는 1명만 있어도 가능
      // 확률 누적 계산
      const timeFreezeThreshold = TIME_FREEZE_CHANCE;
      const knockBackThreshold = timeFreezeThreshold + KNOCK_BACK_CHANCE;
      const firstToLastThreshold = knockBackThreshold + FIRST_TO_LAST_CHANCE;
      const speedBoostThreshold = firstToLastThreshold + SPEED_BOOST_CHANCE; // << 부스트 확률 추가

      // --- Time Freeze Trigger ---
      if (randomEventValue < timeFreezeThreshold && racingRacers.length >= 2) {
        const freezer =
          racingRacers[Math.floor(Math.random() * racingRacers.length)]; // 무작위 레이서 선택
        const duration =
          TIME_FREEZE_MIN_DURATION +
          Math.random() * (TIME_FREEZE_MAX_DURATION - TIME_FREEZE_MIN_DURATION); // 지속 시간 랜덤 결정
        console.log(
          `스킬 모듈: ${freezer.name} 시간 멈춤 (${duration.toFixed(1)}초)`
        );
        timeFreezerIdRef.current = freezer.id;
        freezeStartTimeRef.current = elapsedTime;
        freezeDurationRef.current = duration; // 실제 지속 시간 저장
        const message = `⏱️ ${freezer.name} 님이 ${duration.toFixed(
          1
        )}초 동안 시간을 멈춥니다!`;
        freezeInfoSetterRef.current({
          freezerName: freezer.name,
          duration: duration,
          message: message,
        });
        isTimeFrozenSetterRef.current(true);
      }
      // --- Knock Back Trigger ---
      else if (
        randomEventValue < knockBackThreshold &&
        racingRacers.length >= 2
      ) {
        const actor =
          racingRacers[Math.floor(Math.random() * racingRacers.length)]; // 시전자 랜덤 선택
        const sortedRacersForEvent = [...racingRacers].sort(
          (a, b) => b.mesh.position.z - a.mesh.position.z
        );
        const actorRank = sortedRacersForEvent.findIndex(
          (r) => r.id === actor.id
        );
        const potentialTargets = sortedRacersForEvent.filter(
          (r, index) => index < actorRank
        );
        if (potentialTargets.length > 0) {
          const numTargetsToPush =
            Math.floor(
              Math.random() *
                (KNOCK_BACK_MAX_TARGETS - KNOCK_BACK_MIN_TARGETS + 1)
            ) + KNOCK_BACK_MIN_TARGETS;
          const actualTargetsToPush = Math.min(
            numTargetsToPush,
            potentialTargets.length
          );
          for (let i = potentialTargets.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [potentialTargets[i], potentialTargets[j]] = [
              potentialTargets[j],
              potentialTargets[i],
            ];
          }
          const targets = potentialTargets.slice(0, actualTargetsToPush);
          targets.forEach((target) => {
            const knockBackDistance =
              KNOCK_BACK_MIN_DISTANCE +
              Math.random() *
                (KNOCK_BACK_MAX_DISTANCE - KNOCK_BACK_MIN_DISTANCE);
            const originalZ = target.mesh.position.z;
            target.mesh.position.z = Math.max(0, originalZ - knockBackDistance);
            target.labelSprite.position.z = target.mesh.position.z;
            // console.log(`스킬 모듈: ${actor.name}가 ${target.name}를 ${knockBackDistance.toFixed(1)}만큼 밀침`);
          });
          const message = `💥 ${actor.name} 님이 ${targets.length}명을 뒤로 밀쳐냅니다!`;
          knockBackInfoSetterRef.current({
            actorName: actor.name,
            message: message,
          });
          isKnockBackActiveSetterRef.current(true);
          knockBackStartTimeRef.current = elapsedTime;
        }
      }
      // --- First to Last Trigger ---
      else if (
        randomEventValue < firstToLastThreshold &&
        racingRacers.length >= 2
      ) {
        const sortedRacingRacers = [...racingRacers].sort(
          (a, b) => b.mesh.position.z - a.mesh.position.z
        );
        if (sortedRacingRacers.length >= 2) {
          const firstRacer = sortedRacingRacers[0];
          const lastRacer = sortedRacingRacers[sortedRacingRacers.length - 1];
          const newZPosition = Math.max(
            0,
            lastRacer.mesh.position.z - FIRST_TO_LAST_PLACEMENT_OFFSET
          );
          console.log(
            `스킬 모듈: 불운! ${firstRacer.name}(1등)이 ${
              lastRacer.name
            } 뒤(꼴등)로 보내짐. Z: ${firstRacer.mesh.position.z.toFixed(
              1
            )} -> ${newZPosition.toFixed(1)}`
          );
          firstRacer.mesh.position.z = newZPosition;
          firstRacer.labelSprite.position.z = newZPosition;
          const message = `⚡️ 운명의 장난! ${firstRacer.name} 님이 꼴찌로...`;
          firstToLastInfoSetterRef.current({
            victimName: firstRacer.name,
            message: message,
          });
          isFirstToLastActiveSetterRef.current(true);
          firstToLastStartTimeRef.current = elapsedTime;
        }
      }
      // --- << Speed Boost Trigger >> ---
      else if (
        randomEventValue < speedBoostThreshold &&
        speedBoosterIdRef.current === null
      ) {
        // 현재 부스트 중인 레이서가 없을 때만 발동
        const booster =
          racingRacers[Math.floor(Math.random() * racingRacers.length)]; // 부스트 받을 레이서 랜덤 선택
        const duration =
          SPEED_BOOST_MIN_DURATION +
          Math.random() * (SPEED_BOOST_MAX_DURATION - SPEED_BOOST_MIN_DURATION); // 지속 시간 랜덤 결정

        console.log(
          `스킬 모듈: ${booster.name} 속도 부스트! (${duration.toFixed(1)}초)`
        );

        // 부스트 상태 설정 (Ref 업데이트) -> 실제 효과 적용은 App.js에서 이 ID를 확인하여 처리
        speedBoosterIdRef.current = booster.id;
        boostEndTimeRef.current = elapsedTime + duration; // 효과 종료 시간 기록

        // 알림 설정 (State 업데이트)
        const message = `🚀 ${booster.name} 님 일시적 속도 증가!`;
        speedBoostInfoSetterRef.current({
          boosterName: booster.name,
          message: message,
        });
        isSpeedBoostActiveSetterRef.current(true); // 알림 활성화
        boostNotifyStartTimeRef.current = elapsedTime; // 알림 타이머 시작
      }
    }
  }
} // end of handleSkillEvents
